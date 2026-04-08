import express from 'express';
import { initializePayment, verifyPayment, webhook } from '../controllers/payment.controller.js';

const router = express.Router();

router.post('/initialize', initializePayment);
router.get('/verify/:reference', verifyPayment);
router.post('/webhook', webhook);

export default router;