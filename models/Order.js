import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true },
  customerPhone: { type: String, required: true },
  customerEmail: String,
  network: { type: String, required: true },
  bundleCode: { type: String, required: true },
  bundleName: String,
  amount: { type: Number, required: true },
  agentProfit: { type: Number, default: 0 },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'paid', 'fulfilled', 'failed', 'refunded'], default: 'pending' },
  paymentStatus: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  deliveryStatus: { type: String, enum: ['pending', 'processing', 'delivered', 'failed'], default: 'pending' },
  deliveryTime: Number, // minutes taken
  paystackResponse: Object,
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
});

export const Order = mongoose.model('Order', orderSchema);