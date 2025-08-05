// backend/src/services/image.service.js
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';
import FormData from 'form-data';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

export const generateImageFromApi = async (prompt, style) => {
    const apiKey = process.env.STABILITY_API_KEY;
    if (!apiKey) {
        throw new Error("Stability AI API key is not configured.");
    }

    const engineId = 'stable-image-core';
    const apiUrl = `https://api.stability.ai/v2beta/stable-image/generate/core`;

    const fullPrompt = `A beautiful, whimsical, ${style}-style children's book illustration of: ${prompt}. Clean lines, vibrant pastel colors, storybook setting, safe for all audiences, high detail. Print-ready.`;

    // --- WORKAROUND CHANGE: Reduced image dimensions for smaller file size ---
    // Old dimensions were too large (2556x3582). New dimensions are smaller but still good quality for print.
    // Also corrected to a landscape aspect ratio to match the book.
    const targetWidthPx = 1536;
    const targetHeightPx = 1024;
    const aspectRatio = '3:2';

    console.log(`[Stability AI Generation] Generating image at lower resolution: ${targetWidthPx}x${targetHeightPx}...`);
    
    try {
        const formData = new FormData();
        formData.append('prompt', fullPrompt);
        formData.append('output_format', 'jpeg');
        formData.append('width', targetWidthPx.toString());
        formData.append('height', targetHeightPx.toString());
        formData.append('aspect_ratio', aspectRatio);
        formData.append('style_preset', 'digital-art'); // A good general-purpose preset

        const response = await axios.post(
            apiUrl,
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json'
                },
                timeout: 60000
            }
        );

        if (response.data.image) {
            console.log(`[Stability AI Generation] ✅ Image generated successfully.`);
            return response.data.image; // Return base64 image
        } else {
            throw new Error('Failed to parse image from Stability AI API response.');
        }
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error('Error calling Stability AI API:', errorMessage);
        throw new Error(`An error occurred while generating the image.`);
    }
};

export const uploadImageToCloudinary = (fileBuffer, folder) => {
    return new Promise((resolve, reject) => {
        const uniqueSuffix = randomUUID().substring(0, 8);
        const finalPublicId = `${folder.split('/').pop()}_${uniqueSuffix}`;

        const uploadOptions = {
            upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET,
            folder: folder,
            resource_type: 'image',
            public_id: finalPublicId,
        };

        cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
            if (error) {
                console.error("Cloudinary Upload Error:", error);
                return reject(error);
            }
            resolve(result.secure_url);
        }).end(fileBuffer);
    });
};

export const uploadPdfFileToCloudinary = (filePath, folder, publicIdPrefix) => {
    return new Promise((resolve, reject) => {
        const uniqueSuffix = randomUUID().substring(0, 8);
        const finalPublicId = `${publicIdPrefix}_${uniqueSuffix}`;
        const uploadOptions = {
            upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET,
            folder: folder,
            resource_type: 'raw',
            public_id: finalPublicId,
        };
        cloudinary.uploader.upload(filePath, uploadOptions, (error, result) => {
            if (error) {
                console.error("Cloudinary PDF Upload Error:", error);
                return reject(error);
            }
            console.log(`Cloudinary PDF Upload Successful: ${result.secure_url}`);
            resolve(result.secure_url);
        });
    });
};