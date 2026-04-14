import mongoose from 'mongoose';

function generateOrderId() {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${Date.now()}-${rand}`;
}

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    reference: { type: String, required: true, unique: true, index: true },
    customerPhone: { type: String, required: true },
    customerEmail: String,
    network: { type: String, required: true, index: true },
    catalogTier: { type: String, enum: ['budget', 'express', 'instant', 'standard', 'beneficiary'] },
    tierLabel: String,
    catalogVolume: Number,
    productKey: String,
    offerSlug: String,
    deliveryLabel: String,
    bundleCode: { type: String, required: true },
    bundleName: String,
    amount: { type: Number, required: true },
    sellingPrice: Number,
    wholesaleCost: Number,
    floorPrice: Number,
    agentProfit: { type: Number, default: 0 },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    agentStoreSlug: String,
    profitStatus: {
      type: String,
      enum: ['none', 'unrecorded', 'pending', 'available', 'reversed'],
      default: 'none'
    },
    pendingEarningsRecordedAt: Date,
    earningsAvailableAt: Date,
    earningsReversedAt: Date,
    status: { type: String, enum: ['pending', 'paid', 'fulfilled', 'failed', 'refunded'], default: 'pending' },
    paymentStatus: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
    deliveryStatus: { type: String, enum: ['pending', 'processing', 'delivered', 'failed'], default: 'pending' },
    deliveryTime: Number,
    providerOrderId: { type: String, index: true, sparse: true },
    providerStatus: String,
    fulfillmentRequestedAt: Date,
    fulfillmentAcceptedAt: Date,
    lastProviderSyncAt: Date,
    lastProviderPayload: mongoose.Schema.Types.Mixed,
    paystackResponse: Object
  },
  {
    timestamps: true
  }
);

orderSchema.index({ agentId: 1, createdAt: -1 });

orderSchema.pre('validate', function ensureOrderId(next) {
  if (!this.orderId) {
    this.orderId = generateOrderId();
  }
  if (!this.sellingPrice) {
    this.sellingPrice = this.amount;
  }
  if (!this.agentId) {
    this.profitStatus = 'none';
  } else if (this.profitStatus === 'none') {
    this.profitStatus = 'unrecorded';
  }
  next();
});

export const Order = mongoose.model('Order', orderSchema);