// in src/services/image.service.js
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';
import FormData from 'form-data';
import sharp from 'sharp';

// ... (cloudinary.config, createWebAndPrintVersion, delay, and generateImageFromApi functions remain the same) ...
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

const createWebAndPrintVersion = async (inputBuffer) => {
    console.log('[Image Service] Converting master image to optimized JPEG (80% quality)...');
    return sharp(inputBuffer)
        .jpeg({ quality: 80 })
        .toBuffer();
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const generateImageFromApi = async (prompt, style_preset, negativePrompt, seed) => {
    const apiKey = process.env.STABILITY_API_KEY; 
    if (!apiKey) {
        throw new Error("Stability AI API key is not configured.");
    }

    const apiUrl = `https://api.stability.ai/v2beta/stable-image/generate/core`;
    const finalNegativePrompt = negativePrompt || "photorealistic, 3d, dark, scary, ugly, blurry, noisy, text, watermark, signature";
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const formData = new FormData();
            
            formData.append('prompt', prompt);
            formData.append('negative_prompt', finalNegativePrompt);
            formData.append('output_format', 'png');
            formData.append('width', 1024);
            formData.append('height', 1024);
            
            if (seed !== undefined) {
                formData.append('seed', seed);
            }

            if (style_preset) {
                formData.append('style_preset', style_preset);
                console.log(`[Stability AI] Using style_preset: ${style_preset}`);
            } else {
                console.log(`[Stability AI] No style_preset used. Style is defined in prompt.`);
            }

            console.log(`[Stability AI] Sending request (Attempt ${attempt}/${MAX_RETRIES})...`);

            const response = await axios.post(apiUrl, formData, {
                headers: { ...formData.getHeaders(), Authorization: `Bearer ${apiKey}`, Accept: 'image/*' },
                responseType: 'arraybuffer',
                timeout: 300000 
            });
            
            console.log('[Stability AI] ✅ Request successful, received image data.');
            return Buffer.from(response.data);

        } catch (error) {
            console.error(`❌ [Stability AI] Attempt ${attempt} failed.`);
            const errorMessage = error.response ? Buffer.from(error.response.data).toString() : error.message;
            console.error('Error details from Stability AI API:', errorMessage);

            if (attempt === MAX_RETRIES) {
                console.error(`[Stability AI] All ${MAX_RETRIES} attempts failed. Giving up.`);
                throw new Error(`An error occurred while generating the image.`);
            }

            console.log(`[Stability AI] Waiting 5 seconds before retrying...`);
            await delay(5000);
        }
    }
};


// =========================================================================
// =================== REPLACED FUNCTION STARTS HERE =======================
// =========================================================================

export const generateImageFromReference = async (options) => {
    const {
        referenceImageUrl,
        prompt,
        pageNumber,
        seed = 0,
        isSceneryOnly = false
    } = options;

    const apiKey = process.env.STABILITY_API_KEY;
    if (!apiKey) throw new Error("Stability AI API key is not configured.");

    // --- CHANGE 1: Use the correct Stable Diffusion 3 endpoint ---
    const apiUrl = 'https://api.stability.ai/v2beta/stable-image/generate/sd3';
    console.log(`[Image Service] Using endpoint: ${apiUrl} for page ${pageNumber}`);
    
    try {
        const formData = new FormData();
        
        // --- CHANGE 2: Add the final prompt and negative prompt ---
        // The prompt now describes the scene the character should be in.
        formData.append('prompt', prompt);
        // We ensure consistency by forbidding other characters.
        formData.append('negative_prompt', 'multiple characters, multiple people, text, watermark, signature, blurry');

        // --- CHANGE 3: Differentiate between character scenes and scenery-only shots ---
        if (isSceneryOnly) {
            console.log(`[Image Service] Generating scenery-only image for page ${pageNumber}.`);
            formData.append('mode', 'text-to-image');
        } else {
            console.log(`[Image Service] Generating image-to-image with character reference for page ${pageNumber}.`);
            if (!referenceImageUrl) throw new Error("A character reference image URL is required for character scenes.");
            
            // Download the reference image
            const imageResponse = await axios.get(referenceImageUrl, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(imageResponse.data);

            formData.append('mode', 'image-to-image');
            formData.append('image', imageBuffer, 'reference.png');
            
            // Strength dictates how much the AI adheres to the reference image.
            // 0.5 is a good balance of consistency and adaptability.
            formData.append('strength', 0.5); 
        }

        formData.append('seed', seed);
        formData.append('output_format', 'png');

        console.log(`[Image Service] Generating image for page ${pageNumber}...`);
        
        const generationResponse = await axios.post(apiUrl, formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'image/*'
            },
            responseType: 'arraybuffer',
            timeout: 300000
        });

        // The upload logic can remain the same, but we simplify it for clarity here.
        const imageBuffer = Buffer.from(generationResponse.data);
        console.log(`[Image Service] ✅ Image generated successfully for page ${pageNumber}.`);
        return imageBuffer; // Return the buffer to be handled by the controller

    } catch (error) {
        const errorMessage = error.response?.data ? Buffer.from(error.response.data).toString() : error.message;
        console.error(`[Image Service] Error generating image for page ${pageNumber}:`, errorMessage);
        throw new Error(`An error occurred while generating the image for page ${pageNumber}. Details: ${errorMessage}`);
    }
};

// =========================================================================
// =================== REPLACED FUNCTION ENDS HERE =========================
// =========================================================================


export const processAndUploadImageVersions = async (prompt, style, userId, bookId, pageNumber) => {
    // This function may need to be updated or removed depending on the new flow
    const masterImageBuffer = await generateImageFromApi(prompt, style); // This uses the old text-to-image
    const optimizedImageBuffer = await createWebAndPrintVersion(masterImageBuffer);
    const optimizedImageName = `page_${pageNumber}`;
    const printFolder = `inkwell-ai/user_${userId}/books/${bookId}/print`;
    const imageUrl = await uploadImageToCloudinary(optimizedImageBuffer, printFolder, optimizedImageName);

    console.log(`[Image Service] ✅ Optimized image uploaded for page ${pageNumber}.`);
    return { previewUrl: imageUrl, printUrl: imageUrl };
};

export const uploadImageToCloudinary = (fileBuffer, folder, publicIdPrefix) => {
    console.log(`[Cloudinary] Attempting to upload image to folder: ${folder}, public_id_prefix: ${publicIdPrefix}`);
    
    return new Promise((resolve, reject) => {
        const uniqueSuffix = randomUUID().substring(0, 8);
        const finalPublicId = `${publicIdPrefix}_${uniqueSuffix}`;

        const uploadOptions = {
            folder: folder,
            resource_type: 'image',
            public_id: finalPublicId,
        };

        cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
            if (error) {
                console.error("Cloudinary Upload Error:", error);
                return reject(error);
            }
            console.log(`[Cloudinary] ✅ Upload successful. URL: ${result.secure_url}`);
            resolve(result.secure_url);
        }).end(fileBuffer);
    });
};
