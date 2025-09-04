import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import multer from 'multer';

import {
    createPictureBook,
    getPictureBooks,
    getPictureBook,
    deletePictureBook,
    saveTimelineEvents,
    createBookCheckoutSession,
    togglePictureBookPrivacy,
    generatePreviewPdf,
    uploadCoverImage,
    prepareBookForPrint,
    uploadEventImage,
    saveStoryBible,
    generateCharacterReferences,
    selectCharacterReference,
    generateStoryPlan,
    generateSinglePageImage,
    improvePrompt,
    generateAllImages,
    getGenerationStatus // ✅ NEW: Import the new controller function
} from '../controllers/pictureBook.controller.js';
console.log('--- PICTURE BOOK ROUTES FILE LOADED ---'); 
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);

// --- Book-Level Routes ---
router.get('/', getPictureBooks);
router.post('/', createPictureBook);
router.get('/:bookId', getPictureBook);
router.delete('/:bookId', deletePictureBook);
router.patch('/:bookId/privacy', togglePictureBookPrivacy);
router.post('/:bookId/cover', upload.single('image'), uploadCoverImage);
router.get('/:bookId/preview', generatePreviewPdf);
router.post('/:bookId/prepare-for-print', prepareBookForPrint);
router.post('/:bookId/checkout', createBookCheckoutSession);
router.post('/:bookId/generate-all-images', generateAllImages);

// ✅ NEW: Route to get the status of all asynchronous jobs for a book.
router.get('/:bookId/generation-status', getGenerationStatus);


// --- Story Bible & Generation Routes ---
router.post('/:bookId/story-bible', saveStoryBible);
router.post('/:bookId/generate-character-references', generateCharacterReferences);
router.post('/:bookId/select-character-reference', selectCharacterReference);
router.post('/:bookId/generate-story-plan', generateStoryPlan);

// --- AI Utility Routes ---
router.post('/improve-prompt', improvePrompt);

// --- Page-Level Routes ---
router.post('/:bookId/events', saveTimelineEvents);
router.post('/events/:eventId/upload-image', upload.single('image'), uploadEventImage);
router.post('/:bookId/pages/:pageNumber/generate', generateSinglePageImage);

export default router;