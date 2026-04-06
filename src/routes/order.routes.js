import express from 'express';
import { createOrder } from '../controllers/order.controller.js';

const router = express.Router();

// Public route – create an order before payment
router.post('/create', createOrder);

export default router;