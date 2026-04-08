import express from 'express';
import { registerAgent, loginAgent, loginAdmin } from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/register', registerAgent);
router.post('/login', loginAgent);
router.post('/admin/login', loginAdmin);

export default router;