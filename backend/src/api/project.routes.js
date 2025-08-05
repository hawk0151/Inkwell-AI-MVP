// backend/src/api/project.routes.js
import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { getAllProjects } from '../controllers/project.controller.js';

const router = express.Router();

// This single endpoint will fetch all projects for the logged-in user.
router.get('/', protect, getAllProjects);

export default router;