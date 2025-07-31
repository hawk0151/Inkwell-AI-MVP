import express from 'express';
import { getInkwellDomain, saveProject } from '../controllers/user.controller.js';

const router = express.Router();

// Route for Inkwell-domain (assuming GET request for domain info)
router.get('/Inkwell-domain', getInkwellDomain);

// Route for saving a project (assuming POST request)
router.post('/save-project', saveProject);

// Changed to named export
export { router };