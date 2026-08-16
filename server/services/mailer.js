const nodemailer = require('nodemailer');
require('dotenv').config();

function isProd() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

function getFromAddress() {
  return process.env.EMAIL_FROM || process.env.SMTP_FROM || 'no-reply@automatrix.local';
}

function hasSmtpConfig() {
  return Boolean(
    (process.env.SMTP_HOST && process.env.SMTP_PORT) ||
    (process.env.EMAIL_HOST && process.env.EMAIL_PORT)
  );
}

function createTransporter() {
  if (!hasSmtpConfig()) return null;

  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT);
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? String(process.env.SMTP_SECURE).toLowerCase() === 'true'
      : process.env.EMAIL_SECURE !== undefined
        ? String(process.env.EMAIL_SECURE).toLowerCase() === 'true'
        : port === 465;

  const authUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const authPass = process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.SMTP_PASSWORD;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: authUser && authPass ? { user: authUser, pass: authPass } : undefined,
    tls: {
        rejectUnauthorized: false
    }
  });
}

async function sendMail({ to, subject, text, html }) {
  const transporter = createTransporter();

  // Dev-safe fallback: log emails if SMTP isn't configured.
  if (!transporter) {
    if (isProd()) {
      throw new Error('SMTP is not configured');
    }
    console.log('[DEV_MAILER] To:', to);
    console.log('[DEV_MAILER] Subject:', subject);
    if (text) console.log('[DEV_MAILER] Text:', text);
    if (html) console.log('[DEV_MAILER] HTML:', html);
    return { delivered: false };
  }

  await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  return { delivered: true };
}

async function sendSignupOtpEmail({ to, otp, minutesValid = 10 }) {
  const AccountTemplates = require('./emails/templates/AccountTemplates');
  const subject = 'Your AutoMatrix verification code';
  const text =
    `Your verification code is: ${otp}\n\n` +
    `This code expires in ${minutesValid} minutes.\n\n` +
    `If you didn't request this, you can ignore this email.`;

  const html = AccountTemplates.accountVerificationTemplate({
    customerName: 'Customer',
    otp: otp,
    minutesValid: minutesValid
  });

  return sendMail({ to, subject, text, html });
}

async function sendPasswordReset(email, resetLink) {
  const subject = 'Password Reset Request';
  const html = `
            <h1>Password Reset</h1>
            <p>You requested a password reset. Click the link below to reset your password:</p>
            <a href="${resetLink}">${resetLink}</a>
            <p>This link is valid for 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
        `;
  return sendMail({ to: email, subject, html });
}

module.exports = {
  sendMail,
  sendSignupOtpEmail,
  sendPasswordReset
};
