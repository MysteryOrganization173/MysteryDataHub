import mongoose from 'mongoose';

const appSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    description: { type: String, trim: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: true
  }
);

export const AppSetting = mongoose.model('AppSetting', appSettingSchema);
