// backend/src/api/paypal.routes.js
import { Router } from 'express';
// import { createPaypalOrderController, capturePaypalOrderController } from '../controllers/order.controller.js'; // COMMENTED OUT: These controllers are not yet implemented

const router = Router();

// These routes are for PayPal integration, which is a POST-LAUNCH priority.
// They are commented out to prevent server startup errors until implemented.

/*
// Route to create a PayPal order
router.post('/create-order', createPaypalOrderController);

// Route to capture a PayPal order
router.post('/capture-order', capturePaypalOrderController);
*/

export default router;