/**
 * Verify SMTP / email env and send a test message.
 * Usage: node scripts/test-smtp.js [recipient@email.com]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { sendSignupOtpEmail } = require('../services/mailer');

const to = process.argv[2] || process.env.SMTP_USER || process.env.EMAIL_USER;

async function main() {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const port = process.env.SMTP_PORT || process.env.EMAIL_PORT;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;

  console.log('SMTP host:', host || '(missing)');
  console.log('SMTP port:', port || '(missing)');
  console.log('SMTP user:', user || '(missing)');
  console.log('SMTP pass:', (process.env.SMTP_PASS || process.env.EMAIL_PASS) ? '[set]' : '(missing)');
  console.log('NODE_ENV:', process.env.NODE_ENV || '(unset)');
  console.log('Test recipient:', to || '(missing — pass email as argv[2])');

  if (!to) {
    console.error('\nProvide recipient: node scripts/test-smtp.js you@example.com');
    process.exit(1);
  }

  if (!host || !port) {
    console.error('\nSet EMAIL_HOST + EMAIL_PORT (or SMTP_HOST + SMTP_PORT) in server/.env');
    process.exit(1);
  }

  const otp = '123456';
  const result = await sendSignupOtpEmail({ to, otp, minutesValid: 10 });
  console.log('\nResult:', result);
  if (result.delivered === false) {
    console.log('Email was NOT sent (dev fallback — check server console for [DEV_MAILER] OTP).');
    process.exit(1);
  }
  console.log('Test OTP email sent successfully.');
}

main().catch((err) => {
  console.error('SMTP test failed:', err.message);
  if (err.response) console.error(err.response);
  process.exit(1);
});
