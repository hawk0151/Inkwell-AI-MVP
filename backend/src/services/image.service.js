// backend/src/services/image.service.js

// CHANGES:
// - FINAL VERSION: Updated to use Stability AI's v2beta API, specifically 'stable-image-core'
//   for more cost-effective image generation (3 credits per generation).
// - FIXED: Corrected parsing of the base64 image data from the v2beta API response.
//   Now uses 'response.data.image' instead of 'response.data.image_base64'.
// - FIXED: Resolved 'formData.getHeaders is not a function' error by ensuring the 'form-data'
//   package is installed and correctly imported/used for multipart/form-data requests.
// - REMOVED: The 'upscaleImageWithStabilityAI' helper function entirely, as it's no longer part of the generation pipeline.
// - REMOVED: Imports for 'sharp', as it's no longer required for image processing.
// - Directly requests images at Lulu's target print dimensions (2556x3582 pixels at 300 DPI with bleed).
// - Sets aspect_ratio and output_format for optimal generation.

import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';
import path from 'path';
import FormData from 'form-data'; // IMPORTANT: Ensure 'form-data' package is installed (npm install form-data)

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

    const engineId = 'stable-image-core';
    const apiUrl = `https://api.stability.ai/v2beta/stable-image/generate/core`;

    const fullPrompt = `A beautiful, whimsical, ${style}-style children's book illustration of: ${prompt}. Clean lines, vibrant pastel colors, storybook setting, safe for all audiences, high detail. Print-ready, high-resolution.`;

    const targetWidthPx = 2556;
    const targetHeightPx = 3582;
    const aspectRatio = '2:3';

    console.log(`[Stability AI Generation] Generating image with Stable Image Core: ${targetWidthPx}x${targetHeightPx} for prompt: "${fullPrompt.substring(0, Math.min(fullPrompt.length, 75))}..."`);
    let base64GeneratedImage;

    try {
        const formData = new FormData(); // Now this should be from the 'form-data' package
        formData.append('prompt', fullPrompt);
        formData.append('output_format', 'jpeg');
        formData.append('width', targetWidthPx.toString());
        formData.append('height', targetHeightPx.toString());
        formData.append('aspect_ratio', aspectRatio);
        formData.append('seed', '0');
        formData.append('style_preset', 'digital-art');

        const response = await axios.post(
            apiUrl,
            formData,
            {
                headers: {
                    ...formData.getHeaders(), // This method should now be available
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json'
                },
                timeout: 60000
            }
        );

        const image = response.data.image; // Corrected access to the 'image' field
        if (image) {
            base64GeneratedImage = image;
            console.log(`[Stability AI Generation] ✅ ${targetWidthPx}x${targetHeightPx} image generated successfully using Stable Image Core.`);
        } else {
            console.error('Stability AI API Response (missing "image" field):', JSON.stringify(response.data, null, 2));
            throw new Error('Failed to parse image from Stability AI API response: Missing "image" field.');
        }
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error('Error calling Stability AI API for image generation (Stable Image Core):', errorMessage);
        throw new Error(`An error occurred while generating the image: ${errorMessage}`);
    }

    return base64GeneratedImage;
};

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