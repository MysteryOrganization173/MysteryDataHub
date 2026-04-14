import mongoose from 'mongoose';

const withdrawalSchema = new mongoose.Schema(
  {
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    fee: { type: Number, default: 0 },
    netAmount: Number,
    payoutMethod: { type: String, enum: ['momo', 'bank'], default: 'momo' },
    momoNumber: { type: String, required: true },
    accountName: String,
    accountNumber: String,
    bankName: String,
    status: { type: String, enum: ['pending', 'approved', 'paid', 'rejected'], default: 'pending' },
    adminNote: String,
    payoutReference: String,
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    paidAt: Date,
    processedAt: Date
  },
  {
    timestamps: true
  }
);

withdrawalSchema.index({ agentId: 1, createdAt: -1 });

export const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);