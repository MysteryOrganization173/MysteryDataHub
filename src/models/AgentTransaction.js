import mongoose from 'mongoose';

const agentTransactionSchema = new mongoose.Schema(
  {
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'order_profit',
        'referral_bonus',
        'referral_milestone_bonus',
        'withdrawal_request',
        'withdrawal_paid',
        'withdrawal_rejected',
        'adjustment'
      ],
      required: true
    },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'completed', 'reversed', 'rejected'], default: 'completed' },
    referenceType: { type: String, required: true },
    referenceId: { type: String, required: true },
    note: String,
    metadata: mongoose.Schema.Types.Mixed
  },
  {
    timestamps: true
  }
);

agentTransactionSchema.index({ agentId: 1, createdAt: -1 });
agentTransactionSchema.index({ agentId: 1, type: 1, referenceType: 1, referenceId: 1 }, { unique: true });

export const AgentTransaction = mongoose.model('AgentTransaction', agentTransactionSchema);
