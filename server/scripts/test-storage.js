/**
 * Storage smoke test - no MongoDB required.
 *
 * Exercises services/storage.service.js against whichever backend is configured:
 * Cloudflare R2 when the R2_* variables are set (the real round trip, including
 * a presigned download), otherwise the local-disk fallback.
 *
 *   node scripts/test-storage.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const storage = require('../services/storage.service');
const r2 = require('../config/r2');

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`✓ ${name}`);
  } else {
    failed += 1;
    console.log(`✗ ${name}${detail ? ` - ${detail}` : ''}`);
  }
}

async function expectThrows(name, fn) {
  try {
    await fn();
    check(name, false, 'expected it to throw');
  } catch {
    check(name, true);
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log(`STORAGE SERVICE - backend: ${storage.isRemote() ? `R2 (${r2.bucket})` : 'local disk'}`);
  console.log('='.repeat(70));

  // Key validation: the folder comes from a query param, so traversal attempts
  // must be rejected before they reach the backend.
  await expectThrows('rejects ../ traversal', async () => storage.buildKey('products', '../../etc/passwd'));
  await expectThrows('rejects absolute key', async () => storage.put({ key: '/etc/passwd', body: 'x' }));
  check('builds a normal key', storage.buildKey('products', 'a-1.jpg') === 'products/a-1.jpg');
  check('random name keeps the extension', storage.randomFileName('brake pad.JPG').endsWith('.jpg'));

  const key = storage.buildKey('misc', `storage-selftest-${Date.now()}.png`);
  const body = Buffer.from('smoke-test-bytes');

  const before = await storage.exists(key);
  check('object absent before write', before === false);

  await storage.put({ key, body, contentType: 'image/png' });
  check('object exists after write', await storage.exists(key));

  const stats = await storage.stat(key);
  check('stat reports the right size', stats && stats.size === body.length, stats ? `got ${stats.size}` : 'got null');

  const stream = await storage.openStream(key);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  check('stream returns the same bytes', Buffer.concat(chunks).toString() === body.toString());

  if (storage.isRemote()) {
    const url = await storage.getSignedDownloadUrl(key, { expiresIn: 60 });
    check('signed URL is signed', url.includes('X-Amz-Signature'), url.slice(0, 80));
  } else {
    check('public URL uses the local /uploads mount', storage.publicUrlFor(key).includes('/uploads/misc/'));
  }

  await storage.remove(key);
  check('object gone after remove', (await storage.exists(key)) === false);

  // PDF generation must produce bytes without touching the filesystem.
  const invoiceService = require('../services/invoice.service');
  const pdf = await invoiceService.renderInvoiceBuffer({
    _id: 'selftest',
    orderNumber: 'ORD-SELFTEST',
    createdAt: new Date(),
    items: [{ productName: 'Brake Pad', quantity: 2, unitPrice: 2500, totalPrice: 5000 }],
    totalAmount: 5000,
  });
  check('invoice renders to a PDF buffer', Buffer.isBuffer(pdf) && pdf.slice(0, 4).toString() === '%PDF');

  const shippingService = require('../services/shipping.service');
  const label = await shippingService.renderLabelBuffer({
    _id: 'selftest',
    trackingNumber: 'PRO2508201234567',
    order: { orderNumber: 'ORD-SELFTEST' },
    shippingAddress: { fullName: 'Test Customer', city: 'Colombo' },
  });
  check('label renders to a PDF buffer', Buffer.isBuffer(label) && label.slice(0, 4).toString() === '%PDF');

  console.log('='.repeat(70));
  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
