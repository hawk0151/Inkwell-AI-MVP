// backend/src/controllers/image.controller.js
import { generateImageFromApi, uploadImageToCloudinary } from '../services/image.service.js';

export const generateImage = async (req, res) => {
    const { prompt, style } = req.body;
    const userId = req.userId;

    if (!prompt || !style) {
        return res.status(400).json({ message: 'A prompt and style are required.' });
    }

    try {
        const imageBase64 = await generateImageFromApi(prompt, style);
        const imageBuffer = Buffer.from(imageBase64, 'base64');
        
        const folder = `inkwell-ai/user_${userId}/generated`;
        const imageUrl = await uploadImageToCloudinary(imageBuffer, folder);

        res.status(200).json({ imageUrl });
    } catch (error) {
        console.error("Error generating image:", error); 
        res.status(500).json({ message: 'Failed to generate image.' });
    }
};

export const uploadUserImage = async (req, res) => {
    const userId = req.userId;

    if (!req.file) {
        return res.status(400).json({ message: 'No image file provided.' });
    }

    // --- WORKAROUND CHANGE: Add server-side file size validation ---
    const MAX_FILE_SIZE_MB = 2;
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

    if (req.file.size > MAX_FILE_SIZE_BYTES) {
        console.warn(`User ${userId} attempted to upload file larger than ${MAX_FILE_SIZE_MB}MB.`);
        // 413 is the "Payload Too Large" status code
        return res.status(413).json({ message: `File size cannot exceed ${MAX_FILE_SIZE_MB}MB.` });
    }

    try {
        const folder = `inkwell-ai/user_${userId}/uploads`;
        const imageUrl = await uploadImageToCloudinary(req.file.buffer, folder); 
        res.status(200).json({ imageUrl }); 
    } catch (error) {
        console.error("Error uploading user image:", error); 
        res.status(500).json({ message: 'Failed to upload image.' });
    }
};