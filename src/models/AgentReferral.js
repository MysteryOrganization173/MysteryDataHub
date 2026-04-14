import mongoose from 'mongoose';

const agentReferralSchema = new mongoose.Schema(
  {
    referrerAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    referredAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    onboardingPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'AgentOnboardingPayment', unique: true, sparse: true },
    bonusAmount: { type: Number, required: true, default: 25 },
    status: { type: String, enum: ['pending', 'credited', 'reversed'], default: 'pending' },
    paidAt: Date,
    reversedAt: Date
  },
  {
    timestamps: true
  }
);

agentReferralSchema.index({ referrerAgentId: 1, createdAt: -1 });

export const AgentReferral = mongoose.model('AgentReferral', agentReferralSchema);
