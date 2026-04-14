import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { AppSetting } from '../models/AppSetting.js';
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_FULL_NAME,
  DEFAULT_ADMIN_PASSWORD_HASH,
  DEFAULT_ADMIN_PHONE
} from '../config/admin.constants.js';

const ADMIN_CREDENTIAL_SYNC_KEY = 'default_admin_credentials_synced';

function isBcryptHash(value) {
  return /^\$2[aby]\$\d{2}\$/.test(String(value || ''));
}

async function getUniqueSeedPhone(basePhone) {
  let nextPhone = String(basePhone || '').trim() || '233000000000';
  let counter = 2;

  while (await User.exists({ phone: nextPhone })) {
    nextPhone = `${basePhone}-${counter}`;
    counter += 1;
  }

  return nextPhone;
}

export async function ensureSeedAdminAccount() {
  if (mongoose.connection.readyState !== 1) {
    console.warn('[admin.seed] MongoDB is not connected, skipping admin seed');
    return { created: false, skipped: 'db_not_ready' };
  }

  if (!isBcryptHash(DEFAULT_ADMIN_PASSWORD_HASH)) {
    throw new Error('ADMIN_PASSWORD_HASH must be a valid bcrypt hash');
  }

  const existingAdmin = await User.findOne({ email: DEFAULT_ADMIN_EMAIL, role: 'admin' })
    .select('_id email role isActive password');
  if (existingAdmin) {
    const syncFlag = await AppSetting.findOne({ key: ADMIN_CREDENTIAL_SYNC_KEY }).lean();
    const alreadySyncedToCurrentHash = syncFlag?.value?.syncedHash === DEFAULT_ADMIN_PASSWORD_HASH;
    if (!alreadySyncedToCurrentHash) {
      await User.collection.updateOne(
        { email: DEFAULT_ADMIN_EMAIL, role: 'admin' },
        {
          $set: {
            password: DEFAULT_ADMIN_PASSWORD_HASH,
            isActive: true,
            updatedAt: new Date()
          }
        }
      );
      await AppSetting.findOneAndUpdate(
        { key: ADMIN_CREDENTIAL_SYNC_KEY },
        {
          $set: {
            value: {
              email: DEFAULT_ADMIN_EMAIL,
              syncedAt: new Date().toISOString(),
              syncedHash: DEFAULT_ADMIN_PASSWORD_HASH
            },
            description: 'Tracks the one-time launch admin credential sync'
          }
        },
        {
          upsert: true,
          new: true
        }
      );
      console.info(`[admin.seed] Synced launch admin credentials for ${DEFAULT_ADMIN_EMAIL}`);
      return { created: false, synced: true, adminId: existingAdmin._id.toString() };
    }

    if (!existingAdmin.isActive) {
      await User.updateOne({ _id: existingAdmin._id }, { $set: { isActive: true } });
    }
    return { created: false, skipped: 'already_exists', adminId: existingAdmin._id.toString() };
  }

  const emailConflict = await User.findOne({ email: DEFAULT_ADMIN_EMAIL }).select('_id role');
  if (emailConflict) {
    console.warn(
      `[admin.seed] Skipped admin seed because ${DEFAULT_ADMIN_EMAIL} is already used by role ${emailConflict.role}`
    );
    return { created: false, skipped: 'email_conflict', userId: emailConflict._id.toString() };
  }

  const phone = await getUniqueSeedPhone(DEFAULT_ADMIN_PHONE);
  const now = new Date();
  const inserted = await User.collection.insertOne({
    fullName: DEFAULT_ADMIN_FULL_NAME,
    email: DEFAULT_ADMIN_EMAIL,
    phone,
    password: DEFAULT_ADMIN_PASSWORD_HASH,
    role: 'admin',
    isActive: true,
    createdAt: now,
    updatedAt: now
  });

  console.info(`[admin.seed] Seeded admin account for ${DEFAULT_ADMIN_EMAIL}`);
  await AppSetting.findOneAndUpdate(
    { key: ADMIN_CREDENTIAL_SYNC_KEY },
    {
      $set: {
        value: {
          email: DEFAULT_ADMIN_EMAIL,
          syncedAt: now.toISOString(),
          syncedHash: DEFAULT_ADMIN_PASSWORD_HASH
        },
        description: 'Tracks the one-time launch admin credential sync'
      }
    },
    {
      upsert: true,
      new: true
    }
  );
  return {
    created: true,
    adminId: inserted.insertedId.toString()
  };
}
