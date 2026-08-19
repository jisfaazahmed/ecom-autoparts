const nodemailer = require('nodemailer');
const mailConfig = require('../config/mail');

function isProd() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

function createTransporter() {
  if (!mailConfig.isConfigured()) return null;

  return nodemailer.createTransport(mailConfig.getMailConfig());
}

function logMail({ to, subject, text, html, reason }) {
  console.log('[DEV_MAILER] Not sent (%s) – logging instead.', reason);
  console.log('[DEV_MAILER] To:', to);
  console.log('[DEV_MAILER] Subject:', subject);
  if (text) console.log('[DEV_MAILER] Text:', text);
  if (html) console.log('[DEV_MAILER] HTML:', html);
}

// SMTP accepting a message is not the same as delivering it: a mistyped or non-existent
// address is accepted here and bounces minutes later, out of band, where nothing reports
// back to the app. Echo the plain-text body in dev so local testing never depends on the
// recipient mailbox actually existing. The HTML part is skipped to keep the log readable.
function logSentMail({ to, subject, text }) {
  console.log('[DEV_MAILER] Sent to %s – %s', to, subject);
  if (text) console.log('[DEV_MAILER] Text:', text);
}

async function sendMail({ to, subject, text, html }) {
  const transporter = createTransporter();

  // Dev-safe fallback: log emails if SMTP isn't configured.
  if (!transporter) {
    if (isProd()) {
      throw new Error(mailConfig.describeMissing());
    }
    logMail({ to, subject, text, html, reason: mailConfig.describeMissing() });
    return { delivered: false };
  }

  try {
    await transporter.sendMail({
      from: mailConfig.getFromAddress(),
      to,
      subject,
      text,
      html,
    });
  } catch (err) {
    // Configured-but-broken SMTP (revoked credentials, host unreachable) used to be
    // indistinguishable from a working mailbox: signup would hand the user an OTP screen
    // for a code nobody could read. Outside production, fall back to the same log path we
    // use when SMTP is absent so the flow stays completable locally.
    if (isProd()) throw err;
    logMail({ to, subject, text, html, reason: err.message });
    return { delivered: false };
  }

  if (!isProd()) logSentMail({ to, subject, text });

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

// Sent once the emailed OTP has been confirmed, so it doubles as proof to the customer
// that the address they registered with actually receives our mail.
async function sendWelcomeEmail({ to, customerName }) {
  const AccountTemplates = require('./emails/templates/AccountTemplates');
  const name = customerName || 'there';
  const subject = 'Welcome to AutoMatrix - your account is ready';
  const text =
    `Hi ${name},\n\n` +
    `Your AutoMatrix account is verified and ready to use. You can sign in with this ` +
    `email address and start browsing parts right away.\n\n` +
    `Happy motoring,\nThe AutoMatrix team`;

  const html = AccountTemplates.welcomeTemplate({ customerName: name });

  return sendMail({ to, subject, text, html });
}

module.exports = {
  sendMail,
  sendSignupOtpEmail,
  sendWelcomeEmail,
};

