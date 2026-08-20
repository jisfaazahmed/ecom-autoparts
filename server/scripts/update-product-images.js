/**
 * Assigns matching stock image URLs to products missing images.
 * Run: node scripts/update-product-images.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const config = require('../config/config');
const Product = require('../models/product');

const IMG = (id, source = 'unsplash') =>
  source === 'pexels'
    ? `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=800`
    : `https://images.unsplash.com/photo-${id}?w=800&q=80`;

/** SKU -> image URL (free Unsplash/Pexels, matched by part type) */
const PRODUCT_IMAGES = {
  'BOSCH-BRK-PAD-0986-AB1234': IMG('1710464081714-4ed52a70ca5f'), // brake pads
  'ATE-BRK-ROT-24A01234': IMG('1760317890314-e964ffd7e6a6'), // brake rotor
  'MOBIL1-FLD-5W30-5QT': IMG('1635437536607-b8572f443763'), // motor oil bottles
  'CASTROL-FLD-ATF-MULTI-1GAL': IMG('1746014995485-e8a698f39804'), // fluid bottle
  'MANN-FLTR-AIR-C3898': IMG('1720929617042-ac3ea5a6d1e2'), // engine air filter
  'DENSO-FLTR-CABIN-4531012': IMG('1777118947168-b6e806cb80cf'), // pleated filter
  'NGK-ENG-PLUG-ILZKR7B11S': IMG('1760713174351-4e7350ff797e'), // spark plug
  'FELPRO-ENG-GASKET-VC72847': IMG('1763848843613-f8c2ca3a31a1'), // engine block / gasket area
  'MONROE-SUS-STRUT-172312': IMG('1764869427688-3e97480f4b82'), // suspension / strut
  'MOOG-SUS-CARM-RK620123': IMG('4489720', 'pexels'), // automotive workshop / parts
  'BOSCH-ELEC-BATT-S6-48': IMG('6473244', 'pexels'), // car battery
  'HELLA-ELEC-SNSR-O2-3167': IMG('1486262715619-67b85e0b08d3'), // engine bay (sensor location)
};

async function run() {
  const { MONGO_IP, MONGO_PORT, MONGO_USER, MONGO_PASSWORD, MONGO_DB } = config;
  const uri = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;

  await mongoose.connect(uri);
  console.log('Connected to MongoDB\n');

  let updated = 0;
  for (const [sku, imageUrl] of Object.entries(PRODUCT_IMAGES)) {
    const result = await Product.updateOne(
      { sku },
      { $set: { image: imageUrl } }
    );
    if (result.matchedCount === 0) {
      console.warn(`  [skip] SKU not found: ${sku}`);
      continue;
    }
    if (result.modifiedCount > 0) {
      updated += 1;
      console.log(`  [ok] ${sku}`);
    } else {
      console.log(`  [unchanged] ${sku}`);
    }
  }

  const missing = await Product.find({
    $or: [{ image: null }, { image: '' }],
  }).select('name sku').lean();
  if (missing.length) {
    console.log('\nProducts still without images:');
    missing.forEach((p) => console.log(`  - ${p.name} (${p.sku})`));
  } else {
    console.log('\nAll products now have images.');
  }

  console.log(`\nUpdated ${updated} product(s).`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
