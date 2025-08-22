// This is the complete, correct, and final version of this file.
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';
import FormData from 'form-data';
import sharp from 'sharp';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

const createWebAndPrintVersion = async (inputBuffer) => {
    return sharp(inputBuffer).jpeg({ quality: 80 }).toBuffer();
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generates an image from a text prompt for the initial character reference.
 * Uses the /core endpoint for text-to-image.
 */
export const generateImageFromApi = async (prompt, style_preset, negativePrompt, seed) => {
    const apiKey = process.env.STABILITY_API_KEY; 
    if (!apiKey) throw new Error("Stability AI API key is not configured.");
    
    const apiUrl = `https://api.stability.ai/v2beta/stable-image/generate/core`;
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const formData = new FormData();
            formData.append('prompt', prompt);
            formData.append('negative_prompt', negativePrompt);
            formData.append('output_format', 'png');
            formData.append('width', 1024);
            formData.append('height', 1024);
            if (seed !== undefined) formData.append('seed', seed);

            // --- FIX: Correctly append the style_preset to the form data ---
            if (style_preset) {
                formData.append('style_preset', style_preset);
                console.log(`[Image Service] Using style_preset: ${style_preset}`);
            }

            const response = await axios.post(apiUrl, formData, {
                headers: { ...formData.getHeaders(), Authorization: `Bearer ${apiKey}`, Accept: 'image/*' },
                responseType: 'arraybuffer',
                timeout: 300000 
            });
            return Buffer.from(response.data);
        } catch (error) {
            console.error(`❌ [Stability AI] Attempt ${attempt} failed on /core text-to-image.`);
            if (attempt === MAX_RETRIES) throw new Error(`An error occurred while generating the character reference.`);
            await delay(5000);
        }
    }
};

/**
 * Generates a scene image, using the /core endpoint for both text-to-image (scenery)
 * and image-to-image (character scenes).
 */
export const generateImageFromReference = async (options) => {
    const { referenceImageUrl, prompt, pageNumber, seed = 0, isSceneryOnly = false } = options;
    const apiKey = process.env.STABILITY_API_KEY;
    if (!apiKey) throw new Error("Stability AI API key is not configured.");

    const apiUrl = 'https://api.stability.ai/v2beta/stable-image/generate/core';
    console.log(`[Image Service] Using CORE endpoint: ${apiUrl} for page ${pageNumber}`);
    
    try {
        const formData = new FormData();
        formData.append('prompt', prompt);
        formData.append('seed', seed);
        formData.append('output_format', 'png');
        // Use a consistent resolution for scenes
        formData.append('width', 1024);
        formData.append('height', 1024);
        
        if (isSceneryOnly) {
            console.log(`[Image Service] Generating scenery-only (text-to-image) for page ${pageNumber}.`);
            formData.append('negative_prompt', 'ugly, blurry, text, watermark, signature');
        } else {
            console.log(`[Image Service] Generating image-to-image with character reference for page ${pageNumber}.`);
            if (!referenceImageUrl) throw new Error("A character reference image is required.");
            
            const imageResponse = await axios.get(referenceImageUrl, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(imageResponse.data);
            
            formData.append('image', imageBuffer, { filename: 'reference.png', contentType: 'image/png' });
            formData.append('strength', 0.65);
            formData.append('negative_prompt', 'white background, blank background, studio backdrop, blurry, text, watermark, signature');
        }

        const response = await axios.post(apiUrl, formData, {
            headers: { ...formData.getHeaders(), Authorization: `Bearer ${apiKey}`, Accept: 'image/*' },
            responseType: 'arraybuffer',
            timeout: 300000
        });

        return Buffer.from(response.data);

    } catch (error) {
        const errorMessage = error.response?.data ? Buffer.from(error.response.data).toString() : error.message;
        console.error(`[Image Service] Error generating image for page ${pageNumber}:`, errorMessage);
        throw new Error(`An error occurred while generating the image for page ${pageNumber}. Details: ${errorMessage}`);
    }
};

/**
 * Uploads an image buffer to Cloudinary.
 */
export const uploadImageToCloudinary = (fileBuffer, folder, publicIdPrefix) => {
    return new Promise((resolve, reject) => {
        const finalPublicId = `${publicIdPrefix}_${randomUUID().substring(0, 8)}`;
        const uploadOptions = { folder, resource_type: 'image', public_id: finalPublicId };
        cloudinary.uploader.upload_stream(uploadOptions, (err, result) => {
            if (err) {
                console.error("Cloudinary Upload Error:", err);
                return reject(err);
            }
            resolve(result.secure_url);
        }).end(fileBuffer);
    });
};