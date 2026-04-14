import { AdminAuditLog } from '../models/AdminAuditLog.js';
import { sanitizeText, toIdString } from '../utils/agent.utils.js';

export async function recordAdminAudit({
  adminId,
  action,
  targetType,
  targetId = '',
  note = '',
  metadata = {}
} = {}) {
  if (!adminId || !action || !targetType) {
    return null;
  }

  return AdminAuditLog.create({
    adminId,
    action: sanitizeText(action, 80),
    targetType: sanitizeText(targetType, 80),
    targetId: sanitizeText(targetId, 120),
    note: sanitizeText(note, 240),
    metadata
  });
}

export function serializeAdminAuditLog(logInput) {
  const log = logInput?.toObject ? logInput.toObject() : logInput;
  const admin = log.adminId || {};

  return {
    id: toIdString(log._id || log.id),
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId || '',
    note: log.note || '',
    metadata: log.metadata || {},
    createdAt: log.createdAt,
    admin: {
      id: toIdString(admin._id || admin.id),
      fullName: admin.fullName || '',
      email: admin.email || ''
    }
  };
}

export async function getRecentAdminAuditLogs(limit = 20) {
  const rows = await AdminAuditLog.find()
    .populate('adminId', 'fullName email')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return rows.map(serializeAdminAuditLog);
}
