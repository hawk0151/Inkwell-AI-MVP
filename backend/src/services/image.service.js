// backend/src/services/image.service.js

// CHANGES:
// - FIXED: Enhanced public_id generation for `uploadImageToCloudinary` to be more descriptive and ensure uniqueness.
// - FIXED: Explicitly set `resource_type: 'image'` for generated images to avoid 'auto' detection issues.

import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';
import path from 'path'; // Still used for path.basename in original uploadImageToCloudinary for filename extraction, if needed.
import FormData from 'form-data'; // Needed for multipart/form-data

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
        const formData = new FormData();
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

        const image = response.data.image;
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
        // REVISED: More specific public_id for AI generated images
        const uniqueSuffix = randomUUID().substring(0, 8);
        const finalPublicId = `${folder.split('/').pop()}_generated_${uniqueSuffix}`; // e.g., 'generated_5256e374'

        const uploadOptions = {
            upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET,
            folder: folder,
            resource_type: 'image', // <--- EXPLICITLY SET TO 'image'
            public_id: finalPublicId, // Use the new specific publicId
            type: 'upload',
            access_mode: 'public'
        };

        // NEW DEBUG: Log upload options before upload
        console.log('[Cloudinary Upload] Initiating upload with options:', {
            upload_preset: uploadOptions.upload_preset,
            folder: uploadOptions.folder,
            resource_type: uploadOptions.resource_type,
            public_id: uploadOptions.public_id,
            type: uploadOptions.type,
            access_mode: uploadOptions.access_mode,
            fileFormat: fileFormat // Also log the passed fileFormat
        });

        // The fileFormat logic below is primarily for user uploads,
        // as AI generates JPEG base64 and we explicitly set resource_type: 'image' above.
        // For AI generated images, fileFormat will typically be 'auto' or 'jpeg' implicitly.
        if (fileFormat === 'pdf') {
            console.warn("WARN: Using uploadImageToCloudinary for PDF. Consider using uploadPdfFileToCloudinary for better robustness.");
            uploadOptions.resource_type = 'raw';
            uploadOptions.format = 'pdf';
            uploadOptions.public_id = `${finalPublicId}.pdf`; // Append .pdf for PDFs
        } else if (fileFormat !== 'auto') { // e.g. if we specifically pass 'png' or 'jpeg'
            uploadOptions.resource_type = 'image';
            uploadOptions.format = fileFormat;
            // For these, public_id might need to include format explicitly if it's not already in finalPublicId
            // But if it's already a good publicId, Cloudinary will infer format from file buffer.
        }
        
        cloudinary.uploader.upload_stream(uploadOptions,
            (error, result) => {
                if (error) {
                    console.error("Cloudinary Upload Error:", error);
                    // NEW DEBUG: Log full Cloudinary error response
                    if (error.http_code) {
                        console.error(`[Cloudinary Upload] HTTP Error Code: ${error.http_code}`);
                    }
                    if (error.response && error.response.data) {
                        console.error('[Cloudinary Upload] Cloudinary API Error Response Data:', error.response.data);
                    }
                    return reject(error);
                }
                console.log(`[Cloudinary Upload] ✅ Successful upload! Secure URL: ${result.secure_url}`);
                console.log('[Cloudinary Upload] Full result from Cloudinary:', JSON.stringify(result, null, 2));

                resolve(result.secure_url);
            }
        ).end(fileBuffer);
    });
};

export const uploadPdfFileToCloudinary = (filePath, folder, publicIdPrefix) => {
    return new Promise((resolve, reject) => {
        const uniqueSuffix = randomUUID().substring(0, 8);
        const finalPublicId = `${publicIdPrefix}_${uniqueSuffix}`; // Updated to use uniqueSuffix

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