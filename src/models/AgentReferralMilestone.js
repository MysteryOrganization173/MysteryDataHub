import mongoose from 'mongoose';

const agentReferralMilestoneSchema = new mongoose.Schema(
  {
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    milestoneCount: { type: Number, required: true },
    bonusAmount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'credited', 'reversed'], default: 'pending' },
    achievedAt: Date,
    paidAt: Date,
    reversedAt: Date,
    sourceReferralCount: { type: Number, default: 0 }
  },
  {
    timestamps: true
  }
);

agentReferralMilestoneSchema.index({ agentId: 1, milestoneCount: 1 }, { unique: true });

export const AgentReferralMilestone = mongoose.model('AgentReferralMilestone', agentReferralMilestoneSchema);
