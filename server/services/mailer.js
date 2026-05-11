const nodemailer = require('nodemailer');

function isProd() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

function getFromAddress() {
  return process.env.EMAIL_FROM || process.env.SMTP_FROM || 'no-reply@automatrix.local';
}

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT);
}

function createTransporter() {
  if (!hasSmtpConfig()) return null;

  const port = Number(process.env.SMTP_PORT);
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? String(process.env.SMTP_SECURE).toLowerCase() === 'true'
      : port === 465;

  const authUser = process.env.SMTP_USER;
  const authPass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: authUser && authPass ? { user: authUser, pass: authPass } : undefined,
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
  const subject = 'Your AutoMatrix verification code';
  const text =
    `Your verification code is: ${otp}\n\n` +
    `This code expires in ${minutesValid} minutes.\n\n` +
    `If you didn't request this, you can ignore this email.`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2 style="margin: 0 0 12px;">Verify your email</h2>
      <p style="margin: 0 0 12px;">Use this code to complete your signup:</p>
      <div style="font-size: 28px; letter-spacing: 6px; font-weight: 700; margin: 12px 0;">
        ${otp}
      </div>
      <p style="margin: 12px 0 0; color: #666;">This code expires in ${minutesValid} minutes.</p>
      <p style="margin: 12px 0 0; color: #666;">If you didn't request this, you can ignore this email.</p>
    </div>
  `;

  return sendMail({ to, subject, text, html });
}

module.exports = {
  sendMail,
  sendSignupOtpEmail,
};

