import express from 'express';
import upload from '../utils/upload.js'; // Import our Multer configuration
import { uploadImage } from '../controllers/fileController.js'; // Import the upload controller function

const router = express.Router();

// Define the POST route for image uploads.
// `upload.single('image')` means Multer expects a single file under the field name 'image'.
router.post('/image', upload.single('image'), uploadImage);

export default router;