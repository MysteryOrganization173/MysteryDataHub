import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { isProductionLike } from './runtime.js';
dotenv.config();

export const connectDB = async () => {
  const mongoUri = String(process.env.MONGODB_URI || '').trim();
  if (!mongoUri) {
    const error = new Error('MONGODB_URI is required to start the backend');
    if (isProductionLike()) {
      throw error;
    }
    console.error(`❌ ${error.message}`);
    return false;
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    if (isProductionLike()) {
      throw error;
    }
    console.error('MongoDB failed, continuing without DB for local troubleshooting only');
    return false;
  }
};