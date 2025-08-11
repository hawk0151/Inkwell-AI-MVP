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
    generateEventImage,
    generatePreviewPdf,
    uploadCoverImage,
    prepareBookForPrint, // Import the new controller function
} from '../controllers/picturebook.controller.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect); // All routes in this router require authentication

// --- Book-Level Routes ---
router.get('/', getPictureBooks);
router.post('/', createPictureBook);
router.get('/:bookId', getPictureBook);
router.delete('/:bookId', deletePictureBook);
router.patch('/:bookId/privacy', togglePictureBookPrivacy);

// Route to upload and crop a book cover image
router.post('/:bookId/cover', upload.single('image'), uploadCoverImage);

// Route to generate a PDF preview for a book
router.get('/:bookId/preview', generatePreviewPdf);

// **NEW**: Route to generate all high-resolution images for printing
router.post('/:bookId/prepare-for-print', prepareBookForPrint);

// --- Checkout Route ---
router.post('/:bookId/checkout', createBookCheckoutSession);

// --- Event/Page Routes ---
router.post('/:bookId/events', saveTimelineEvents);

// Route to generate an AI image for a specific page number
router.post('/:bookId/events/:pageNumber/generate-image', generateEventImage);


export default router;