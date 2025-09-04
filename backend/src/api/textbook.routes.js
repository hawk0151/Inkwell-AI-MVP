import express from 'express';
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
    uploadTextbookCover, 
    deleteTextbookCover,
    saveBackCoverBlurb, 
    generateAllChapters, // Correctly imported
    getGenerationStatus,  // Correctly imported
} from '../controllers/textbook.controller.js';

// FIX: This duplicate import is not needed and has been removed.
// import { protect as authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 9 * 1024 * 1024 }
});

router.use(protect);

router.get('/', getTextBooks);
router.post('/', createTextBook);
router.get('/:bookId', getTextBookDetails);
router.delete('/:bookId', deleteTextBook);

router.post('/:bookId/cover', upload.single('image'), uploadTextbookCover);
router.delete('/:bookId/cover', deleteTextbookCover);
router.post('/:bookId/blurb', saveBackCoverBlurb);

router.post('/:bookId/generate-next-chapter', generateNextChapter);
router.post('/:bookId/chapters/:chapterNumber/regenerate', regenerateChapter);
router.post('/:bookId/checkout', createCheckoutSessionForTextBook);
router.patch('/:bookId/privacy', toggleTextBookPrivacy);
router.get('/:bookId/preview', getPreviewPdf);

// NEW ROUTES: Add these two lines to define the routes for the new functions.
router.post('/:bookId/generate-all', generateAllChapters);
router.get('/:bookId/generation-status', getGenerationStatus);
router.post('/:bookId/cancel-generation', cancelGeneration);

export default router;