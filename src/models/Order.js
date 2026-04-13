import mongoose from 'mongoose';

function generateOrderId() {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${Date.now()}-${rand}`;
}

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true, index: true },
  reference: { type: String, required: true, unique: true },
  customerPhone: { type: String, required: true },
  customerEmail: String,
  network: { type: String, required: true },
  catalogTier: { type: String, enum: ['express', 'beneficiary'] },
  catalogVolume: Number,
  offerSlug: String,
  deliveryLabel: String,
  bundleCode: { type: String, required: true },
  bundleName: String,
  amount: { type: Number, required: true },
  agentProfit: { type: Number, default: 0 },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'paid', 'fulfilled', 'failed', 'refunded'], default: 'pending' },
  paymentStatus: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  deliveryStatus: { type: String, enum: ['pending', 'processing', 'delivered', 'failed'], default: 'pending' },
  deliveryTime: Number, // minutes taken
  providerOrderId: { type: String, index: true, sparse: true },
  providerStatus: String,
  fulfillmentRequestedAt: Date,
  fulfillmentAcceptedAt: Date,
  lastProviderSyncAt: Date,
  lastProviderPayload: mongoose.Schema.Types.Mixed,
  paystackResponse: Object,
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
});

orderSchema.pre('validate', function ensureOrderId(next) {
  if (!this.orderId) {
    this.orderId = generateOrderId();
  }
  next();
});

export const Order = mongoose.model('Order', orderSchema);