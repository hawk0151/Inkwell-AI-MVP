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
    console.log('[Image Service] Creating a single, optimized image (2048x2048 JPEG)...');
    return sharp(inputBuffer)
        .resize(2048, 2048)
        .jpeg({ quality: 90 })
        .toBuffer();
};

export const generateImageFromApi = async (prompt, style) => {
    const apiKey = process.env.STABILITY_API_KEY;
    if (!apiKey) {
        throw new Error("Stability AI API key is not configured.");
    }

    const apiUrl = `https://api.stability.ai/v2beta/stable-image/generate/core`;
    
    const fullPrompt = `${prompt}, in the style of a ${style} children's book illustration, whimsical, charming, vibrant colors, clean lines, centered composition, simple background`;
    const negativePrompt = "photorealistic, 3d, dark, scary, ugly, blurry, noisy, text, watermark, signature";

    try {
        const formData = new FormData();
        formData.append('prompt', fullPrompt);
        formData.append('negative_prompt', negativePrompt);
        formData.append('output_format', 'png');
        formData.append('aspect_ratio', '1:1');

        const response = await axios.post(apiUrl, formData, {
            headers: { ...formData.getHeaders(), Authorization: `Bearer ${apiKey}`, Accept: 'image/*' },
            responseType: 'arraybuffer',
            timeout: 60000
        });
        
        console.log(`[Stability AI Generation] ✅ Master image generated successfully.`);
        return Buffer.from(response.data);

    } catch (error) {
        const errorMessage = error.response ? Buffer.from(error.response.data).toString() : error.message;
        console.error('Error calling Stability AI API (text-to-image):', errorMessage);
        throw new Error(`An error occurred while generating the image.`);
    }
};

export const generateImageFromReference = async (options) => {
    const {
        referenceImageUrl,
        prompt,
        style,
        bookId,
        pageNumber,
        characterFeatures = 'As shown in the reference image.',
        mood = 'As described in the scene.',
        composition = 'dynamic and interesting',
        seed = 0
    } = options;

    const apiKey = process.env.STABILITY_API_KEY;
    if (!apiKey) throw new Error("Stability AI API key is not configured.");
    
    const apiUrl = `https://api.stability.ai/v2beta/stable-image/generate/core`;
    
    try {
        console.log(`[Style Reference] Downloading reference image from ${referenceImageUrl}`);
        const imageResponse = await axios.get(referenceImageUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(imageResponse.data);

        const formData = new FormData();
        
        // ✅ NEW: Updated with the much stricter master prompt.
        const fullPrompt = `
A beautiful and charming children's book illustration. The art style MUST be exactly ${style}. The main character MUST be rendered to be EXACTLY THE SAME as the character in the reference image.
The character is ${prompt}. The mood is ${mood}. The camera shot is a ${composition} view.
`.trim();

        const negativePrompt = 'photorealistic, 3d, text, words, watermark, signature, ugly, deformed, blurry, noisy, multiple characters, grainy, pixelated';

        formData.append('prompt', fullPrompt);
        formData.append('negative_prompt', negativePrompt);
        formData.append('style_image', imageBuffer);
        formData.append('style_strength', 60);
        formData.append('seed', seed);
        formData.append('output_format', 'png');
        formData.append('aspect_ratio', '1:1');

        console.log(`[Style Reference] Generating image for page ${pageNumber} with new master prompt...`);
        const generationResponse = await axios.post(apiUrl, formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'image/*'
            },
            responseType: 'arraybuffer',
            timeout: 90000
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