// backend/src/api/picturebook.routes.js
import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
    createPictureBook,
    getPictureBooks,
    getPictureBook,
    deletePictureBook,
    saveTimelineEvents,
    createBookCheckoutSession,
    togglePictureBookPrivacy,
    generateEventImage,     // NEW: Import the image generation function
    generatePreviewPdf,     // NEW: Import the preview generation function
} from '../controllers/picturebook.controller.js';

const router = express.Router();

router.use(protect); // All routes in this router require authentication

// --- Book-Level Routes ---
router.get('/', getPictureBooks);
router.post('/', createPictureBook);
router.get('/:bookId', getPictureBook);
router.delete('/:bookId', deletePictureBook);
router.patch('/:bookId/privacy', togglePictureBookPrivacy);

// --- NEW: Route to generate a PDF preview for a book ---
router.get('/:bookId/preview', generatePreviewPdf);

// --- Checkout Route ---
router.post('/:bookId/checkout', createBookCheckoutSession);

// --- Event/Page Routes ---
router.post('/:bookId/events', saveTimelineEvents);

// --- NEW: Route to generate an AI image for a specific page number ---
router.post('/:bookId/events/:pageNumber/generate-image', generateEventImage);


export default router;