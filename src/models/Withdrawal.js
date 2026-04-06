import mongoose from 'mongoose';

const withdrawalSchema = new mongoose.Schema({
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  fee: { type: Number, default: 0.5 },
  netAmount: Number,
  momoNumber: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'completed', 'rejected'], default: 'pending' },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  processedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

export const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);