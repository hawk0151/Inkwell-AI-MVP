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
            
            // --- FIX: Use the new required format for prompts ---
            formData.append('prompt', prompt);
            formData.append('negative_prompt', finalNegativePrompt);
            // --- END FIX ---

            formData.append('output_format', 'png');
            formData.append('width', 1024);
            formData.append('height', 1024);
            
            if (seed !== undefined) {
                formData.append('seed', seed);
            }

            if (style_preset) {
                formData.append('style_preset', style_preset);
                console.log(`[Stability AI] Using style_preset: ${style_preset}`);
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

// in src/services/image.service.js

export const generateImageFromReference = async (options) => {
    let {
        referenceImageUrl,
        prompt,
        style,
        bookId,
        pageNumber,
        seed = 0
    } = options;

    const apiKey = process.env.STABILITY_API_KEY;
    if (!apiKey) throw new Error("Stability AI API key is not configured.");
    
    // --- FIX: Reverted to the /core endpoint which supports custom dimensions ---
    const apiUrl = `https://api.stability.ai/v2beta/stable-image/generate/core`;
    
    if (style === 'watercolor') {
        style = 'digital-art';
    }

    try {
        const formData = new FormData();
        let finalPrompt = prompt;

        if (prompt.toLowerCase().includes('[no character]')) {
            console.log('[Style Reference] Scenery-only mode detected. Ignoring character reference image.');
            finalPrompt = prompt.replace(/\[no character\]/gi, '').trim();
            formData.append('prompt', finalPrompt);
        } else {
            console.log(`[Style Reference] Downloading reference image from ${referenceImageUrl}`);
            const imageResponse = await axios.get(referenceImageUrl, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(imageResponse.data);
            formData.append('style_image', imageBuffer);

            finalPrompt = `
                A beautiful and charming children's book illustration. The main character MUST be rendered to be EXACTLY THE SAME as the character in the reference image.
                The character is ${prompt}. The mood is 'as described in the scene'. The camera shot is a 'dynamic and interesting' view.
            `.trim();
            formData.append('prompt', finalPrompt);
        }

        const negativePrompt = 'photorealistic, 3d, text, words, watermark, signature, ugly, deformed, blurry, noisy, multiple characters, grainy, pixelated';

        formData.append('negative_prompt', negativePrompt);
        formData.append('seed', seed);
        formData.append('output_format', 'png');
        
        // --- KEPT YOUR REQUIRED DIMENSIONS FOR LULU ---
        formData.append('width', 2625);
        formData.append('height', 2625);

        if (style) {
            formData.append('style_preset', style);
            console.log(`[Stability AI] Using style_preset: ${style} from book's story bible.`);
        }

        console.log(`[Style Reference] Generating image for page ${pageNumber}...`);
        const generationResponse = await axios.post(apiUrl, formData, {
            headers: { ...formData.getHeaders(), 'Authorization': `Bearer ${apiKey}`, 'Accept': 'image/*' },
            responseType: 'arraybuffer',
            timeout: 300000
        });

        const masterImageBuffer = Buffer.from(generationResponse.data);
        const optimizedImageBuffer = await createWebAndPrintVersion(masterImageBuffer);
        const printFolder = `inkwell-ai/user_books/${bookId}/print`;
        const imageName = `page_${pageNumber}`;
        const imageUrl = await uploadImageToCloudinary(optimizedImageBuffer, printFolder, imageName);
        
        console.log(`[Style Reference] ✅ Image uploaded successfully for page ${pageNumber}.`);
        return { previewUrl: imageUrl, printUrl: imageUrl };

    } catch (error) {
        const errorMessage = error.response && error.response.data ? Buffer.from(error.response.data).toString() : error.message;
        console.error(`[Style Reference] Error generating image for page ${pageNumber}:`, errorMessage);
        throw new Error(`An error occurred while generating the image for page ${pageNumber}.`);
    }
};

export const processAndUploadImageVersions = async (prompt, style, userId, bookId, pageNumber) => {
    const masterImageBuffer = await generateImageFromApi(prompt, style);
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

export const uploadPdfFileToCloudinary = (filePath, folder, publicIdPrefix) => {
    // This function is unchanged
};