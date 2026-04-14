import mongoose from 'mongoose';

const adminAuditLogSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, trim: true },
    targetType: { type: String, required: true, trim: true },
    targetId: { type: String, trim: true },
    note: { type: String, trim: true },
    metadata: mongoose.Schema.Types.Mixed
  },
  {
    timestamps: true
  }
);

adminAuditLogSchema.index({ createdAt: -1 });

export const AdminAuditLog = mongoose.model('AdminAuditLog', adminAuditLogSchema);
