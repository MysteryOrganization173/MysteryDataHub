import mongoose from 'mongoose';

const bundleSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  operator: { type: String, enum: ['mtn', 'airteltigo', 'telecel'], required: true },
  name: { type: String, required: true },
  size: { type: String, required: true },
  validity: { type: String, required: true },
  basePrice: { type: Number, required: true },
  defaultAgentPrice: { type: Number, required: true },
  wholesalePrice: {
    type: Number,
    required: true,
    default: 0
  },
  isBigTime: { type: Boolean, default: false },
  isInstant: { type: Boolean, default: false },
  deliveryTime: { type: String, default: 'Instant' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export const Bundle = mongoose.model('Bundle', bundleSchema);