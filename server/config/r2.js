// Cloudflare R2 client.
//
// R2 speaks the S3 API, so this is a plain AWS SDK v3 S3Client pointed at the
// account's R2 endpoint with region "auto" (R2 has no regions).
//
// Every value is optional on purpose: when the R2_* variables are absent the
// storage service falls back to the local uploads/ directory, so a fresh clone
// still runs `npm run dev` without a Cloudflare account. Production must set
// them - without them uploads live in the container filesystem and are lost on
// every deploy.
const { S3Client } = require('@aws-sdk/client-s3');

const accountId = process.env.R2_ACCOUNT_ID || '';
const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
const bucket = process.env.R2_BUCKET_NAME || '';

// https://<ACCOUNT_ID>.r2.cloudflarestorage.com is the documented S3 endpoint.
// R2_ENDPOINT stays overridable for jurisdiction-specific endpoints (EU/FedRAMP).
const endpoint = process.env.R2_ENDPOINT
  || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');

// The custom domain in front of the bucket (media.example.com). Public object
// URLs are built from this - never from the endpoint above, which requires
// signed requests. Trailing slash trimmed so `${publicUrl}/${key}` is safe.
const publicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');

const isR2Configured = Boolean(endpoint && accessKeyId && secretAccessKey && bucket);

let client = null;

// Lazily constructed: requiring this file must never throw, because index.js
// pulls in the whole route tree at boot even on machines with no R2 setup.
function getR2Client() {
  if (!isR2Configured) return null;
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return client;
}

module.exports = {
  getR2Client,
  isR2Configured,
  bucket,
  endpoint,
  publicUrl,
};
