// backend/src/api/social.book.routes.js
import { Router } from 'express';
import {
    likeBook,
    unlikeBook,
    addComment,
    getCommentsForBook,
    deleteComment,
    toggleBookPrivacy // This should be in a more general book management route, but keeping it here for now as per project context
} from '../controllers/social.book.controller.js';
import { protect as authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// Likes
router.post('/like', authMiddleware, likeBook);
router.post('/unlike', authMiddleware, unlikeBook);

// Comments
router.post('/comment', authMiddleware, addComment);
router.get('/:bookId/:bookType/comments', getCommentsForBook); // GET for fetching comments
router.delete('/:commentId/:bookId/:bookType/comment', authMiddleware, deleteComment);

// Book Privacy Toggle (Consider if this should be here or in a more general book management route)
router.post('/toggle-privacy', authMiddleware, toggleBookPrivacy);

export default router;