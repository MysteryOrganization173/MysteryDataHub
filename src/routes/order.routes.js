import express from 'express';
import { getOrderStatus } from '../controllers/order.controller.js';

const router = express.Router();

router.get('/:lookup', getOrderStatus);

export default router;