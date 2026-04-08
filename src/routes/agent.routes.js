import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware.js';
import {
  getDashboard,
  updatePrices,
  requestWithdrawal,
  getWithdrawals,
  // ... other methods
} from '../controllers/agent.controller.js';

const router = express.Router();

router.use(protect);
router.use(authorize('agent'));

router.get('/dashboard', getDashboard);
router.put('/pricing', updatePrices);
router.post('/withdraw', requestWithdrawal);
router.get('/withdrawals', getWithdrawals);
// add profile, password, etc.

export default router;