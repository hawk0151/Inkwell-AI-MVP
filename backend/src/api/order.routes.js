// backend/src/api/order.routes.js
import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { createCheckoutSession, getMyOrders } from '../controllers/order.controller.js';

const router = express.Router();

router.post('/create-checkout-session', protect, createCheckoutSession);
router.get('/my-orders', protect, getMyOrders);

export default router;
