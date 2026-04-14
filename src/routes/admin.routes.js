import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware.js';
import {
  getAgents,
  getAgentReferralMilestones,
  getAgentDetails,
  toggleAgentStatus,
  getWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  patchAgentWithdrawal,
  getOrders,
  patchAgentOrder,
  getAgentReferrals,
  patchAgentReferralMilestone,
  patchAgentReferral,
  getNetworkStatus,
  setNetworkStatus
} from '../controllers/admin.controller.js';

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

router.get('/agents', getAgents);
router.get('/agents/:id', getAgentDetails);
router.patch('/agents/:id/status', toggleAgentStatus);
router.get('/withdrawals', getWithdrawals);
router.post('/withdrawals/:id/approve', approveWithdrawal);
router.post('/withdrawals/:id/reject', rejectWithdrawal);
router.get('/orders', getOrders);
router.get('/agent-orders', getOrders);
router.get('/agent-referrals', getAgentReferrals);
router.patch('/agent-referrals/:id', patchAgentReferral);
router.get('/agent-referral-milestones', getAgentReferralMilestones);
router.patch('/agent-referral-milestones/:id', patchAgentReferralMilestone);
router.get('/agent-withdrawals', getWithdrawals);
router.patch('/agent-withdrawals/:id', patchAgentWithdrawal);
router.patch('/agent-orders/:id', patchAgentOrder);
router.get('/network-status', getNetworkStatus);
router.post('/network-status', setNetworkStatus);

export default router;