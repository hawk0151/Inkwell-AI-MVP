import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { 
    createCheckoutSession, 
    getMyOrders, 
    getOrderDetails,
    getOrderBySessionId,
    getLuluOrderStatus
} from '../controllers/order.controller.js';

const router = express.Router();

router.post('/create-checkout-session', protect, createCheckoutSession);
// --- RESTORED: The correct, protected route is back ---
router.get('/my-orders', protect, getMyOrders);
router.get('/:orderId', protect, getOrderDetails);
router.get('/session/:sessionId', protect, getOrderBySessionId); 
router.get('/status/:luluJobId', protect, getLuluOrderStatus); 

export default router;