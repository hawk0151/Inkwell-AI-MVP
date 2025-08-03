// backend/src/services/image.service.js
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';
import path from 'path';
import sharp from 'sharp';
import FormData from 'form-data';

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
// This now performs two chained 2x upscales to achieve 4x
const upscaleImageWithStabilityAI = async (base64Image) => { // Removed targetResolution as it's implied by chaining
    const apiKey = process.env.STABILITY_API_KEY;
    if (!apiKey) {
        throw new Error("Stability AI API key is not configured for upscaling.");
    }

    const upscaleEngineId = 'esrgan-v1-x2-pro'; // This is a 2x upscaler
    const upscaleApiUrl = `https://api.stability.ai/v1/generation/${upscaleEngineId}/image-to-image/upscale`; 

    console.log(`[Stability AI Upscale] Starting 2-step upscaling process (1024x1024 -> 4096x4096)...`);

    try {
        // Step 1: Upscale 1024x1024 to 2048x2048
        console.log(`[Stability AI Upscale] Step 1/2: Upscaling to 2x (2048x2048)...`);
        let formData1 = new FormData();
        formData1.append('image', Buffer.from(base64Image, 'base64'), {
            filename: 'image_1x.png',
            contentType: 'image/png',
        });
        // No 'type' field needed, as it's a direct 2x upscale endpoint

        const response1 = await axios.post(
            upscaleApiUrl,
            formData1,
            {
                headers: {
                    ...formData1.getHeaders(),
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json'
                },
                timeout: 30000
            }
        );

        const upscaledImage1 = response1.data.artifacts[0];
        if (!upscaledImage1 || !upscaledImage1.base64) {
            throw new Error('Failed to parse first upscaled image from Stability AI API response.');
        }
        console.log(`[Stability AI Upscale] ✅ Step 1 complete. Image now 2x.`);

        // Step 2: Upscale 2048x2048 to 4096x4096
        console.log(`[Stability AI Upscale] Step 2/2: Upscaling to 4x (4096x4096)...`);
        let formData2 = new FormData();
        formData2.append('image', Buffer.from(upscaledImage1.base64, 'base64'), {
            filename: 'image_2x.png',
            contentType: 'image/png',
        });
        // No 'type' field needed here either

        const response2 = await axios.post(
            upscaleApiUrl,
            formData2,
            {
                headers: {
                    ...formData2.getHeaders(),
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json'
                },
                timeout: 30000
            }
        );

        const upscaledImage2 = response2.data.artifacts[0];
        if (!upscaledImage2 || !upscaledImage2.base64) {
            throw new Error('Failed to parse second upscaled image from Stability AI API response.');
        }
        console.log(`[Stability AI Upscale] ✅ Step 2 complete. Image now 4x.`);
        return upscaledImage2.base64;

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
    // This will now handle the chaining internally within upscaleImageWithStabilityAI
    const upscaledBase64Image = await upscaleImageWithStabilityAI(base64GeneratedImage);
    const upscaledImageBuffer = Buffer.from(upscaledBase64Image, 'base64');

    // 3. Crop and resize the upscaled image to Lulu's exact bleed-inclusive dimensions (2556x3582)
    const targetWidthPx = 2556; // (8.27 + 2*0.125) * 300
    const targetHeightPx = 3582; // (11.69 + 2*0.125) * 300

    console.log(`[Image Processing] Cropping upscaled image to ${targetWidthPx}x${targetHeightPx} for Lulu print...`);
    let finalImageBuffer;
    try {
        finalImageBuffer = await sharp(upscaledImageBuffer)
            .resize(targetWidthPx, targetHeightPx, {
                fit: sharp.fit.cover,
                position: sharp.strategy.attention
            })
            .jpeg({ quality: 90 })
            .toBuffer();
        console.log("[Image Processing] ✅ Image successfully cropped and resized for Lulu print.");
    } catch (sharpError) {
        console.error("Error processing image with sharp:", sharpError);
        throw new Error(`Failed to crop or resize image for print: ${sharpError.message}`);
    }

    return finalImageBuffer.toString('base64');
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