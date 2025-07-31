// backend/src/api/feed.routes.js
import { Router } from 'express';
import { getForYouFeed } from '../controllers/feed.controller.js';
import { protect as authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

/**
 * @route   GET /api/social/feed/foryou
 * @desc    Get the personalized "For You" feed for the logged-in user
 * @access  Private
 */
router.get('/foryou', authMiddleware, getForYouFeed);

export default router;