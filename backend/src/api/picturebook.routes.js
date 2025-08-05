// backend/src/api/picturebook.routes.js
import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
    createPictureBook,
    getPictureBooks,
    getPictureBook,
    deletePictureBook, // Deletes the entire book
    saveTimelineEvents, // NEW: Import the unified save function
    createBookCheckoutSession,
    togglePictureBookPrivacy,
} from '../controllers/picturebook.controller.js';

const router = express.Router();

router.use(protect); // All routes in this router require authentication

router.get('/', getPictureBooks); // Get all picture books for user
router.post('/', createPictureBook); // Create a new picture book
router.get('/:bookId', getPictureBook); // Get details of a specific picture book
router.delete('/:bookId', deletePictureBook); // Delete an entire picture book

// MODIFIED: This single route now handles adding, updating, and re-ordering all timeline events (pages)
router.post('/:bookId/events', saveTimelineEvents);

// REMOVED: The old deleteTimelineEvent route is no longer needed
// router.delete('/:bookId/events/:pageNumber', deleteTimelineEvent);

router.post('/:bookId/checkout', createBookCheckoutSession); // Checkout session for picture book
router.patch('/:bookId/privacy', togglePictureBookPrivacy); // Toggle privacy for picture book

export default router;