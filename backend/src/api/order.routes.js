// backend/src/api/order.routes.js
import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
// --- MODIFIED: Import the new getLuluOrderStatus function ---
import { 
    createCheckoutSession, 
    getMyOrders, 
    getOrderDetails,
    getOrderBySessionId,
    getLuluOrderStatus
} from '../controllers/order.controller.js';

const router = express.Router();

router.post('/create-checkout-session', protect, createCheckoutSession);
router.get('/my-orders', protect, getMyOrders);
router.get('/:orderId', protect, getOrderDetails);
router.get('/session/:sessionId', protect, getOrderBySessionId); 

// --- NEW: Route to get live Lulu status for an order ---
router.get('/status/:luluJobId', protect, getLuluOrderStatus); 

export default router;