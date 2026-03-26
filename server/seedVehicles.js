require('dotenv').config();
const mongoose = require('mongoose');
const config = require('./config/config');

// Import models
const VehicleBrand = require('./models/vehicleBrand.model');
const VehicleModel = require('./models/vehicleModel.model');
const VehicleVariant = require('./models/vehicleVariant.model');
const Vehicle = require('./models/vehicle');

const sampleVehicles = [
  {
    brand: 'Toyota',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Toyota_EU_logo.svg/1200px-Toyota_EU_logo.svg.png',
    models: [
      {
        name: 'Camry',
        variants: [
          { name: 'LE', yearStart: 2018, yearEnd: 2024, engine: '2.5L 4-Cylinder' },
          { name: 'XSE', yearStart: 2018, yearEnd: 2024, engine: '3.5L V6' }
        ]
      },
      {
        name: 'Corolla',
        variants: [
          { name: 'LE', yearStart: 2019, yearEnd: 2024, engine: '1.8L 4-Cylinder' },
          { name: 'SE', yearStart: 2019, yearEnd: 2024, engine: '2.0L 4-Cylinder' }
        ]
      }
    ]
  },
  {
    brand: 'Honda',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Honda_Logo.svg/1200px-Honda_Logo.svg.png',
    models: [
      {
        name: 'Civic',
        variants: [
          { name: 'EX', yearStart: 2016, yearEnd: 2021, engine: '2.0L 4-Cylinder' },
          { name: 'Touring', yearStart: 2016, yearEnd: 2021, engine: '1.5L Turbo' }
        ]
      },
      {
        name: 'CR-V',
        variants: [
          { name: 'EX-L', yearStart: 2017, yearEnd: 2022, engine: '1.5L Turbo' }
        ]
      }
    ]
  },
  {
    brand: 'Ford',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Ford_logo_flat.svg/1200px-Ford_logo_flat.svg.png',
    models: [
      {
        name: 'F-150',
        variants: [
          { name: 'XLT', yearStart: 2015, yearEnd: 2020, engine: '3.5L EcoBoost V6' },
          { name: 'Lariat', yearStart: 2021, yearEnd: 2024, engine: '5.0L V8' }
        ]
      }
    ]
  },
  {
    brand: 'BMW',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/BMW.svg/2048px-BMW.svg.png',
    models: [
      {
        name: '3 Series',
        variants: [
          { name: '330i', yearStart: 2019, yearEnd: 2024, engine: '2.0L Turbo 4-Cyl' },
          { name: 'M340i', yearStart: 2020, yearEnd: 2024, engine: '3.0L Turbo 6-Cyl' }
        ]
      },
      {
        name: 'X5',
        variants: [
          { name: 'xDrive40i', yearStart: 2019, yearEnd: 2024, engine: '3.0L Turbo 6-Cyl' }
        ]
      }
    ]
  }
];

async function seedVehicles() {
  const { MONGO_IP, MONGO_PORT, MONGO_USER, MONGO_PASSWORD, MONGO_DB } = config;
  const uri = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    // Clear existing data? Or just upsert?
    // Let's upsert to be safe and additive.

    for (const brandData of sampleVehicles) {
      // 1. Create/Find Brand
      let brand = await VehicleBrand.findOne({ name: brandData.brand });
      if (!brand) {
        brand = await VehicleBrand.create({
          name: brandData.brand,
          logoUrl: brandData.logo
        });
        console.log(`Created Brand: ${brand.name}`);
      } else {
        console.log(`Found Brand: ${brand.name}`);
      }

      for (const modelData of brandData.models) {
        // 2. Create/Find Model
        let model = await VehicleModel.findOne({ brand: brand._id, name: modelData.name });
        if (!model) {
          model = await VehicleModel.create({
            brand: brand._id,
            name: modelData.name
          });
          console.log(`  Created Model: ${model.name}`);
        } else {
          console.log(`  Found Model: ${model.name}`);
        }

        for (const variantData of modelData.variants) {
          // 3. Create/Find Variant
          let variant = await VehicleVariant.findOne({
            model: model._id,
            name: variantData.name,
            yearStart: variantData.yearStart
          });

          if (!variant) {
            variant = await VehicleVariant.create({
              model: model._id,
              name: variantData.name,
              yearStart: variantData.yearStart,
              yearEnd: variantData.yearEnd
            });
            console.log(`    Created Variant: ${variant.name} (${variantData.yearStart}-${variantData.yearEnd || 'Now'})`);
          } else {
            console.log(`    Found Variant: ${variant.name}`);
          }

          // 4. Create Flattened "Vehicle" entries for each year in the range
          // This is for the product compatibility logic (Vehicle schema)
          const start = variantData.yearStart;
          const end = variantData.yearEnd || new Date().getFullYear();

          for (let year = start; year <= end; year++) {
            const vehicleData = {
              year: year,
              make: brandData.brand,
              model: modelData.name,
              submodel: variantData.name,
              engine: variantData.engine
            };

            // Check uniqueness using findOne with all fields
            // The schema has a unique index on these fields, so create might fail if we don't check
            let existingVehicle = await Vehicle.findOne({
              year: vehicleData.year,
              make: vehicleData.make,
              model: vehicleData.model,
              submodel: vehicleData.submodel,
              engine: vehicleData.engine
            });

            if (!existingVehicle) {
              try {
                await Vehicle.create(vehicleData);
                console.log(`      -> Created Flattened Vehicle: ${year} ${brandData.brand} ${modelData.name} ${variantData.name}`);
              } catch (e) {
                  // Ignore duplicate key errors if race condition or index match
                  if (e.code !== 11000) console.error('Error creating flattened vehicle:', e);
              }
            }
          }
        }
      }
    }

    console.log('Vehicle Seeding Completed Successfully');
    process.exit(0);

  } catch (error) {
    console.error('Error seeding vehicles:', error);
    process.exit(1);
  }
}

seedVehicles();
