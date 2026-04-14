import mongoose from 'mongoose';

const agentPricingRuleSchema = new mongoose.Schema(
  {
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    productKey: { type: String, required: true },
    bundleCode: { type: String, required: true },
    network: { type: String, enum: ['mtn', 'airteltigo', 'telecel'], required: true },
    tier: { type: String, enum: ['budget', 'express', 'instant', 'standard'], required: true },
    bundleSize: { type: Number, required: true },
    sizeLabel: String,
    validityLabel: String,
    deliveryLabel: String,
    wholesaleCost: { type: Number, required: true },
    floorPrice: { type: Number, required: true },
    suggestedRetailPrice: { type: Number, required: true },
    customRetailPrice: Number,
    profitMargin: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true
  }
);

agentPricingRuleSchema.index({ agentId: 1, productKey: 1 }, { unique: true });
agentPricingRuleSchema.index({ agentId: 1, network: 1, tier: 1, bundleSize: 1 });

export const AgentPricingRule = mongoose.model('AgentPricingRule', agentPricingRuleSchema);
