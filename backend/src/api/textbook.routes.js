import express from 'express';
// --- NEW: Import multer for handling file uploads ---
import multer from 'multer'; 
import { protect } from '../middleware/auth.middleware.js';
import {
    createTextBook,
    getTextBooks,
    getTextBookDetails,
    createCheckoutSessionForTextBook,
    toggleTextBookPrivacy,
    deleteTextBook,
    getPreviewPdf,
    generateNextChapter,
    regenerateChapter,
    // --- MODIFIED: Import the new and modified controller functions ---
    uploadTextbookCover, 
    deleteTextbookCover,
    saveBackCoverBlurb, // NEW: Import the new saveBackCoverBlurb function
} from '../controllers/textbook.controller.js';

const router = express.Router();

// --- NEW: Configure multer for in-memory storage and set a 9MB file size limit ---
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 9 * 1024 * 1024 } // 9MB limit
});

// This middleware protects all routes in this file
router.use(protect);

router.get('/', getTextBooks);
router.post('/', createTextBook);
router.get('/:bookId', getTextBookDetails);
router.delete('/:bookId', deleteTextBook);

// --- MODIFIED: Use multer middleware for file upload on this route ---
// This uses the 'upload' middleware to expect a single file with the field name 'image'.
router.post('/:bookId/cover', upload.single('image'), uploadTextbookCover);
// --- NEW ROUTE: For deleting the custom cover ---
router.delete('/:bookId/cover', deleteTextbookCover);

// NEW ROUTE: For saving the back cover blurb
router.post('/:bookId/blurb', saveBackCoverBlurb);

router.post('/:bookId/generate-next-chapter', generateNextChapter);
router.post('/:bookId/chapters/:chapterNumber/regenerate', regenerateChapter);
router.post('/:bookId/checkout', createCheckoutSessionForTextBook);
router.patch('/:bookId/privacy', toggleTextBookPrivacy);
router.get('/:bookId/preview', getPreviewPdf);

export default router;