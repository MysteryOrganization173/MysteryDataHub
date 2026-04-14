import express from 'express';
import rateLimit from 'express-rate-limit';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { loginAgent, registerAgent } from '../controllers/auth.controller.js';
import {
  createPricing,
  deletePricing,
  getAgentProfile,
  getDashboard,
  getOrderById,
  getOrders,
  getPricing,
  getReferralMilestones,
  getPublicStore,
  getReferrals,
  getStore,
  getStoreLink,
  getStoreSettings,
  getTransactions,
  getWithdrawals,
  logoutAgent,
  putStoreSettings,
  requestWithdrawal,
  resetPricing,
  updateAgentProfile,
  updatePricing,
  updateStore,
  verifyOnboardingPayment
} from '../controllers/agent.controller.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false
});

const writeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});

const withdrawalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/register', authLimiter, registerAgent);
router.post('/login', authLimiter, loginAgent);
router.get('/onboarding/verify/:reference', authLimiter, verifyOnboardingPayment);
router.get('/public-store/:storeSlug', getPublicStore);
router.get('/storefront/:storeSlug', getPublicStore);

router.use(protect);
router.use(authorize('agent'));

router.post('/logout', logoutAgent);
router.get('/profile', getAgentProfile);
router.put('/profile', writeLimiter, updateAgentProfile);
router.get('/dashboard', getDashboard);

router.get('/store', getStore);
router.put('/store', writeLimiter, updateStore);
router.get('/store-link', getStoreLink);

router.get('/store-settings', getStoreSettings);
router.put('/store-settings', writeLimiter, putStoreSettings);

router.get('/pricing', getPricing);
router.post('/pricing', writeLimiter, createPricing);
router.put('/pricing/:id', writeLimiter, updatePricing);
router.delete('/pricing/:id', writeLimiter, deletePricing);
router.post('/pricing/reset', writeLimiter, resetPricing);

router.get('/orders', getOrders);
router.get('/orders/:id', getOrderById);
router.get('/referrals', getReferrals);
router.get('/referral-milestones', getReferralMilestones);
router.get('/transactions', getTransactions);

router.post('/withdraw', withdrawalLimiter, requestWithdrawal);
router.get('/withdrawals', getWithdrawals);

export default router;