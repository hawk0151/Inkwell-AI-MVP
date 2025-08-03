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

// --- NEW: Temporary test route with no authentication ---
router.get('/test-no-auth', async (req, res) => {
    console.log('[Auth Isolation Test] Hit /test-no-auth endpoint.');
    const sampleOrder = [{
        id: 'test-order-123',
        book_title: 'Sample Test Book',
        status: 'processing',
        total_cost: 6999,
        currency: 'USD',
        created_at: new Date().toISOString(),
        lulu_job_id: null
    }];
    res.json(sampleOrder);
});
// --- END OF TEST ROUTE ---

router.post('/create-checkout-session', protect, createCheckoutSession);
router.get('/my-orders', protect, getMyOrders);
router.get('/:orderId', protect, getOrderDetails);
router.get('/session/:sessionId', protect, getOrderBySessionId); 
router.get('/status/:luluJobId', protect, getLuluOrderStatus); 

export default router;