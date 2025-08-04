// backend/src/api/picturebook.routes.js
import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
    createPictureBook,
    addTimelineEvent,
    getPictureBooks,
    getPictureBook,
    deletePictureBook, // Deletes the entire book
    deleteTimelineEvent, // NEW: For deleting a specific timeline event (page)
    createBookCheckoutSession,
    togglePictureBookPrivacy,
    getPictureBookShippingOptions // <-- NEW IMPORT
} from '../controllers/picturebook.controller.js'; // <-- NEW IMPORT

const router = express.Router();

router.use(protect); // All routes in this router require authentication

router.get('/', getPictureBooks); // Get all picture books for user
router.post('/', createPictureBook); // Create a new picture book
router.get('/:bookId', getPictureBook); // Get details of a specific picture book
router.delete('/:bookId', deletePictureBook); // Delete an entire picture book

// MODIFIED: Route for adding/updating a timeline event (page)
router.post('/:bookId/events', addTimelineEvent);

// NEW: Route for deleting a specific timeline event (page) by its pageNumber
router.delete('/:bookId/events/:pageNumber', deleteTimelineEvent);

// NEW: Route to fetch shipping options for a picture book
router.get('/:bookId/shipping-options', getPictureBookShippingOptions); // <-- NEW ROUTE

router.post('/:bookId/checkout', createBookCheckoutSession); // Checkout session for picture book
router.patch('/:bookId/privacy', togglePictureBookPrivacy); // Toggle privacy for picture book

export default router;