// backend/src/api/textbook.routes.js

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
    // --- NEW: Import the new controller function ---
    uploadTextbookCover, 
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

// --- NEW: Add the route for uploading a custom textbook cover ---
// This uses the 'upload' middleware to expect a single file with the field name 'image'.
router.post('/:bookId/cover', upload.single('image'), uploadTextbookCover);

router.post('/:bookId/generate-next-chapter', generateNextChapter);
router.post('/:bookId/chapters/:chapterNumber/regenerate', regenerateChapter);
router.post('/:bookId/checkout', createCheckoutSessionForTextBook);
router.patch('/:bookId/privacy', toggleTextBookPrivacy);
router.get('/:bookId/preview', getPreviewPdf);

export default router;