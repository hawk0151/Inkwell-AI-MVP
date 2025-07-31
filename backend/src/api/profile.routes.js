import express from 'express';
import { protect, optionalAuth } from '../middleware/auth.middleware.js';
import {
    getProfileByUsername,
    updateMyProfile,
    toggleFollow
} from '../controllers/profile.controller.js';

const router = express.Router();

// GET a user's profile by their username
router.get('/:username', optionalAuth, getProfileByUsername);

// PUT to update the currently logged-in user's profile
router.put('/me', protect, updateMyProfile);

// POST to toggle the follow status for a given user ID
router.post('/:userIdToToggle/toggle-follow', protect, toggleFollow);

export default router;