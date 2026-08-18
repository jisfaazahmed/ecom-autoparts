const User = require('../models/user')
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const emailService = require('../services/email.service');
const NotificationService = require('../services/notification.service');
const { sendSignupOtpEmail } = require('../services/mailer');

const OTP_VALID_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_SENDS_PER_WINDOW = 3;
const SEND_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

exports.register = async (req, res) => {
  try {
    const { name, fullName, email, password, role, shopName } = req.body;
    const displayName = name || fullName;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedRole = role || 'CUSTOMER';

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

    // Notify Super Admin based on role
    if (normalizedRole === 'ADMIN') {
      NotificationService.notifySuperAdminVendorApplied(user).catch(err => console.error('Error notifying super admin vendor application:', err));
    } else if (normalizedRole === 'CUSTOMER') {
      NotificationService.notifySuperAdminCustomerSignup(user).catch(err => console.error('Error notifying super admin customer signup:', err));
    }


    const payload = { user: { id: user.id, role: user.role } };
    jwt.sign(payload, process.env.JWT_SECRET || 'secret123', { expiresIn: '1d' }, (err, token) => {
      if (err) throw err;
      const roleLower = (user.role || '').toLowerCase().replace('_', '');
      const mappedRole = roleLower === 'superadmin' ? 'superadmin' : roleLower === 'admin' ? 'admin' : 'customer';
      res.status(201).json({
        message: normalizedRole === 'ADMIN'
          ? 'Registration successful! Wait for Super Admin approval.'
          : 'Registration successful!',
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
    });
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

    if (user.emailVerification?.codeHash) {
      return res.status(403).json({
        message: 'Please verify your email before logging in.',
        verificationId: user.id,
      });
    }

    // Vendors may log in while pending; super admin approves before products go live.
    if (user.status === 'PENDING' && user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Account pending approval.' });
    }
    if (user.status === 'REJECTED') return res.status(403).json({ message: 'Account rejected.' });
    if (user.status === 'SUSPENDED') return res.status(403).json({ message: 'Account suspended.' });

    const payload = { user: { id: user.id, role: user.role } };

    jwt.sign(payload, process.env.JWT_SECRET || 'secret123', { expiresIn: '1d' }, (err, token) => {
      if (err) throw err;
      // Client expects accessToken and user (role normalized to lowercase)
      const roleLower = (user.role || '').toLowerCase().replace('_', '');
      res.json({
        accessToken: token,
        refreshToken: token, // optional: same token for now
        user: {
          id: user.id,
          email: user.email,
          fullName: user.name,
          role: roleLower === 'superadmin' ? 'superadmin' : roleLower === 'admin' ? 'admin' : 'customer',
          status: user.status,
          shopName: user.shopName,
          commissionRate: user.commissionRate,
          createdAt: user.createdAt,
        },
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
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
    res.status(500).json({ message: 'Server error' });
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

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`;
    
    await emailService.sendPasswordReset(normalizedEmail, resetLink);

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

// PUT /auth/profile - Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, fullName, phone, address } = req.body;
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name || fullName) user.name = name || fullName;
    if (phone) user.phone = phone;
    if (address) user.address = address;

    await user.save();

    const roleLower = (user.role || '').toLowerCase().replace('_', '');
    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.name,
        role: roleLower === 'superadmin' ? 'superadmin' : roleLower === 'admin' ? 'admin' : 'customer',
        status: user.status,
        phone: user.phone,
        address: user.address,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating profile' });
  }
};

// ========== OTP-BASED REGISTRATION ==========

// POST /api/auth/register/start
// Creates a PENDING user, generates a 6-digit OTP and emails it.
exports.registerStart = async (req, res) => {
  try {
    const { name, fullName, email, password, role, shopName } = req.body;
    const displayName = name || fullName;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedRole = role || 'CUSTOMER';

    if (normalizedRole === 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Cannot register as Super Admin.' });
    }
    if (!displayName || !normalizedEmail || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Remove any unverified duplicate before re-registering
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      if (existing.emailVerification?.verifiedAt) {
        return res.status(400).json({ message: 'An account with this email already exists.' });
      }
      await User.deleteOne({ _id: existing._id });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const otp = generateOtp();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const now = new Date();

    const user = new User({
      name: displayName,
      email: normalizedEmail,
      password: hashedPassword,
      role: normalizedRole,
      shopName: normalizedRole === 'ADMIN' ? shopName : undefined,
      emailVerification: {
        codeHash: otpHash,
        expiresAt: new Date(now.getTime() + OTP_VALID_MINUTES * 60 * 1000),
        attempts: 0,
        lastSentAt: now,
        sendCount: 1,
        sendWindowStartAt: now,
        verifiedAt: null,
      },
    });
    await user.save();

    sendSignupOtpEmail({ to: normalizedEmail, otp, minutesValid: OTP_VALID_MINUTES }).catch(err =>
      console.error('Error sending signup OTP:', err)
    );

    return res.status(200).json({
      message: 'A 6-digit verification code has been sent to your email.',
      verificationId: user._id,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/auth/register/verify
// Validates the OTP and activates the account.
exports.registerVerify = async (req, res) => {
  try {
    const { verificationId, otp } = req.body;
    if (!verificationId || !otp) {
      return res.status(400).json({ message: 'verificationId and otp are required' });
    }

    const user = await User.findById(verificationId);
    if (!user || user.emailVerification?.verifiedAt) {
      return res.status(400).json({ message: 'Invalid or already-verified verification.' });
    }

    const ev = user.emailVerification;
    if (!ev?.codeHash || !ev?.expiresAt) {
      return res.status(400).json({ message: 'No pending verification found.' });
    }
    if (new Date() > ev.expiresAt) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }
    if ((ev.attempts || 0) >= MAX_VERIFY_ATTEMPTS) {
      return res.status(429).json({ message: 'Too many incorrect attempts. Please request a new OTP.' });
    }

    const otpHash = crypto.createHash('sha256').update(String(otp)).digest('hex');
    if (otpHash !== ev.codeHash) {
      user.emailVerification.attempts = (ev.attempts || 0) + 1;
      await user.save();
      return res.status(400).json({ message: 'Invalid OTP.' });
    }

    user.emailVerification.verifiedAt = new Date();
    user.emailVerification.codeHash = null;
    user.emailVerification.expiresAt = null;
    if (user.role === 'CUSTOMER') user.status = 'ACTIVE';
    await user.save();

    if (user.role === 'ADMIN') {
      NotificationService.notifySuperAdminVendorApplied(user).catch(err =>
        console.error('Error notifying vendor application:', err)
      );
    } else if (user.role === 'CUSTOMER') {
      NotificationService.notifySuperAdminCustomerSignup(user).catch(err =>
        console.error('Error notifying customer signup:', err)
      );
    }

    const token = jwt.sign(
      { user: { id: user.id, role: user.role } },
      process.env.JWT_SECRET || 'secret123',
      { expiresIn: '1d' }
    );
    const roleLower = (user.role || '').toLowerCase().replace('_', '');
    const mappedRole = roleLower === 'superadmin' ? 'superadmin' : roleLower === 'admin' ? 'admin' : 'customer';

    return res.status(200).json({
      message: user.role === 'ADMIN'
        ? 'Email verified. Your vendor application is pending admin approval.'
        : 'Registration complete! Welcome.',
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
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/auth/register/resend
// Resends a fresh OTP for a pending registration (rate-limited to 3/hour).
exports.registerResend = async (req, res) => {
  try {
    const { verificationId } = req.body;
    if (!verificationId) {
      return res.status(400).json({ message: 'verificationId is required' });
    }

    const user = await User.findById(verificationId);
    if (!user) return res.status(400).json({ message: 'Invalid verificationId.' });
    if (user.emailVerification?.verifiedAt) {
      return res.status(400).json({ message: 'Email already verified.' });
    }

    const ev = user.emailVerification || {};
    const now = new Date();
    const windowStart = ev.sendWindowStartAt ? new Date(ev.sendWindowStartAt) : now;
    const windowElapsed = now - windowStart;

    if (windowElapsed < SEND_WINDOW_MS && (ev.sendCount || 0) >= MAX_SENDS_PER_WINDOW) {
      const minutesLeft = Math.ceil((SEND_WINDOW_MS - windowElapsed) / 60000);
      return res.status(429).json({ message: `Too many requests. Try again in ${minutesLeft} minute(s).` });
    }

    const otp = generateOtp();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    user.emailVerification = {
      codeHash: otpHash,
      expiresAt: new Date(now.getTime() + OTP_VALID_MINUTES * 60 * 1000),
      attempts: 0,
      lastSentAt: now,
      sendCount: windowElapsed >= SEND_WINDOW_MS ? 1 : (ev.sendCount || 0) + 1,
      sendWindowStartAt: windowElapsed >= SEND_WINDOW_MS ? now : windowStart,
      verifiedAt: null,
    };
    await user.save();

    sendSignupOtpEmail({ to: user.email, otp, minutesValid: OTP_VALID_MINUTES }).catch(err =>
      console.error('Error resending OTP:', err)
    );

    return res.status(200).json({ message: 'A new OTP has been sent to your email.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};