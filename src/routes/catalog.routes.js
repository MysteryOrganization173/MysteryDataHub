import express from 'express';
import { getCatalog } from '../controllers/catalog.controller.js';

const router = express.Router();

router.get('/', getCatalog);

export default router;
