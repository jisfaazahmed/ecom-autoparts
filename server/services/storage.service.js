// One place that knows where uploaded files live.
//
// Two backends, same API:
//
//   R2      - used whenever the R2_* env vars are set. Objects go to Cloudflare
//             R2, so the server container holds no user data and a redeploy
//             (which destroys the container) loses nothing.
//   disk    - the fallback for local development. Writes under server/uploads/
//             exactly like the pre-R2 code did.
//
// Callers deal in *keys* ("products/1712-abc.jpg"), never in absolute paths or
// hostnames. Public keys turn into a CDN URL via publicUrlFor(); private keys
// (invoices, labels) are never handed out directly - they are either streamed
// back through an authorised route or wrapped in a short-lived presigned URL.
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const r2 = require('../config/r2');

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

// Anything customers must be able to load straight from the CDN.
const PUBLIC_FOLDERS = ['products', 'avatars', 'categories', 'brands', 'shops', 'misc'];
// Anything that needs an authorisation check before it is handed over.
const PRIVATE_FOLDERS = ['invoices', 'labels'];

const isRemote = () => r2.isR2Configured;

const isPublicFolder = (folder) => PUBLIC_FOLDERS.includes(folder);

// Object keys are user-influenced (folder comes from a query param, the name
// from a filename), so refuse anything that could climb out of its prefix.
function assertSafeKey(key) {
  const value = String(key || '');
  // Allow only the shape we generate: folder/name.ext - no leading slash, no traversal.
  if (!value || !/^[A-Za-z0-9][A-Za-z0-9/._-]*$/.test(value) || value.includes('..')) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
  return value;
}

function buildKey(folder, fileName) {
  return assertSafeKey(`${folder}/${fileName}`);
}

// A collision-proof name that keeps the original extension (browsers and the
// CDN both key content type off it).
function randomFileName(originalName = '') {
  const ext = path.extname(originalName).toLowerCase();
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
}

// Where disk mode serves from. index.js mounts uploads/ at /uploads and
// uploads/labels at /labels.
function diskBaseUrl() {
  const configured = process.env.SERVER_PUBLIC_URL;
  if (configured) return configured.replace(/\/+$/, '');
  return `http://localhost:${process.env.PORT || 5000}`;
}

function diskPathFor(key) {
  return path.join(UPLOADS_ROOT, ...assertSafeKey(key).split('/'));
}

// Public URL for a key. Private keys have no public URL by definition - callers
// want getSignedDownloadUrl() or openStream() instead.
function publicUrlFor(key) {
  assertSafeKey(key);
  if (isRemote()) {
    if (!r2.publicUrl) {
      // Without a custom domain there is no URL a browser can fetch, since the
      // S3 endpoint rejects unsigned GETs. Fail loudly rather than persisting a
      // URL that 401s forever.
      throw new Error('R2_PUBLIC_URL is not set - cannot build a public URL for R2 objects');
    }
    return `${r2.publicUrl}/${key}`;
  }
  return `${diskBaseUrl()}/uploads/${key}`;
}

async function put({ key, body, contentType }) {
  assertSafeKey(key);

  if (isRemote()) {
    await r2.getR2Client().send(new PutObjectCommand({
      Bucket: r2.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
    return { key, storage: 'r2' };
  }

  const target = diskPathFor(key);
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.writeFile(target, body);
  return { key, storage: 'disk' };
}

// Convenience wrapper for the upload endpoints: store a public asset and return
// the URL to persist alongside the product/shop/user document.
async function putPublic({ folder, fileName, body, contentType }) {
  const key = buildKey(folder, fileName || randomFileName());
  await put({ key, body, contentType });
  return { key, url: publicUrlFor(key) };
}

async function exists(key) {
  assertSafeKey(key);

  if (isRemote()) {
    try {
      await r2.getR2Client().send(new HeadObjectCommand({ Bucket: r2.bucket, Key: key }));
      return true;
    } catch (error) {
      // The SDK reports a missing object as NotFound/404; anything else is a
      // real failure (bad credentials, network) and should not read as "absent".
      if (error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404) return false;
      throw error;
    }
  }

  return fs.existsSync(diskPathFor(key));
}

// Size and last-modified for a stored object, or null when it is absent.
async function stat(key) {
  assertSafeKey(key);

  if (isRemote()) {
    try {
      const head = await r2.getR2Client().send(new HeadObjectCommand({ Bucket: r2.bucket, Key: key }));
      return { size: head.ContentLength || 0, lastModified: head.LastModified || null };
    } catch (error) {
      if (error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404) return null;
      throw error;
    }
  }

  const target = diskPathFor(key);
  if (!fs.existsSync(target)) return null;
  const stats = fs.statSync(target);
  return { size: stats.size, lastModified: stats.mtime };
}

// Readable stream for a stored object, for routes that check authorisation and
// then pipe the bytes themselves.
async function openStream(key) {
  assertSafeKey(key);

  if (isRemote()) {
    const result = await r2.getR2Client().send(new GetObjectCommand({
      Bucket: r2.bucket,
      Key: key,
    }));
    return result.Body;
  }

  const target = diskPathFor(key);
  if (!fs.existsSync(target)) throw new Error(`File not found: ${key}`);
  return fs.createReadStream(target);
}

async function remove(key) {
  assertSafeKey(key);

  if (isRemote()) {
    await r2.getR2Client().send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: key }));
    return;
  }

  const target = diskPathFor(key);
  if (fs.existsSync(target)) await fsp.unlink(target);
}

// Temporary GET URL for a private object. Used for shipping labels, where the
// URL is handed to an already-authorised dashboard and expires shortly after.
// In disk mode there is nothing to sign, so this returns the static URL - the
// same exposure the pre-R2 code had, and only in local development.
async function getSignedDownloadUrl(key, { expiresIn = 600, fileName } = {}) {
  assertSafeKey(key);

  if (!isRemote()) {
    return `${diskBaseUrl()}/uploads/${key}`;
  }

  const command = new GetObjectCommand({
    Bucket: r2.bucket,
    Key: key,
    ...(fileName
      ? { ResponseContentDisposition: `attachment; filename="${fileName}"` }
      : {}),
  });

  return getSignedUrl(r2.getR2Client(), command, { expiresIn });
}

module.exports = {
  PUBLIC_FOLDERS,
  PRIVATE_FOLDERS,
  isRemote,
  isPublicFolder,
  buildKey,
  randomFileName,
  publicUrlFor,
  put,
  putPublic,
  exists,
  stat,
  openStream,
  remove,
  getSignedDownloadUrl,
  diskPathFor,
};
