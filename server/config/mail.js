// Single source of truth for SMTP configuration.
//
// Canonical variable names only - the set documented in server/.env.example and passed
// through by docker-compose.deploy.yml and .github/workflows/cd.yml:
//
//   SMTP_HOST  SMTP_PORT  SMTP_SECURE  SMTP_USER  SMTP_PASS  EMAIL_FROM
//
// The former aliases (EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE, EMAIL_USER, EMAIL_PASS,
// SMTP_PASSWORD, SMTP_FROM, EMAIL_FROM_ADDRESS, EMAIL_FROM_NAME, SENDER_EMAIL) are
// deliberately gone. mailer.js and email.service.js resolved them in opposite orders,
// so setting one twin of a pair silently routed OTP mail and order mail through
// different servers. email.service.js also ended its chains with hardcoded ethereal
// test credentials, which turned a missing variable into an authentication failure
// against the real host rather than a clear "not configured" error.

const REQUIRED_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM'];

function missingKeys() {
  return REQUIRED_KEYS.filter((key) => !String(process.env[key] || '').trim());
}

// Callers use this to choose between sending and the dev log fallback, so it must not throw.
function isConfigured() {
  return missingKeys().length === 0;
}

function describeMissing() {
  return `SMTP is not configured. Missing: ${missingKeys().join(', ')}`;
}

// Throws rather than defaulting: a wrong-but-plausible fallback is what made the previous
// misconfiguration invisible. Guard with isConfigured() where a miss is tolerable.
function getMailConfig() {
  if (!isConfigured()) {
    throw new Error(describeMissing());
  }

  const port = Number(process.env.SMTP_PORT);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`SMTP_PORT must be a positive integer, got "${process.env.SMTP_PORT}"`);
  }

  const secure =
    process.env.SMTP_SECURE !== undefined && String(process.env.SMTP_SECURE).trim() !== ''
      ? String(process.env.SMTP_SECURE).toLowerCase() === 'true'
      : port === 465;

  return {
    host: process.env.SMTP_HOST.trim(),
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER.trim(),
      // Gmail app passwords are commonly copied in "xxxx xxxx xxxx xxxx" display form.
      // Both forms authenticate, but strip so the value round-trips consistently.
      pass: process.env.SMTP_PASS.replace(/\s/g, ''),
    },
  };
}

// EMAIL_FROM is a full mailbox ("Name <addr@host>"), which is what the deploy pipeline
// passes. Wrapping it in another display name yields `"AutoMatrix" <AutoMatrix <addr>>`,
// which is not a valid From header, so only add a name for a bare address.
function getFromAddress() {
  const configured = String(process.env.EMAIL_FROM || '').trim();
  if (!configured) {
    throw new Error('SMTP is not configured. Missing: EMAIL_FROM');
  }

  return configured.includes('<') ? configured : `"AutoMatrix" <${configured}>`;
}

module.exports = {
  REQUIRED_KEYS,
  missingKeys,
  isConfigured,
  describeMissing,
  getMailConfig,
  getFromAddress,
};
