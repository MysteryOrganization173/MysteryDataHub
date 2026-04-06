import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Bundle } from './src/models/Bundle.js';
import { User } from './src/models/User.js';
import bcrypt from 'bcryptjs';

dotenv.config();

// Helper: calculate wholesale price = basePrice + profit (min 0.10 or 1% of basePrice)
const getWholesalePrice = (basePrice) => {
  const profit = Math.max(0.10, basePrice * 0.01);
  return Math.round((basePrice + profit) * 100) / 100;
};

// Base bundles (without wholesalePrice yet)
const bundlesRaw = [
  // MTN Express (90 days)
  { code: 'MTN_1GB_90D', operator: 'mtn', size: '1GB', validity: '90 days', basePrice: 4.70, defaultAgentPrice: 5.50 },
  { code: 'MTN_2GB_90D', operator: 'mtn', size: '2GB', validity: '90 days', basePrice: 9.15, defaultAgentPrice: 10.00 },
  { code: 'MTN_3GB_90D', operator: 'mtn', size: '3GB', validity: '90 days', basePrice: 13.35, defaultAgentPrice: 14.50 },
  { code: 'MTN_4GB_90D', operator: 'mtn', size: '4GB', validity: '90 days', basePrice: 18.00, defaultAgentPrice: 19.50 },
  { code: 'MTN_5GB_90D', operator: 'mtn', size: '5GB', validity: '90 days', basePrice: 21.80, defaultAgentPrice: 23.50 },
  { code: 'MTN_6GB_90D', operator: 'mtn', size: '6GB', validity: '90 days', basePrice: 26.50, defaultAgentPrice: 28.50 },
  { code: 'MTN_8GB_90D', operator: 'mtn', size: '8GB', validity: '90 days', basePrice: 35.80, defaultAgentPrice: 38.00 },
  { code: 'MTN_10GB_90D', operator: 'mtn', size: '10GB', validity: '90 days', basePrice: 41.50, defaultAgentPrice: 44.00 },
  { code: 'MTN_15GB_90D', operator: 'mtn', size: '15GB', validity: '90 days', basePrice: 61.00, defaultAgentPrice: 64.50 },
  { code: 'MTN_20GB_90D', operator: 'mtn', size: '20GB', validity: '90 days', basePrice: 82.00, defaultAgentPrice: 86.00 },
  { code: 'MTN_25GB_90D', operator: 'mtn', size: '25GB', validity: '90 days', basePrice: 102.00, defaultAgentPrice: 107.00 },
  { code: 'MTN_30GB_90D', operator: 'mtn', size: '30GB', validity: '90 days', basePrice: 122.50, defaultAgentPrice: 128.00 },
  { code: 'MTN_40GB_90D', operator: 'mtn', size: '40GB', validity: '90 days', basePrice: 162.00, defaultAgentPrice: 169.00 },

  // AirtelTigo iShare (60 days)
  { code: 'AT_1GB_60D', operator: 'airteltigo', size: '1GB', validity: '60 days', basePrice: 3.85, defaultAgentPrice: 4.80, isInstant: true },
  { code: 'AT_2GB_60D', operator: 'airteltigo', size: '2GB', validity: '60 days', basePrice: 7.80, defaultAgentPrice: 8.80, isInstant: true },
  { code: 'AT_3GB_60D', operator: 'airteltigo', size: '3GB', validity: '60 days', basePrice: 11.60, defaultAgentPrice: 12.80, isInstant: true },
  { code: 'AT_4GB_60D', operator: 'airteltigo', size: '4GB', validity: '60 days', basePrice: 15.40, defaultAgentPrice: 16.90, isInstant: true },
  { code: 'AT_5GB_60D', operator: 'airteltigo', size: '5GB', validity: '60 days', basePrice: 19.10, defaultAgentPrice: 21.00, isInstant: true },
  { code: 'AT_6GB_60D', operator: 'airteltigo', size: '6GB', validity: '60 days', basePrice: 23.00, defaultAgentPrice: 25.00, isInstant: true },
  { code: 'AT_7GB_60D', operator: 'airteltigo', size: '7GB', validity: '60 days', basePrice: 27.00, defaultAgentPrice: 29.00, isInstant: true },
  { code: 'AT_8GB_60D', operator: 'airteltigo', size: '8GB', validity: '60 days', basePrice: 31.00, defaultAgentPrice: 33.50, isInstant: true },
  { code: 'AT_9GB_60D', operator: 'airteltigo', size: '9GB', validity: '60 days', basePrice: 35.00, defaultAgentPrice: 37.50, isInstant: true },
  { code: 'AT_10GB_60D', operator: 'airteltigo', size: '10GB', validity: '60 days', basePrice: 39.00, defaultAgentPrice: 42.00, isInstant: true },
  { code: 'AT_12GB_60D', operator: 'airteltigo', size: '12GB', validity: '60 days', basePrice: 46.50, defaultAgentPrice: 50.00, isInstant: true },
  { code: 'AT_15GB_60D', operator: 'airteltigo', size: '15GB', validity: '60 days', basePrice: 58.00, defaultAgentPrice: 62.00, isInstant: true },
  { code: 'AT_20GB_60D', operator: 'airteltigo', size: '20GB', validity: '60 days', basePrice: 77.00, defaultAgentPrice: 82.00, isInstant: true },
  { code: 'AT_25GB_60D', operator: 'airteltigo', size: '25GB', validity: '60 days', basePrice: 95.80, defaultAgentPrice: 101.00, isInstant: true },
  { code: 'AT_30GB_60D', operator: 'airteltigo', size: '30GB', validity: '60 days', basePrice: 115.00, defaultAgentPrice: 121.00, isInstant: true },

  // AirtelTigo BigTime (non-expiry)
  { code: 'AT_40GB_NOEXP', operator: 'airteltigo', size: '40GB', validity: 'No expiry', basePrice: 81.00, defaultAgentPrice: 86.00, isBigTime: true },
  { code: 'AT_50GB_NOEXP', operator: 'airteltigo', size: '50GB', validity: 'No expiry', basePrice: 90.00, defaultAgentPrice: 95.00, isBigTime: true },
  { code: 'AT_60GB_NOEXP', operator: 'airteltigo', size: '60GB', validity: 'No expiry', basePrice: 105.00, defaultAgentPrice: 111.00, isBigTime: true },
  { code: 'AT_70GB_NOEXP', operator: 'airteltigo', size: '70GB', validity: 'No expiry', basePrice: 130.00, defaultAgentPrice: 137.00, isBigTime: true },
  { code: 'AT_80GB_NOEXP', operator: 'airteltigo', size: '80GB', validity: 'No expiry', basePrice: 153.00, defaultAgentPrice: 161.00, isBigTime: true },
  { code: 'AT_90GB_NOEXP', operator: 'airteltigo', size: '90GB', validity: 'No expiry', basePrice: 167.00, defaultAgentPrice: 175.00, isBigTime: true },
  { code: 'AT_100GB_NOEXP', operator: 'airteltigo', size: '100GB', validity: 'No expiry', basePrice: 185.00, defaultAgentPrice: 194.00, isBigTime: true },

  // Telecel Expiry (60 days)
  { code: 'TEL_5GB_60D', operator: 'telecel', size: '5GB', validity: '60 days', basePrice: 20.50, defaultAgentPrice: 22.00 },
  { code: 'TEL_10GB_60D', operator: 'telecel', size: '10GB', validity: '60 days', basePrice: 39.00, defaultAgentPrice: 42.00 },
  { code: 'TEL_15GB_60D', operator: 'telecel', size: '15GB', validity: '60 days', basePrice: 56.00, defaultAgentPrice: 60.00 },
  { code: 'TEL_20GB_60D', operator: 'telecel', size: '20GB', validity: '60 days', basePrice: 74.00, defaultAgentPrice: 79.00 },
  { code: 'TEL_25GB_60D', operator: 'telecel', size: '25GB', validity: '60 days', basePrice: 92.50, defaultAgentPrice: 98.00 },
  { code: 'TEL_30GB_60D', operator: 'telecel', size: '30GB', validity: '60 days', basePrice: 109.40, defaultAgentPrice: 116.00 },
  { code: 'TEL_40GB_60D', operator: 'telecel', size: '40GB', validity: '60 days', basePrice: 147.00, defaultAgentPrice: 155.00 },
  { code: 'TEL_50GB_60D', operator: 'telecel', size: '50GB', validity: '60 days', basePrice: 182.00, defaultAgentPrice: 191.00 },
  { code: 'TEL_100GB_60D', operator: 'telecel', size: '100GB', validity: '60 days', basePrice: 365.00, defaultAgentPrice: 380.00 }
];

// Add wholesalePrice to each bundle
const bundles = bundlesRaw.map(b => ({
  ...b,
  wholesalePrice: getWholesalePrice(b.basePrice)
}));

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    await Bundle.deleteMany();
    await Bundle.insertMany(bundles);
    console.log('✅ Bundles seeded with base prices, wholesale prices, and agent prices');

    // Create admin user if not exists
    const adminExists = await User.findOne({ email: process.env.ADMIN_EMAIL });
    if (!adminExists) {
      const hashed = await bcrypt.hash('admin123', 10);
      await User.create({
        fullName: 'Super Admin',
        email: process.env.ADMIN_EMAIL,
        phone: '0000000000',
        password: hashed,
        role: 'admin',
        isActive: true
      });
      console.log('✅ Admin user created (email: admin@mysterybundlehub.com, password: admin123)');
    } else {
      console.log('ℹ️ Admin already exists');
    }

    process.exit();
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
};

seed();