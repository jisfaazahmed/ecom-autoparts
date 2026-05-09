require('dotenv').config();
const mongoose = require('mongoose');
const slugify = require('slugify');
const config = require('./config/config');

const Category = require('./models/category');
const Product = require('./models/product');
const Vehicle = require('./models/vehicle');
const User = require('./models/user');

const curatedCategories = [
  { name: 'Brakes', description: 'Brake pads, rotors, fluid, and wear components.' },
  { name: 'Engine', description: 'Ignition, gaskets, timing, and performance engine parts.' },
  { name: 'Filters', description: 'Air, cabin, oil, and fuel filters.' },
  { name: 'Suspension', description: 'Shocks, struts, control arms, and ride stability parts.' },
  { name: 'Electrical', description: 'Batteries, alternators, sensors, and lighting components.' },
  { name: 'Fluids', description: 'Engine oils, transmission fluids, and coolants.' },
];

const curatedProducts = [
  {
    sku: 'BOSCH-BRK-PAD-0986-AB1234',
    name: 'Bosch QuietCast Ceramic Front Brake Pad Set',
    description: 'Ceramic front pad kit for low-noise daily use and stable stopping performance.',
    price: 84,
    stock: 80,
    categoryName: 'Brakes',
    fitment: [{ make: 'Toyota', model: 'Camry', submodel: 'LE', year: 2024 }],
    image: '',
  },
  {
    sku: 'ATE-BRK-ROT-24A01234',
    name: 'ATE Coated Front Brake Rotor Pair',
    description: 'Corrosion-resistant coated front rotors designed for reduced brake judder.',
    price: 146,
    stock: 56,
    categoryName: 'Brakes',
    fitment: [{ make: 'Honda', model: 'Civic', submodel: 'EX', year: 2024 }],
    image: '',
  },
  {
    sku: 'MOBIL1-FLD-5W30-5QT',
    name: 'Mobil 1 Advanced Full Synthetic 5W-30 (5qt)',
    description: 'Full synthetic engine oil for modern gasoline engines and extended drain intervals.',
    price: 41,
    stock: 120,
    categoryName: 'Fluids',
    fitment: [
      { make: 'Toyota', model: 'Camry', submodel: 'LE', year: 2025 },
      { make: 'Nissan', model: 'Altima', submodel: 'SV', year: 2024 },
    ],
    image: '',
  },
  {
    sku: 'CASTROL-FLD-ATF-MULTI-1GAL',
    name: 'Castrol Transmax Multi-Vehicle ATF (1 gal)',
    description: 'Synthetic automatic transmission fluid for broad multi-vehicle compatibility.',
    price: 32,
    stock: 75,
    categoryName: 'Fluids',
    fitment: [{ make: 'Ford', model: 'F-150', submodel: 'XLT', year: 2024 }],
    image: '',
  },
  {
    sku: 'MANN-FLTR-AIR-C3898',
    name: 'MANN-Filter Engine Air Filter C 38 98',
    description: 'High-dust-capacity intake filter for improved airflow and engine protection.',
    price: 22,
    stock: 95,
    categoryName: 'Filters',
    fitment: [{ make: 'Volkswagen', model: 'Tiguan', submodel: 'S', year: 2024 }],
    image: '',
  },
  {
    sku: 'DENSO-FLTR-CABIN-4531012',
    name: 'DENSO Cabin Air Filter',
    description: 'Pollen and particulate filtration for interior cabin comfort.',
    price: 19,
    stock: 110,
    categoryName: 'Filters',
    fitment: [{ make: 'Hyundai', model: 'Elantra', submodel: 'SEL', year: 2024 }],
    image: '',
  },
  {
    sku: 'NGK-ENG-PLUG-ILZKR7B11S',
    name: 'NGK Iridium Spark Plug Set',
    description: 'Long-life iridium spark plug set engineered for efficient ignition.',
    price: 68,
    stock: 62,
    categoryName: 'Engine',
    fitment: [{ make: 'Honda', model: 'CR-V', submodel: 'EX-L', year: 2024 }],
    image: '',
  },
  {
    sku: 'FELPRO-ENG-GASKET-VC72847',
    name: 'Fel-Pro Valve Cover Gasket Set',
    description: 'Precision-molded gasket set for leak prevention and reliable sealing.',
    price: 37,
    stock: 48,
    categoryName: 'Engine',
    fitment: [{ make: 'Nissan', model: 'Rogue', submodel: 'SV', year: 2024 }],
    image: '',
  },
  {
    sku: 'MONROE-SUS-STRUT-172312',
    name: 'Monroe Quick-Strut Front Assembly',
    description: 'Pre-assembled strut unit for fast replacement and restored ride quality.',
    price: 133,
    stock: 50,
    categoryName: 'Suspension',
    fitment: [{ make: 'Toyota', model: 'RAV4', submodel: 'LE', year: 2024 }],
    image: '',
  },
  {
    sku: 'MOOG-SUS-CARM-RK620123',
    name: 'MOOG Front Lower Control Arm',
    description: 'Heavy-duty control arm with precision bushings and improved durability.',
    price: 118,
    stock: 44,
    categoryName: 'Suspension',
    fitment: [{ make: 'Kia', model: 'Sportage', submodel: 'LX', year: 2024 }],
    image: '',
  },
  {
    sku: 'BOSCH-ELEC-BATT-S6-48',
    name: 'Bosch S6 AGM Battery Group 48',
    description: 'High-cycle AGM battery with strong cold cranking performance.',
    price: 219,
    stock: 30,
    categoryName: 'Electrical',
    fitment: [{ make: 'BMW', model: '3 Series', submodel: '330i', year: 2024 }],
    image: '',
  },
  {
    sku: 'HELLA-ELEC-SNSR-O2-3167',
    name: 'HELLA Oxygen Sensor Upstream',
    description: 'Fast-response oxygen sensor for emission control and fuel efficiency.',
    price: 72,
    stock: 66,
    categoryName: 'Electrical',
    fitment: [{ make: 'Audi', model: 'A4', submodel: 'Premium', year: 2024 }],
    image: '',
  },
];

const toVehicleQuery = (fitment) => ({
  year: fitment.year,
  make: fitment.make,
  model: fitment.model,
  ...(fitment.submodel ? { submodel: fitment.submodel } : {}),
});

async function ensureCategory(categoryData) {
  const slug = slugify(categoryData.name, { lower: true, strict: true });
  const existing = await Category.findOne({ slug });

  if (!existing) {
    const created = await Category.create({
      name: categoryData.name,
      slug,
      description: categoryData.description || null,
      parent: null,
    });
    console.log(`Created category: ${created.name}`);
    return created;
  }

  let hasChanges = false;
  if (existing.name !== categoryData.name) {
    existing.name = categoryData.name;
    hasChanges = true;
  }
  if ((existing.description || null) !== (categoryData.description || null)) {
    existing.description = categoryData.description || null;
    hasChanges = true;
  }
  if (existing.parent !== null) {
    existing.parent = null;
    hasChanges = true;
  }
  if (hasChanges) {
    await existing.save();
    console.log(`Updated category: ${existing.name}`);
  } else {
    console.log(`Found category: ${existing.name}`);
  }

  return existing;
}

async function resolveFitments(fitmentRows) {
  const resolvedIds = [];

  for (const fitment of fitmentRows) {
    const vehicle = await Vehicle.findOne(toVehicleQuery(fitment)).select('_id');
    if (vehicle) {
      resolvedIds.push(vehicle._id);
    } else {
      console.log(
        `Missing fitment vehicle, skipping link: ${fitment.year} ${fitment.make} ${fitment.model} ${fitment.submodel || ''}`.trim()
      );
    }
  }

  return resolvedIds;
}

async function seedProducts() {
  const { MONGO_IP, MONGO_PORT, MONGO_USER, MONGO_PASSWORD, MONGO_DB } = config;
  const uri = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const vendors = await User.find({ role: 'ADMIN' }).select('_id name email shopName').sort({ createdAt: 1 });
    if (!vendors.length) {
      throw new Error('No vendor users found (role ADMIN). Create at least one vendor before running seed:products.');
    }
    console.log(`Found ${vendors.length} vendor user(s) for product ownership`);

    const categoryMap = new Map();
    for (const category of curatedCategories) {
      const ensured = await ensureCategory(category);
      categoryMap.set(category.name, ensured);
    }

    let insertedCount = 0;
    let updatedCount = 0;

    for (let index = 0; index < curatedProducts.length; index += 1) {
      const item = curatedProducts[index];
      const category = categoryMap.get(item.categoryName);
      if (!category) {
        console.log(`Category not found for SKU ${item.sku}, skipping`);
        continue;
      }
      const vendor = vendors[index % vendors.length];

      const compatibleVehicles = await resolveFitments(item.fitment || []);
      const payload = {
        name: item.name,
        description: item.description,
        price: item.price,
        stock: item.stock,
        sku: item.sku,
        image: item.image || '',
        category: category._id,
        compatibleVehicles,
        createdBy: vendor._id,
        isActive: true,
        status: 'Approved',
      };

      const result = await Product.updateOne({ sku: item.sku }, { $set: payload }, { upsert: true });
      if (result.upsertedCount > 0) {
        insertedCount += 1;
        console.log(`Inserted product: ${item.sku} (owner: ${vendor.shopName || vendor.name || vendor.email})`);
      } else if (result.modifiedCount > 0) {
        updatedCount += 1;
        console.log(`Updated product: ${item.sku} (owner: ${vendor.shopName || vendor.name || vendor.email})`);
      } else {
        console.log(`No changes for product: ${item.sku}`);
      }
    }

    console.log(`Products seed complete. Inserted: ${insertedCount}, Updated: ${updatedCount}, Total curated: ${curatedProducts.length}`);
    process.exit(0);
  } catch (err) {
    console.error('Product seed failed:', err.message || err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seedProducts();
