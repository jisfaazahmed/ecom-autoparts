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

    let user = await User.findOne({ email: normalizedEmail });
    if (user) return res.status(400).json({ message: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      name: displayName,
      email: normalizedEmail,
      password: hashedPassword,
      role: normalizedRole,
      shopName: normalizedRole === 'ADMIN' ? shopName : undefined,
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
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: normalizedEmail });
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

// GET /auth/me - return current user from JWT
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const roleLower = (user.role || '').toLowerCase().replace('_', '');
    res.json({
      id: user.id,
      email: user.email,
      fullName: user.name,
      role: roleLower === 'superadmin' ? 'superadmin' : roleLower === 'admin' ? 'admin' : 'customer',
      status: user.status,
      shopName: user.shopName,
      commissionRate: user.commissionRate,
      createdAt: user.createdAt,
      userRoles: [{ role: roleLower === 'superadmin' ? 'superadmin' : roleLower === 'admin' ? 'admin' : 'customer' }],
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

// POST /auth/forgot-password - Request password reset
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // For security, don't reveal if email exists
      return res.status(200).json({ 
        message: 'If an account with this email exists, a password reset link will be sent.' 
      });
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.resetToken = resetTokenHash;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    // TODO: Send email with reset link
    // For now, return token for testing (in production, send via email)
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`;
    
    console.log(`Password reset link for ${normalizedEmail}: ${resetLink}`);

    res.status(200).json({ 
      message: 'Password reset link has been sent to your email',
      // Only in development - remove in production
      ...(process.env.NODE_ENV !== 'production' && { resetToken, resetLink })
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error processing password reset request' });
  }
};

// POST /auth/reset-password - Reset password with token
exports.resetPassword = async (req, res) => {
  try {
    const { token, password, passwordConfirm } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }

    if (password !== passwordConfirm) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Hash the token to compare with stored hash
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with matching reset token and non-expired token
    const user = await User.findOne({
      resetToken: resetTokenHash,
      resetTokenExpiry: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Reset token is invalid or has expired' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update password and clear reset token
    user.password = hashedPassword;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error resetting password' });
  }
};

// POST /auth/change-password - Change password when logged in
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, passwordConfirm } = req.body;
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword !== passwordConfirm) {
      return res.status(400).json({ message: 'New passwords do not match' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: 'Password has been changed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error changing password' });
  }
};

exports.registerSeller = async (req, res) => {
  try {
    req.body.role = 'ADMIN';
    return exports.register(req, res);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (email) {
      const normalizedEmail = String(email).trim().toLowerCase();
      const emailExists = await User.findOne({ email: normalizedEmail, _id: { $ne: userId } });
      if (emailExists) return res.status(400).json({ message: 'Email already in use' });
      user.email = normalizedEmail;
    }

    await user.save();
    
    const roleLower = (user.role || '').toLowerCase().replace('_', '');
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.name,
        role: roleLower === 'superadmin' ? 'superadmin' : roleLower === 'admin' ? 'admin' : 'customer',
        status: user.status,
        shopName: user.shopName,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};