require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config/config');

// Import models
const VehicleBrand = require('../models/vehicleBrand.model');
const VehicleModel = require('../models/vehicleModel.model');
const VehicleVariant = require('../models/vehicleVariant.model');

const Vehicle = require('../models/vehicle');

const curatedVehicles = [
  {
    brand: 'Toyota',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Toyota_EU_logo.svg/1200px-Toyota_EU_logo.svg.png',
    models: [
      {
        name: 'Camry',
        variants: [
          { name: 'LE', yearStart: 2018, yearEnd: 2026, engine: '2.5L 4-Cylinder' },
          { name: 'XSE', yearStart: 2018, yearEnd: 2026, engine: '2.5L Hybrid' }
        ]
      },
      {
        name: 'RAV4',
        variants: [
          { name: 'LE', yearStart: 2019, yearEnd: 2026, engine: '2.5L 4-Cylinder' },
          { name: 'XLE Hybrid', yearStart: 2019, yearEnd: 2026, engine: '2.5L Hybrid' }
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
          { name: 'EX', yearStart: 2022, yearEnd: 2026, engine: '2.0L 4-Cylinder' },
          { name: 'Touring', yearStart: 2022, yearEnd: 2026, engine: '1.5L Turbo' }
        ]
      },
      {
        name: 'CR-V',
        variants: [
          { name: 'EX-L', yearStart: 2023, yearEnd: 2026, engine: '1.5L Turbo' },
          { name: 'Sport Touring', yearStart: 2023, yearEnd: 2026, engine: '2.0L Hybrid' }
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
          { name: 'XLT', yearStart: 2021, yearEnd: 2026, engine: '3.5L EcoBoost V6' },
          { name: 'Lariat', yearStart: 2021, yearEnd: 2026, engine: '5.0L V8' }
        ]
      },
      {
        name: 'Mustang',
        variants: [
          { name: 'EcoBoost', yearStart: 2024, yearEnd: 2026, engine: '2.3L Turbo 4-Cyl' },
          { name: 'GT', yearStart: 2024, yearEnd: 2026, engine: '5.0L V8' }
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
          { name: '330i', yearStart: 2019, yearEnd: 2026, engine: '2.0L Turbo 4-Cyl' },
          { name: 'M340i', yearStart: 2020, yearEnd: 2026, engine: '3.0L Turbo 6-Cyl' }
        ]
      },
      {
        name: 'X5',
        variants: [
          { name: 'xDrive40i', yearStart: 2019, yearEnd: 2026, engine: '3.0L Turbo 6-Cyl' },
          { name: 'xDrive50e', yearStart: 2024, yearEnd: 2026, engine: '3.0L Plug-in Hybrid' }
        ]
      }
    ]
  },
  {
    brand: 'Hyundai',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Hyundai_Motor_Company_logo.svg/2560px-Hyundai_Motor_Company_logo.svg.png',
    models: [
      {
        name: 'Elantra',
        variants: [
          { name: 'SEL', yearStart: 2021, yearEnd: 2026, engine: '2.0L 4-Cylinder' },
          { name: 'N Line', yearStart: 2021, yearEnd: 2026, engine: '1.6L Turbo' }
        ]
      },
      {
        name: 'Tucson',
        variants: [
          { name: 'SE', yearStart: 2022, yearEnd: 2026, engine: '2.5L 4-Cylinder' },
          { name: 'Limited Hybrid', yearStart: 2022, yearEnd: 2026, engine: '1.6L Hybrid' }
        ]
      }
    ]
  },
  {
    brand: 'Kia',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Kia_logo3.svg/2560px-Kia_logo3.svg.png',
    models: [
      {
        name: 'Sportage',
        variants: [
          { name: 'LX', yearStart: 2023, yearEnd: 2026, engine: '2.5L 4-Cylinder' },
          { name: 'EX Hybrid', yearStart: 2023, yearEnd: 2026, engine: '1.6L Hybrid' }
        ]
      },
      {
        name: 'Sorento',
        variants: [
          { name: 'S', yearStart: 2021, yearEnd: 2026, engine: '2.5L 4-Cylinder' },
          { name: 'SX Prestige', yearStart: 2021, yearEnd: 2026, engine: '2.5L Turbo 4-Cylinder' }
        ]
      }
    ]
  },
  {
    brand: 'Nissan',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Nissan_2020_logo.svg/2048px-Nissan_2020_logo.svg.png',
    models: [
      {
        name: 'Altima',
        variants: [
          { name: 'SV', yearStart: 2019, yearEnd: 2026, engine: '2.5L 4-Cylinder' },
          { name: 'SR VC-Turbo', yearStart: 2019, yearEnd: 2026, engine: '2.0L Turbo 4-Cylinder' }
        ]
      },
      {
        name: 'Rogue',
        variants: [
          { name: 'SV', yearStart: 2021, yearEnd: 2026, engine: '1.5L Turbo 3-Cylinder' },
          { name: 'Platinum', yearStart: 2021, yearEnd: 2026, engine: '1.5L Turbo 3-Cylinder' }
        ]
      }
    ]
  },
  {
    brand: 'Volkswagen',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Volkswagen_logo_2019.svg/2048px-Volkswagen_logo_2019.svg.png',
    models: [
      {
        name: 'Jetta',
        variants: [
          { name: 'Sport', yearStart: 2022, yearEnd: 2026, engine: '1.5L Turbo 4-Cylinder' },
          { name: 'SEL', yearStart: 2022, yearEnd: 2026, engine: '1.5L Turbo 4-Cylinder' }
        ]
      },
      {
        name: 'Tiguan',
        variants: [
          { name: 'S', yearStart: 2022, yearEnd: 2026, engine: '2.0L Turbo 4-Cylinder' },
          { name: 'SEL R-Line', yearStart: 2022, yearEnd: 2026, engine: '2.0L Turbo 4-Cylinder' }
        ]
      }
    ]
  },
  {
    brand: 'Mercedes-Benz',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Mercedes-Logo.svg/2048px-Mercedes-Logo.svg.png',
    models: [
      {
        name: 'C-Class',
        variants: [
          { name: 'C300', yearStart: 2022, yearEnd: 2026, engine: '2.0L Turbo 4-Cylinder' },
          { name: 'AMG C43', yearStart: 2023, yearEnd: 2026, engine: '2.0L Turbo Mild Hybrid' }
        ]
      },
      {
        name: 'GLE',
        variants: [
          { name: 'GLE 350', yearStart: 2020, yearEnd: 2026, engine: '2.0L Turbo 4-Cylinder' },
          { name: 'GLE 450', yearStart: 2020, yearEnd: 2026, engine: '3.0L Turbo Mild Hybrid' }
        ]
      }
    ]
  },
  {
    brand: 'Audi',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Audi-Logo_2016.svg/2560px-Audi-Logo_2016.svg.png',
    models: [
      {
        name: 'A4',
        variants: [
          { name: 'Premium', yearStart: 2020, yearEnd: 2026, engine: '2.0L Turbo 4-Cylinder' },
          { name: 'Premium Plus', yearStart: 2020, yearEnd: 2026, engine: '2.0L Turbo 4-Cylinder' }
        ]
      },
      {
        name: 'Q5',
        variants: [
          { name: '45 TFSI', yearStart: 2021, yearEnd: 2026, engine: '2.0L Turbo 4-Cylinder' },
          { name: '55 TFSI e', yearStart: 2021, yearEnd: 2026, engine: '2.0L Plug-in Hybrid' }
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

    for (const brandData of curatedVehicles) {
      // 1. Create/Find Brand
      let brand = await VehicleBrand.findOne({ name: brandData.brand });
      if (!brand) {
        brand = await VehicleBrand.create({
          name: brandData.brand,
          logoUrl: brandData.logo
        });
        console.log(`Created Brand: ${brand.name}`);
      } else {
        if (brandData.logo && brand.logoUrl !== brandData.logo) {
          brand.logoUrl = brandData.logo;
          await brand.save();
          console.log(`Updated Brand: ${brand.name}`);
        } else {
          console.log(`Found Brand: ${brand.name}`);
        }
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
          // Keep the normalized master record alongside the legacy flattened fitment rows.
          await VehicleVariant.findOneAndUpdate(
            { model: model._id, name: variantData.name },
            {
              model: model._id,
              name: variantData.name,
              yearStart: variantData.yearStart,
              yearEnd: variantData.yearEnd,
              engine: variantData.engine
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );

          // 3. Create Flattened "Vehicle" entries for each year in the range
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