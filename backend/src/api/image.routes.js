// backend/src/api/image.routes.js
import express from 'express';
import multer from 'multer';
import { generateImage, uploadUserImage } from '../controllers/image.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);
router.post('/generate', generateImage);
router.post('/upload', upload.single('image'), uploadUserImage);

export default router;
