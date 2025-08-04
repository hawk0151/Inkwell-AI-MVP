// backend/src/routes/shipping.routes.js

import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { getShippingQuotes } from '../controllers/shipping.controller.js';

const router = express.Router();

router.post('/quotes', protect, getShippingQuotes);

export default router;