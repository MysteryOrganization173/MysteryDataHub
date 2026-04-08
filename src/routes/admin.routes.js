import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware.js';
import {
  getAgents,
  getAgentDetails,
  toggleAgentStatus,
  getWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  getOrders,
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
router.get('/network-status', getNetworkStatus);
router.post('/network-status', setNetworkStatus);

export default router;