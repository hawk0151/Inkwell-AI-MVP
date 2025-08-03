// backend/src/services/image.service.js

// CHANGES:
// - FINAL VERSION: Updated to use Stability AI's v2beta API, specifically 'stable-image-ultra' for direct high-resolution generation.
// - REMOVED: The 'upscaleImageWithStabilityAI' helper function entirely, as it's no longer part of the generation pipeline.
// - RE-INTRODUCED: Imports for 'form-data' and implemented its usage for the main generation API call,
//   as the v2beta /generate/ultra endpoint also requires 'multipart/form-data'.
// - Directly requests images at Lulu's target print dimensions (2556x3582 pixels at 300 DPI with bleed).
// - Sets aspect_ratio and output_format for optimal generation.

import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';
import path from 'path';
// Removed 'sharp' import
import FormData from 'form-data'; // RE-INTRODUCED: Needed for multipart/form-data

console.log("DEBUG: Cloudinary config values from process.env:");
console.log("CLOUDINARY_CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME ? "SET" : "NOT SET");
console.log("CLOUDINARY_API_KEY:", process.env.CLOUDINARY_API_KEY ? "SET" : "NOT SET");
console.log("CLOUDINARY_API_SECRET:", process.env.CLOUDINARY_API_SECRET ? "SET" : "NOT SET");
console.log("CLOUDINARY_UPLOAD_PRESET:", process.env.CLOUDINARY_UPLOAD_PRESET ? "SET" : "NOT SET");

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

export const generateImageFromApi = async (prompt, style) => {
    const apiKey = process.env.STABILITY_API_KEY;
    if (!apiKey) {
        throw new Error("Stability AI API key is not configured in .env file.");
    }

    const engineId = 'stable-image-ultra'; 
    const apiUrl = `https://api.stability.ai/v2beta/stable-image/generate/ultra`;

    const fullPrompt = `A beautiful, whimsical, ${style}-style children's book illustration of: ${prompt}. Clean lines, vibrant pastel colors, storybook setting, safe for all audiences, high detail. Print-ready, high-resolution, 300 DPI.`;

    const targetWidthPx = 2556;
    const targetHeightPx = 3582;
    const aspectRatio = '2:3'; 

    console.log(`[Stability AI Generation] Generating image with Stable Image Ultra: ${targetWidthPx}x${targetHeightPx} for prompt: "${fullPrompt.substring(0, Math.min(fullPrompt.length, 75))}..."`);
    let base64GeneratedImage;

    try {
        // NEW: Use FormData for the request body
        const formData = new FormData();
        formData.append('prompt', fullPrompt);
        formData.append('output_format', 'jpeg');
        formData.append('width', targetWidthPx.toString()); // Convert numbers to string for FormData
        formData.append('height', targetHeightPx.toString()); // Convert numbers to string for FormData
        formData.append('aspect_ratio', aspectRatio);
        formData.append('seed', '0'); // Convert number to string for FormData
        formData.append('style_preset', 'digital-art'); // Example, can be dynamic or chosen

        const response = await axios.post(
            apiUrl,
            formData, // Send FormData object directly
            {
                headers: {
                    ...formData.getHeaders(), // Let FormData set the correct Content-Type with boundary
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json' // Request base64 JSON response
                },
                timeout: 60000
            }
        );

        const image = response.data.image_base64; 
        if (image) {
            base64GeneratedImage = image;
            console.log(`[Stability AI Generation] ✅ ${targetWidthPx}x${targetHeightPx} image generated successfully.`);
        } else {
            console.error('Stability AI API Response (missing image_base64):', JSON.stringify(response.data, null, 2));
            throw new Error('Failed to parse image from Stability AI API response: Missing image_base64.');
        }
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error('Error calling Stability AI API for image generation (Stable Image Ultra):', errorMessage);
        throw new Error(`An error occurred while generating the image: ${errorMessage}`);
    }

    return base64GeneratedImage;
};

// Keep existing uploadImageToCloudinary for general image uploads (e.g., user avatars, non-POD images)
export const uploadImageToCloudinary = (fileBuffer, folder, fileFormat = 'auto') => {
    return new Promise((resolve, reject) => {
        const publicId = randomUUID();

        const uploadOptions = {
            upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET,
            folder: folder,
            resource_type: 'auto',
            public_id: publicId,
            type: 'upload'
        };

        if (fileFormat === 'pdf') {
            console.warn("WARN: Using uploadImageToCloudinary for PDF. Consider using uploadPdfFileToCloudinary for better robustness.");
            uploadOptions.resource_type = 'raw';
            uploadOptions.format = 'pdf';
            uploadOptions.public_id = `${publicId}.pdf`;
        } else if (fileFormat !== 'auto') {
            uploadOptions.resource_type = 'image';
            uploadOptions.format = fileFormat;
            uploadOptions.public_id = `${publicId}.${fileFormat}`;
        }

        cloudinary.uploader.upload_stream(uploadOptions,
            (error, result) => {
                if (error) {
                    console.error("Cloudinary Upload Error:", error);
                    return reject(error);
                }
                resolve(result.secure_url);
            }
        ).end(fileBuffer);
    });
};

export const uploadPdfFileToCloudinary = (filePath, folder, publicIdPrefix) => {
    return new Promise((resolve, reject) => {
        const uniqueId = `${publicIdPrefix}_${randomUUID().substring(0, 8)}`;
        const finalPublicId = `${uniqueId}`;

        const uploadOptions = {
            upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET,
            folder: folder,
            resource_type: 'raw',
            format: 'pdf',
            public_id: finalPublicId,
            use_filename: false,
            unique_filename: true,
            overwrite: true,
            type: 'upload',
            access_mode: 'public'
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