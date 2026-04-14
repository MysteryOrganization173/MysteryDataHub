import express from 'express';
import rateLimit from 'express-rate-limit';
import { registerAgent, loginAgent, loginAdmin } from '../controllers/auth.controller.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false
});

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/register', authLimiter, registerAgent);
router.post('/login', authLimiter, loginAgent);
router.post('/admin/login', adminLoginLimiter, loginAdmin);

export default router;