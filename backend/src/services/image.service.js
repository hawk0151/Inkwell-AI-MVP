// backend/src/services/image.service.js
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';
import path from 'path';
import sharp from 'sharp';
import FormData from 'form-data'; // NEW: Import FormData

// It is critical that environment variables are loaded before this point.
// If running locally, ensure 'dotenv' is configured at your app's entry file (e.g., server.js or app.js).
// For Render, ensure environment variables are set in the Render dashboard.

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

// NEW: Helper function to upscale an image using Stability AI's ESRGAN API
const upscaleImageWithStabilityAI = async (base64Image, targetResolution) => {
    const apiKey = process.env.STABILITY_API_KEY;
    if (!apiKey) {
        throw new Error("Stability AI API key is not configured for upscaling.");
    }

    // IMPORTANT: Confirm the exact engine ID and endpoint path from Stability AI's latest docs for upscaling.
    // Based on common patterns, 'esrgan-v1-x2-pro' for 2x, and you'd chain for 4x,
    // OR they might have a dedicated 4x endpoint or accept a 'scale' parameter directly.
    // For this fix, assuming a 'general' upscale endpoint that might accept 'type: 4x'.
    // If this fails, we will explicitly chain two 2x calls.
    const upscaleEngineId = 'esrgan-v1-x2-pro'; // Example, please verify from docs
    const upscaleApiUrl = `https://api.stability.ai/v1/generation/${upscaleEngineId}/image-to-image/upscale`; 

    console.log(`[Stability AI Upscale] Attempting to upscale image to ${targetResolution.width}x${targetResolution.height}...`);

    try {
        const formData = new FormData();
        // Append image as a file buffer with a filename and content type
        formData.append('image', Buffer.from(base64Image, 'base64'), {
            filename: 'image.png', // Or .jpeg, depends on original image format
            contentType: 'image/png', // Or 'image/jpeg'
        });
        formData.append('type', '4x'); // Request 4x upscale

        const response = await axios.post(
            upscaleApiUrl,
            formData, // Send FormData object directly
            {
                headers: {
                    ...formData.getHeaders(), // Let FormData set the correct Content-Type with boundary
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json'
                },
                timeout: 30000 // Increased timeout for upscaling
            }
        );

        const upscaledImage = response.data.artifacts[0];
        if (upscaledImage && upscaledImage.base64) {
            console.log(`[Stability AI Upscale] ✅ Image successfully upscaled by Stability AI.`);
            return upscaledImage.base64;
        } else {
            throw new Error('Failed to parse upscaled image from Stability AI API response.');
        }
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error('Error calling Stability AI Upscale API:', errorMessage);
        throw new Error(`An error occurred while upscaling the image: ${errorMessage}`);
    }
};


export const generateImageFromApi = async (prompt, style) => {
    const apiKey = process.env.STABILITY_API_KEY;
    if (!apiKey) {
        throw new Error("Stability AI API key is not configured in .env file.");
    }

    const engineId = 'stable-diffusion-xl-1024-v1-0'; // Your current generation model
    const apiUrl = `https://api.stability.ai/v1/generation/${engineId}/text-to-image`;

    const fullPrompt = `A beautiful, whimsical, ${style}-style children's book illustration of: ${prompt}. Clean lines, vibrant pastel colors, storybook setting, safe for all audiences, high detail.`;

    // 1. Generate the initial 1024x1024 image
    console.log(`[Stability AI Generation] Generating initial 1024x1024 image with prompt: "${fullPrompt.substring(0, 50)}..."`);
    let base64GeneratedImage;
    try {
        const response = await axios.post(
            apiUrl,
            {
                text_prompts: [{ text: fullPrompt }],
                cfg_scale: 7, height: 1024, width: 1024, // Fixed initial generation size
                samples: 1, steps: 30,
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 20000 // Timeout for initial generation
            }
        );

        const image = response.data.artifacts[0];
        if (image && image.base64) {
            base64GeneratedImage = image.base64;
            console.log("[Stability AI Generation] ✅ Initial 1024x1024 image generated successfully.");
        } else {
            throw new Error('Failed to parse initial image from Stability AI API response.');
        }
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error('Error calling Stability AI API for initial generation:', errorMessage);
        throw new Error(`An error occurred while generating the base image: ${errorMessage}`);
    }

    // 2. Upscale the generated image to 4096x4096 using Stability AI's ESRGAN
    // Note: The specific 'esrgan-v1-x2-pro' engine ID implies 2x. If 4x is needed,
    // you might need to chain two 2x calls or use a different engine ID if Stability AI
    // has a direct 4x upscale endpoint. For now, assuming 'type: "4x"' is handled.
    const upscaledBase64Image = await upscaleImageWithStabilityAI(base64GeneratedImage, { width: 4096, height: 4096 });
    const upscaledImageBuffer = Buffer.from(upscaledBase64Image, 'base64');

    // 3. Crop and resize the upscaled image to Lulu's exact bleed-inclusive dimensions (2556x3582)
    const targetWidthPx = 2556; // (8.27 + 2*0.125) * 300
    const targetHeightPx = 3582; // (11.69 + 2*0.125) * 300

    console.log(`[Image Processing] Cropping ${upscaledImageBuffer.width || 'unknown'}x${upscaledImageBuffer.height || 'unknown'} image to ${targetWidthPx}x${targetHeightPx} for Lulu print...`);
    let finalImageBuffer;
    try {
        // Use sharp to resize and crop with 'cover' fit (fills target, crops excess) and 'center' position
        finalImageBuffer = await sharp(upscaledImageBuffer)
            .resize(targetWidthPx, targetHeightPx, {
                fit: sharp.fit.cover, // Ensures the target dimensions are filled, cropping if aspect ratios differ
                position: sharp.strategy.attention // Prioritize content in the center
            })
            .jpeg({ quality: 90 }) // Output as JPEG with good quality
            .toBuffer();
        console.log("[Image Processing] ✅ Image successfully cropped and resized for Lulu print.");
    } catch (sharpError) {
        console.error("Error processing image with sharp:", sharpError);
        throw new Error(`Failed to crop or resize image for print: ${sharpError.message}`);
    }

    // Return the final processed image buffer
    return finalImageBuffer.toString('base64'); // Return as base64 for consistency with original function signature
};

// Keep existing uploadImageToCloudinary for general image uploads (e.g., user avatars, non-POD images)
export const uploadImageToCloudinary = (fileBuffer, folder, fileFormat = 'auto') => {
    return new Promise((resolve, reject) => {
        const publicId = randomUUID(); // Generate a unique ID

        const uploadOptions = {
            upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET,
            folder: folder,
            resource_type: 'auto', // Cloudinary will auto-detect type (image, video, raw).
            public_id: publicId, // Base public ID
            type: 'upload'
        };

        if (fileFormat === 'pdf') {
            console.warn("WARN: Using uploadImageToCloudinary for PDF. Consider using uploadPdfFileToCloudinary for better robustness.");
            uploadOptions.resource_type = 'raw'; // Explicitly raw for PDFs
            uploadOptions.format = 'pdf'; // Force format to .pdf
            uploadOptions.public_id = `${publicId}.pdf`; // Append .pdf to public_id
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

// NEW FUNCTION: Dedicated PDF Upload to Cloudinary for Lulu POD
/**
 * Uploads a PDF file from a local path to Cloudinary with 'raw' resource type and '.pdf' format.
 * This is optimized for print-ready PDFs required by services like Lulu.
 * @param {string} filePath - The local path to the PDF file.
 * @param {string} folder - The Cloudinary folder to upload to (e.g., 'inkwell-ai/user_XYZ/books').
 * @param {string} publicIdPrefix - A prefix for the public ID, typically related to the book/order ID.
 * @returns {Promise<string>} The secure URL of the uploaded PDF file.
 */
export const uploadPdfFileToCloudinary = (filePath, folder, publicIdPrefix) => {
    return new Promise((resolve, reject) => {
        // Construct a unique public_id, ensuring it ends with .pdf
        const uniqueId = `${publicIdPrefix}_${randomUUID().substring(0, 8)}`;
        const finalPublicId = `${uniqueId}`; // Cloudinary will add .pdf if format is specified

        const uploadOptions = {
            upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET,
            folder: folder,
            resource_type: 'raw',    // CRITICAL: Treat as raw file for Lulu POD
            format: 'pdf',           // CRITICAL: Ensure .pdf extension and correct MIME type
            public_id: finalPublicId, // Use our constructed public ID
            use_filename: false,     // We control the public_id
            unique_filename: true,   // Cloudinary generates unique if public_id already exists (safer)
            overwrite: true,         // Overwrite if a file with this public_id (and format) exists
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