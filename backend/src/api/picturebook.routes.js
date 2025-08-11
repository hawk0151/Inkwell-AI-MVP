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
    prepareBookForPrint,
    uploadEventImage,
} from '../controllers/picturebook.controller.js';
import multer from 'multer';

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

// --- Event/Page Routes ---
router.post('/:bookId/events', saveTimelineEvents);
router.post('/:bookId/events/:pageNumber/generate-image', generateEventImage);
router.post('/events/:eventId/upload-image', upload.single('image'), uploadEventImage);


export default router;