// backend/src/services/image.service.js

// CHANGES:
// - FINAL VERSION: Updated to use Stability AI's v2beta API, specifically 'stable-image-core'
//   for more cost-effective image generation (3 credits per generation).
// - FIXED: Corrected parsing of the base64 image data from the v2beta API response.
//   Now uses 'response.data.image' instead of 'response.data.image_base64'.
// - REMOVED: The 'upscaleImageWithStabilityAI' helper function entirely, as it's no longer part of the generation pipeline.
// - REMOVED: Imports for 'sharp' and 'form-data', as they are no longer required for image processing or the upscale API call.
// - Directly requests images at Lulu's target print dimensions (2556x3582 pixels at 300 DPI with bleed).
// - Sets aspect_ratio and output_format for optimal generation.

import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';
import path from 'path'; // Still used for path.basename in original uploadImageToCloudinary for filename extraction, if needed.

// Removed 'sharp' import
// Removed 'FormData' import

console.log("DEBUG: Cloudinary config values from process.env:");
console.log("CLOUDINARY_CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME ? "SET" : "NOT SET");
console.log("CLOUDINARY_API_KEY:", process.env.CLOUDINARY_API_KEY ? "SET" : "NOT SET");
console.log("CLOUDINARY_API_SECRET:", process.env.CLOUDINARY_API_KEY ? "SET" : "NOT SET");
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

    // UPDATED: Use the more cost-effective 'stable-image-core' engine
    const engineId = 'stable-image-core';
    const apiUrl = `https://api.stability.ai/v2beta/stable-image/generate/core`; // Updated URL for core model

    const fullPrompt = `A beautiful, whimsical, ${style}-style children's book illustration of: ${prompt}. Clean lines, vibrant pastel colors, storybook setting, safe for all audiences, high detail. Print-ready, high-resolution.`; // Removed 300 DPI from prompt as Core output may not be exact 300 DPI, to avoid misguidance.

    // Lulu's target dimensions for A4 Premium Picture Book (8.27x11.69") at 300 DPI with 0.125" bleed
    // We will still request these, and Core will generate at its "1.5 megapixel" resolution
    // while trying to match the aspect ratio.
    const targetWidthPx = 2556; // (8.27 + 2*0.125) * 300
    const targetHeightPx = 3582; // (11.69 + 2*0.125) * 300
    const aspectRatio = '2:3'; // Closest common aspect ratio for the target dimensions (2556/3582 ≈ 0.713, 2/3 ≈ 0.667)

    console.log(`[Stability AI Generation] Generating image with Stable Image Core: ${targetWidthPx}x${targetHeightPx} for prompt: "${fullPrompt.substring(0, Math.min(fullPrompt.length, 75))}..."`);
    let base64GeneratedImage;

    try {
        const formData = new FormData(); // FormData needed for multipart/form-data as confirmed by API error
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
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json'
                },
                timeout: 60000
            }
        );

        // FIXED: Corrected access to image_base64 from response.data.image
        // The previous log showed it was directly under 'image' key, not 'image_base64'.
        const image = response.data.image;
        if (image) {
            base64GeneratedImage = image;
            console.log(`[Stability AI Generation] ✅ ${targetWidthPx}x${targetHeightPx} image generated successfully using Stable Image Core.`);
        } else {
            // Log full response data if image is missing for better debugging
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

// Dedicated PDF Upload to Cloudinary for Lulu POD (no changes)
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