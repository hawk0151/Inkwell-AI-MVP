// backend/src/api/textbook.routes.js

import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
    createTextBook,
    getTextBooks,
    getTextBookDetails,
    generateNextChapter,
    // FIXED: The function name is createCheckoutSessionForTextBook
    createCheckoutSessionForTextBook,
    toggleTextBookPrivacy,
    deleteTextBook
} from '../controllers/textbook.controller.js';

const router = express.Router();

// This middleware protects all routes in this file
router.use(protect);

router.get('/', getTextBooks);
router.post('/', createTextBook);
router.get('/:bookId', getTextBookDetails);
router.delete('/:bookId', deleteTextBook);
router.post('/:bookId/generate-chapter', generateNextChapter);
// FIXED: This now correctly references the imported function name
router.post('/:bookId/checkout', createCheckoutSessionForTextBook);
router.patch('/:bookId/privacy', toggleTextBookPrivacy);

export default router;