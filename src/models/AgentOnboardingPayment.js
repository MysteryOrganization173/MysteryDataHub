import mongoose from 'mongoose';

const agentOnboardingPaymentSchema = new mongoose.Schema(
  {
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reference: { type: String, required: true, unique: true, index: true },
    amount: { type: Number, required: true, default: 75 },
    status: { type: String, enum: ['pending', 'success', 'failed', 'reversed'], default: 'pending' },
    referralCode: String,
    referrerAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    bonusAwarded: { type: Boolean, default: false },
    bonusAwardedAt: Date,
    paystackResponse: mongoose.Schema.Types.Mixed,
    paidAt: Date
  },
  {
    timestamps: true
  }
);

agentOnboardingPaymentSchema.index({ referrerAgentId: 1, createdAt: -1 });

export const AgentOnboardingPayment = mongoose.model('AgentOnboardingPayment', agentOnboardingPaymentSchema);
