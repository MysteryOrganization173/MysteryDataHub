import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './src/models/User.js';

dotenv.config();

const DEFAULT_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@mysterybundlehub.com').toLowerCase();
const nextPassword = process.env.ADMIN_NEW_PASSWORD || process.argv[2];

const resetAdminPassword = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('Missing MONGODB_URI in environment.');
    process.exit(1);
  }

  if (!nextPassword || nextPassword.length < 8) {
    console.error('Provide a new admin password with at least 8 characters via ADMIN_NEW_PASSWORD or as a CLI argument.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  let admin = await User.findOne({ email: DEFAULT_ADMIN_EMAIL, role: 'admin' });

  if (!admin) {
    admin = new User({
      fullName: 'Super Admin',
      email: DEFAULT_ADMIN_EMAIL,
      phone: '0000000000',
      password: nextPassword,
      role: 'admin',
      isActive: true
    });
  } else {
    admin.password = nextPassword;
    admin.isActive = true;
  }

  await admin.save();
  await mongoose.disconnect();

  console.log(`✅ Admin password reset complete for ${DEFAULT_ADMIN_EMAIL}`);
};

resetAdminPassword().catch(async (error) => {
  console.error('❌ Failed to reset admin password:', error.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
