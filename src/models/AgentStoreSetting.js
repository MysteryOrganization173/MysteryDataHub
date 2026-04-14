import mongoose from 'mongoose';

const agentStoreSettingSchema = new mongoose.Schema(
  {
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    settingKey: { type: String, required: true },
    network: { type: String, enum: ['mtn', 'airteltigo', 'telecel'], required: true },
    tier: { type: String, default: null },
    isEnabled: { type: Boolean, default: true }
  },
  {
    timestamps: true
  }
);

agentStoreSettingSchema.index({ agentId: 1, settingKey: 1 }, { unique: true });

export const AgentStoreSetting = mongoose.model('AgentStoreSetting', agentStoreSettingSchema);
