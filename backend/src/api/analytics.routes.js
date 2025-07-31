// backend/src/api/analytics.routes.js
import express from 'express';
import { recordEvent } from '../controllers/analytics.controller.js';

const router = express.Router();

// Route for recording analytics events (assuming POST request)
router.post('/events', recordEvent);

// Changed to named export
export { router };