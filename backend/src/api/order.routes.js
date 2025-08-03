// backend/src/api/order.routes.js
import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { 
    createCheckoutSession, 
    getMyOrders, 
    getOrderDetails, // Keep this if used elsewhere for orderId lookup
    getOrderBySessionId // NEW: Import the new controller function
} from '../controllers/order.controller.js';

const router = express.Router();

router.post('/create-checkout-session', protect, createCheckoutSession);
router.get('/my-orders', protect, getMyOrders);
router.get('/:orderId', protect, getOrderDetails); // Existing route for orderId lookup

// NEW: Route to get order details by Stripe Session ID
router.get('/session/:sessionId', protect, getOrderBySessionId); 

export default router;