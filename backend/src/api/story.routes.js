// backend/src/api/story.routes.js
import express from 'express';
import { generateStory } from '../controllers/story.controller.js';

const router = express.Router();

// Route for generating a story from a prompt
// POST /api/story/generate
router.post('/generate', generateStory);

export default router;
