import express from 'express';
import { initializePayment, verifyPayment, webhook } from '../controllers/payment.controller.js';

const router = express.Router();

router.post('/initialize', (req, res, next) => {
  console.log('[payment.route] POST /api/payment/initialize hit');
  return next();
}, initializePayment);
router.get('/verify/:reference', verifyPayment);
router.post('/webhook', webhook);

export default router;