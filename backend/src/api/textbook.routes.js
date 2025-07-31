import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
    createTextBook,
    getTextBooks, // --- THIS IS THE CRITICAL FIX: Changed from getMyTextBooks to getTextBooks
    getTextBookDetails,
    generateNextChapter,
    createTextBookCheckoutSession,
    toggleTextBookPrivacy,
    deleteTextBook
} from '../controllers/textbook.controller.js';

const router = express.Router();

// This middleware protects all routes in this file
router.use(protect);

router.get('/', getTextBooks); // This now correctly references the exported name in the controller
router.post('/', createTextBook);
router.get('/:bookId', getTextBookDetails);
router.delete('/:bookId', deleteTextBook);
router.post('/:bookId/generate-chapter', generateNextChapter);
router.post('/:bookId/checkout', createTextBookCheckoutSession);
router.patch('/:bookId/privacy', toggleTextBookPrivacy);

export default router;