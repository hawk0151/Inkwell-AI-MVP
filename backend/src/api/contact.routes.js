// backend/src/api/contact.routes.js
import express from 'express';
import { submitContactForm } from '../controllers/contact.controller.js';

const router = express.Router();

// A public endpoint to receive contact form submissions
router.post('/', submitContactForm);

export default router;