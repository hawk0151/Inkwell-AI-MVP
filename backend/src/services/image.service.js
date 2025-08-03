// backend/src/services/image.service.js

// CHANGES:
// - FINAL VERSION: Updated to use Stability AI's v2beta API, specifically 'stable-image-ultra' for direct high-resolution generation.
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
console.log("CLOUDINARY_API_SECRET:", process.env.CLOUDINARY_API_SECRET ? "SET" : "NOT SET");
console.log("CLOUDINARY_UPLOAD_PRESET:", process.env.CLOUDINARY_UPLOAD_PRESET ? "SET" : "NOT SET");

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

// The `upscaleImageWithStabilityAI` function has been REMOVED entirely from this file
// as the strategy is now direct high-resolution generation via the v2beta API.

export const generateImageFromApi = async (prompt, style) => {
    const apiKey = process.env.STABILITY_API_KEY;
    if (!apiKey) {
        throw new Error("Stability AI API key is not configured in .env file.");
    }

    // NEW: Use the v2beta API and 'stable-image-ultra' engine
    const engineId = 'stable-image-ultra'; 
    const apiUrl = `https://api.stability.ai/v2beta/stable-image/generate/ultra`;

    const fullPrompt = `A beautiful, whimsical, ${style}-style children's book illustration of: ${prompt}. Clean lines, vibrant pastel colors, storybook setting, safe for all audiences, high detail.` +
                       ` Print-ready, high-resolution, 300 DPI.`; // Added print-ready keywords to prompt

    // Lulu's target dimensions for A4 Premium Picture Book (8.27x11.69") at 300 DPI with 0.125" bleed
    const targetWidthPx = 2556; // (8.27 + 2*0.125) * 300
    const targetHeightPx = 3582; // (11.69 + 2*0.125) * 300
    const aspectRatio = '2:3'; // Closest common aspect ratio for the target dimensions (2556/3582 ≈ 0.713, 2/3 ≈ 0.667)

    console.log(`[Stability AI Generation] Generating image with Stable Image Ultra: ${targetWidthPx}x${targetHeightPx} for prompt: "${fullPrompt.substring(0, Math.min(fullPrompt.length, 75))}..."`);
    let base64GeneratedImage;

    try {
        const response = await axios.post(
            apiUrl,
            {
                prompt: fullPrompt,
                output_format: 'jpeg', // Recommended for smaller file sizes and print
                width: targetWidthPx,   // Direct pixel width request
                height: targetHeightPx, // Direct pixel height request
                aspect_ratio: aspectRatio, // Guide for generation aspect ratio
                seed: 0, // 0 for random seed, or set a specific number for reproducibility
                style_preset: 'digital-art', // Or 'fantasy-art', 'photographic', etc., based on preference
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json', // v2beta API expects JSON for Ultra/Core generation
                    'Accept': 'application/json' // Request base64 JSON response
                },
                timeout: 60000 // Increased timeout for higher resolution generation
            }
        );

        // Check v2beta response structure: it's typically 'image_base64' directly in the response body
        const image = response.data.image_base64; 
        if (image) {
            base64GeneratedImage = image;
            console.log(`[Stability AI Generation] ✅ ${targetWidthPx}x${targetHeightPx} image generated successfully.`);
        } else {
            // Log full response data if image_base64 is missing for better debugging
            console.error('Stability AI API Response (missing image_base64):', JSON.stringify(response.data, null, 2));
            throw new Error('Failed to parse image from Stability AI API response: Missing image_base64.');
        }
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error('Error calling Stability AI API for image generation (Stable Image Ultra):', errorMessage);
        throw new Error(`An error occurred while generating the image: ${errorMessage}`);
    }

    // No more upscaling or sharp cropping needed here, as the image is generated at the final size.
    return base64GeneratedImage;
};

// Keep existing uploadImageToCloudinary for general image uploads (e.g., user avatars, non-POD images)
// This function remains unchanged from previous versions, as it's for general image uploads.
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
// This function remains unchanged from previous versions, as it's for PDF-specific uploads.
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