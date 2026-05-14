const User = require('../models/user')
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendSignupOtpEmail } = require('../services/mailer');

const OTP_TTL_MINUTES = Number(process.env.SIGNUP_OTP_TTL_MINUTES || 10);
const OTP_MIN_RESEND_SECONDS = Number(process.env.SIGNUP_OTP_RESEND_COOLDOWN_SECONDS || 60);
const OTP_MAX_SENDS_PER_HOUR = Number(process.env.SIGNUP_OTP_MAX_SENDS_PER_HOUR || 5);
const OTP_MAX_VERIFY_ATTEMPTS = Number(process.env.SIGNUP_OTP_MAX_VERIFY_ATTEMPTS || 5);

function hashOtp(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function generateOtp6() {
  const n = crypto.randomInt(0, 1000000);
  return String(n).padStart(6, '0');
}

function normalizeRole(role) {
  return role || 'CUSTOMER';
}

function mapRoleForClient(userRole) {
  const roleLower = (userRole || '').toLowerCase().replace('_', '');
  return roleLower === 'superadmin' ? 'superadmin' : roleLower === 'admin' ? 'admin' : 'customer';
}

function isEmailVerified(user) {
  const verification = user?.emailVerification;
  if (!verification) return true;
  if (verification?.verifiedAt) return true;

  // Backward compatibility: legacy accounts created before OTP rollout
  // may have an empty verification object (all null/default values).
  const hasActiveOtp =
    Boolean(verification?.codeHash) ||
    Boolean(verification?.expiresAt) ||
    Boolean(verification?.lastSentAt) ||
    Number(verification?.sendCount || 0) > 0;

  return !hasActiveOtp;
}

function ensureEmailVerificationShape(user) {
  user.emailVerification = user.emailVerification || {};
  if (user.emailVerification.attempts === undefined || user.emailVerification.attempts === null) {
    user.emailVerification.attempts = 0;
  }
  if (user.emailVerification.sendCount === undefined || user.emailVerification.sendCount === null) {
    user.emailVerification.sendCount = 0;
  }
  if (user.emailVerification.codeHash === undefined) user.emailVerification.codeHash = null;
  if (user.emailVerification.expiresAt === undefined) user.emailVerification.expiresAt = null;
  if (user.emailVerification.lastSentAt === undefined) user.emailVerification.lastSentAt = null;
  if (user.emailVerification.sendWindowStartAt === undefined) user.emailVerification.sendWindowStartAt = null;
  if (user.emailVerification.verifiedAt === undefined) user.emailVerification.verifiedAt = null;
}

function canSendOtpNow(user) {
  ensureEmailVerificationShape(user);
  const now = Date.now();
  const lastSentAt = user.emailVerification.lastSentAt ? new Date(user.emailVerification.lastSentAt).getTime() : 0;
  if (lastSentAt && now - lastSentAt < OTP_MIN_RESEND_SECONDS * 1000) {
    return { ok: false, reason: 'cooldown' };
  }

  const windowStart = user.emailVerification.sendWindowStartAt
    ? new Date(user.emailVerification.sendWindowStartAt).getTime()
    : 0;

  const oneHourMs = 60 * 60 * 1000;
  if (!windowStart || now - windowStart >= oneHourMs) {
    user.emailVerification.sendWindowStartAt = new Date(now);
    user.emailVerification.sendCount = 0;
  }

  if (Number(user.emailVerification.sendCount || 0) >= OTP_MAX_SENDS_PER_HOUR) {
    return { ok: false, reason: 'rate_limit' };
  }

  return { ok: true };
}

async function issueTokensAndRespond(res, user) {
  const payload = { user: { id: user.id, role: user.role } };
  const token = await new Promise((resolve, reject) => {
    jwt.sign(payload, process.env.JWT_SECRET || 'secret123', { expiresIn: '1d' }, (err, tok) => {
      if (err) reject(err);
      else resolve(tok);
    });
  });

  const mappedRole = mapRoleForClient(user.role);
  return res.status(200).json({
    accessToken: token,
    refreshToken: token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.name,
      role: mappedRole,
      status: user.status,
      shopName: user.shopName,
      commissionRate: user.commissionRate,
      createdAt: user.createdAt,
    },
  });
}

exports.register = async (req, res) => {
  try {
    // Accept both 'name' and 'fullName' from frontend
    const { name, fullName, email, password, role, shopName, phone } = req.body;
    const userName = name || fullName;

    if (!userName || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }

    if (role === 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Cannot register as Super Admin.' });
    }

    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      name: userName,
      email,
      password: hashedPassword,
      phone: phone || undefined,
      role: role || 'CUSTOMER',
      shopName: role === 'ADMIN' ? shopName : undefined,
      // Customers are auto-active; sellers need Super Admin approval
      status: role === 'ADMIN' ? 'PENDING' : 'ACTIVE',
    });

    await user.save();

    // Legacy endpoint compatibility: force OTP flow for new signups
    return res.status(400).json({
      message: 'Signup now requires email verification. Use /auth/register/start.',
      code: 'OTP_REQUIRED',
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

// POST /auth/register/start - create user and send OTP email
exports.registerStart = async (req, res) => {
  try {
    const { name, fullName, email, password, role, shopName } = req.body;
    const displayName = name || fullName;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedRole = normalizeRole(role);

    if (normalizedRole === 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Cannot register as Super Admin.' });
    }

    if (!displayName || !normalizedEmail || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (normalizedRole === 'ADMIN' && !shopName) {
      return res.status(400).json({ message: 'Shop name is required for seller registration' });
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      // Do not allow re-registering; user should login or use resend with verification id.
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const otp = generateOtp6();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000);

    const user = new User({
      name: displayName,
      email: normalizedEmail,
      password: hashedPassword,
      role: normalizedRole,
      shopName: normalizedRole === 'ADMIN' ? shopName : undefined,
      emailVerification: {
        codeHash: hashOtp(otp),
        expiresAt,
        attempts: 0,
        lastSentAt: now,
        sendCount: 1,
        sendWindowStartAt: now,
        verifiedAt: null,
      },
    });

    // Customers should not be able to login until verified; keep status as ACTIVE
    // Vendors will be set to PENDING by pre-save hook.
    await user.save();

    await sendSignupOtpEmail({ to: normalizedEmail, otp, minutesValid: OTP_TTL_MINUTES });

    res.status(201).json({
      message: 'OTP sent to your email',
      verificationId: user.id,
      expiresInMinutes: OTP_TTL_MINUTES,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /auth/register/resend - resend OTP email
exports.registerResend = async (req, res) => {
  try {
    const { verificationId } = req.body;
    if (!verificationId) return res.status(400).json({ message: 'verificationId is required' });

    const user = await User.findById(verificationId);
    if (!user) return res.status(404).json({ message: 'Verification request not found' });

    if (isEmailVerified(user)) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    const allowed = canSendOtpNow(user);
    if (!allowed.ok) {
      return res.status(429).json({
        message: allowed.reason === 'cooldown' ? 'Please wait before requesting another code' : 'Too many OTP requests',
      });
    }

    const otp = generateOtp6();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000);

    ensureEmailVerificationShape(user);
    user.emailVerification.codeHash = hashOtp(otp);
    user.emailVerification.expiresAt = expiresAt;
    user.emailVerification.attempts = 0;
    user.emailVerification.lastSentAt = now;
    user.emailVerification.sendCount = Number(user.emailVerification.sendCount || 0) + 1;

    await user.save();
    await sendSignupOtpEmail({ to: user.email, otp, minutesValid: OTP_TTL_MINUTES });

    res.status(200).json({
      message: 'OTP resent to your email',
      verificationId: user.id,
      expiresInMinutes: OTP_TTL_MINUTES,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /auth/register/verify - verify OTP and issue tokens
exports.registerVerify = async (req, res) => {
  try {
    const { verificationId, otp } = req.body;
    if (!verificationId || !otp) {
      return res.status(400).json({ message: 'verificationId and otp are required' });
    }

    const user = await User.findById(verificationId);
    if (!user) return res.status(404).json({ message: 'Verification request not found' });

    if (isEmailVerified(user)) {
      // already verified, allow login token issuance
      return issueTokensAndRespond(res, user);
    }

    ensureEmailVerificationShape(user);

    if (Number(user.emailVerification.attempts || 0) >= OTP_MAX_VERIFY_ATTEMPTS) {
      return res.status(429).json({ message: 'Too many attempts. Please request a new code.' });
    }

    const expiresAtMs = user.emailVerification.expiresAt ? new Date(user.emailVerification.expiresAt).getTime() : 0;
    if (!expiresAtMs || Date.now() > expiresAtMs) {
      return res.status(400).json({ message: 'OTP is invalid or has expired' });
    }

    const submittedHash = hashOtp(String(otp).trim());
    const validHash = String(user.emailVerification.codeHash || '');

    if (!validHash || submittedHash !== validHash) {
      user.emailVerification.attempts = Number(user.emailVerification.attempts || 0) + 1;
      await user.save();
      return res.status(400).json({ message: 'OTP is invalid or has expired' });
    }

    // Mark verified + clear code
    user.emailVerification.verifiedAt = new Date();
    user.emailVerification.codeHash = null;
    user.emailVerification.expiresAt = null;
    user.emailVerification.attempts = 0;

    // Ensure final status: customers become ACTIVE; vendors remain pending for approval.
    if (user.role === 'CUSTOMER') user.status = 'ACTIVE';
    if (user.role === 'ADMIN') user.status = 'PENDING';

    await user.save();
    return issueTokensAndRespond(res, user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid Credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid Credentials' });

    // Email verification gatekeeper
    if (!isEmailVerified(user)) {
      return res.status(403).json({ message: 'Email verification required.' });
    }

    // GATEKEEPER CHECK
    if (user.status === 'PENDING') return res.status(403).json({ message: 'Account pending approval.' });
    if (user.status === 'REJECTED') return res.status(403).json({ message: 'Account rejected.' });

    return issueTokensAndRespond(res, user);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

// Map backend status to client-friendly (for getMe shop)
const STATUS_TO_CLIENT = { ACTIVE: 'approved', PENDING: 'pending', REJECTED: 'rejected', SUSPENDED: 'suspended' };

// GET /auth/me - return current user from JWT with profile and shop (for admins)
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const roleLower = (user.role || '').toLowerCase().replace('_', '');
    const role = roleLower === 'superadmin' ? 'superadmin' : roleLower === 'admin' ? 'admin' : 'customer';

    const response = {
      id: user.id,
      email: user.email,
      fullName: user.name,
      role,
      userRoles: [{ role }],
      profile: {
        id: user._id.toString(),
        userId: user._id.toString(),
        fullName: user.name,
        email: user.email,
        phone: user.phone || null,
        address: user.address || null,
        createdAt: user.createdAt && new Date(user.createdAt).toISOString(),
        updatedAt: user.updatedAt && new Date(user.updatedAt).toISOString(),
      },
    };

    if (user.role === 'ADMIN') {
      response.shop = {
        id: user._id.toString(),
        name: user.shopName || user.name || '',
        description: user.shopDescription || null,
        logoUrl: user.logoUrl || null,
        ownerId: user._id.toString(),
        status: STATUS_TO_CLIENT[user.status] || user.status?.toLowerCase() || 'pending',
        email: user.email || null,
        phone: user.phone || null,
        address: user.address || null,
        businessRegistration: user.businessRegistration || null,
        commissionRate: user.commissionRate != null ? user.commissionRate : 10,
        createdAt: (user.createdAt && new Date(user.createdAt).toISOString()) || new Date().toISOString(),
        updatedAt: (user.updatedAt && new Date(user.updatedAt).toISOString()) || new Date().toISOString(),
      };
    }

    res.json(response);

  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

// PUT /auth/profile - update current user profile
exports.updateProfile = async (req, res) => {
  try {
    const { fullName, phone, address, city, postalCode } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (fullName !== undefined) user.name = fullName.trim();
    if (phone !== undefined) user.phone = phone || null;
    if (address !== undefined) user.address = address || null;
    if (city !== undefined) user.city = city || null;
    if (postalCode !== undefined) user.postalCode = postalCode || null;

    await user.save();

    const roleLower = (user.role || '').toLowerCase().replace('_', '');
    const mappedRole = roleLower === 'superadmin' ? 'superadmin' : roleLower === 'admin' ? 'admin' : 'customer';
    res.json({
      id: user.id,
      email: user.email,
      fullName: user.name,
      phone: user.phone || null,
      address: user.address || null,
      city: user.city || null,
      postalCode: user.postalCode || null,
      avatarUrl: user.avatarUrl || null,
      role: mappedRole,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update profile' });
  }
};

// POST /auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to change password' });
  }
};