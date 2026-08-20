// One-off migration: copy everything under server/uploads/ into Cloudflare R2
// and repoint the URLs stored in MongoDB at the media domain.
//
// Run it once, from a machine that still has the files (i.e. before the next
// deploy destroys the container):
//
//   node scripts/migrate-uploads-to-r2.js            # dry run - reports only
//   node scripts/migrate-uploads-to-r2.js --apply    # upload + rewrite the DB
//
// Safe to re-run: objects are re-uploaded (same key, same bytes) and the URL
// rewrite only matches paths that still point at /uploads/.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const fs = require('fs');
const fsp = require('fs/promises');
const mongoose = require('mongoose');
const r2 = require('../config/r2');
const storage = require('../services/storage.service');

const APPLY = process.argv.includes('--apply');
const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

// Documents that hold an uploaded-file URL. Array fields are handled by the
// same code path - each element is rewritten in place.
const URL_FIELDS = [
  { model: '../models/product', label: 'Product', fields: ['image'] },
  { model: '../models/ProductSeller', label: 'ProductSeller', fields: ['images'] },
  { model: '../models/category', label: 'Category', fields: ['icon', 'image'] },
  { model: '../models/user', label: 'User', fields: ['logoUrl', 'avatarUrl'] },
  { model: '../models/orderItem.model', label: 'OrderItem', fields: ['image'] },
];

const CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};

function contentTypeFor(file) {
  return CONTENT_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

async function walk(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile() && entry.name !== '.gitkeep') files.push(full);
  }
  return files;
}

async function uploadFiles() {
  if (!fs.existsSync(UPLOADS_ROOT)) {
    console.log('No uploads/ directory - nothing to copy.');
    return { uploaded: 0, failed: 0 };
  }

  const files = await walk(UPLOADS_ROOT);
  console.log(`Found ${files.length} file(s) under uploads/`);

  let uploaded = 0;
  let failed = 0;

  for (const file of files) {
    // Key mirrors the on-disk layout: uploads/products/x.jpg -> products/x.jpg
    const key = path.relative(UPLOADS_ROOT, file).split(path.sep).join('/');

    if (!APPLY) {
      console.log(`  would upload ${key}`);
      uploaded += 1;
      continue;
    }

    try {
      await storage.put({
        key,
        body: await fsp.readFile(file),
        contentType: contentTypeFor(file),
      });
      console.log(`  uploaded ${key}`);
      uploaded += 1;
    } catch (error) {
      console.error(`  FAILED ${key}: ${error.message}`);
      failed += 1;
    }
  }

  return { uploaded, failed };
}

// Turns any stored URL that points at the old server-hosted path into the media
// domain equivalent: http://api.example.com/uploads/products/x.jpg (or a bare
// /uploads/products/x.jpg) becomes https://media.example.com/products/x.jpg.
function rewriteUrl(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/\/uploads\/(.+)$/);
  if (!match) return null;

  const key = match[1];
  const rewritten = `${r2.publicUrl}/${key}`;
  return rewritten === value ? null : rewritten;
}

async function rewriteDatabase() {
  const summary = [];

  for (const entry of URL_FIELDS) {
    let Model;
    try {
      Model = require(entry.model);
    } catch (error) {
      console.warn(`Skipping ${entry.label}: ${error.message}`);
      continue;
    }

    const query = { $or: entry.fields.map((field) => ({ [field]: /\/uploads\// })) };
    const docs = await Model.find(query);
    let changed = 0;

    for (const doc of docs) {
      let touched = false;

      for (const field of entry.fields) {
        const value = doc[field];

        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            const next = rewriteUrl(item);
            if (next) {
              value[index] = next;
              touched = true;
            }
          });
          if (touched) doc.markModified(field);
        } else {
          const next = rewriteUrl(value);
          if (next) {
            doc[field] = next;
            touched = true;
          }
        }
      }

      if (!touched) continue;
      changed += 1;
      // validateBeforeSave stays off: these are old documents that may predate
      // later required-field additions, and this migration only touches URLs.
      if (APPLY) await doc.save({ validateBeforeSave: false });
    }

    summary.push(`${entry.label}: ${changed} document(s) ${APPLY ? 'updated' : 'would be updated'}`);
  }

  return summary;
}

async function main() {
  if (!r2.isR2Configured) {
    console.error('R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME first.');
    process.exit(1);
  }
  if (!r2.publicUrl) {
    console.error('R2_PUBLIC_URL is not set - there would be no public URL to rewrite image links to.');
    process.exit(1);
  }

  console.log(APPLY ? 'Running migration (--apply)' : 'DRY RUN - re-run with --apply to make changes');
  console.log(`Bucket: ${r2.bucket}  Media domain: ${r2.publicUrl}`);

  const { uploaded, failed } = await uploadFiles();

  if (failed > 0 && APPLY) {
    console.error(`\n${failed} upload(s) failed - stopping before the database rewrite so URLs keep pointing at files that still exist.`);
    process.exit(1);
  }

  const mongoUri = process.env.MONGO_URI || buildMongoUri();
  await mongoose.connect(mongoUri);

  const summary = await rewriteDatabase();

  await mongoose.disconnect();

  console.log('\nSummary');
  console.log(`  files ${APPLY ? 'uploaded' : 'to upload'}: ${uploaded}`);
  summary.forEach((line) => console.log(`  ${line}`));

  if (!APPLY) console.log('\nNothing was changed. Re-run with --apply.');
}

// Same shape index.js builds, so the script works with either MONGO_URI or the
// individual MONGO_* variables the deploy passes.
function buildMongoUri() {
  const { MONGO_USER, MONGO_PASSWORD, MONGO_IP, MONGO_PORT, MONGO_DB } = process.env;
  const auth = MONGO_USER && MONGO_PASSWORD
    ? `${encodeURIComponent(MONGO_USER)}:${encodeURIComponent(MONGO_PASSWORD)}@`
    : '';
  return `mongodb://${auth}${MONGO_IP}:${MONGO_PORT || 27017}/${MONGO_DB}?authSource=admin`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
