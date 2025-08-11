import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';
import FormData from 'form-data';
import sharp from 'sharp';
import { Readable } from 'stream';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

const createWebAndPrintVersion = async (inputBuffer) => {
    console.log('[Image Service] Creating a single, optimized image (2048x2048 JPEG)...');
    return sharp(inputBuffer)
        .resize(2048, 2048) // A good size for both web and print
        .jpeg({ quality: 90 })
        .toBuffer();
};

export const generateImageFromApi = async (prompt, style) => {
    const apiKey = process.env.STABILITY_API_KEY;
    if (!apiKey) {
        throw new Error("Stability AI API key is not configured.");
    }
    const apiUrl = `https://api.stability.ai/v2beta/stable-image/generate/core`;

    const corePrompt = prompt;
    const compositionInstructions = "centered subject, simple background, centered composition";
    const storybookBoosters = `in the style of a ${style} children's book illustration, whimsical and playful, charming, vibrant colors, clean lines, soft lighting, high detail`;
    const fullPrompt = `${corePrompt}, ${compositionInstructions}, ${storybookBoosters}`;
    const negativePrompt = "photorealistic, hyperrealistic, realistic, 3d, dark, scary, creepy, ugly, disfigured, deformed, blurry, noisy, jpeg artifacts, text, words, watermark, signature, artist name, nudity, nsfw, sexual, lewd, hateful";
    
    console.log(`[Stability AI Generation] Generating image with storybook-enhanced prompt...`);
    
    try {
        const formData = new FormData();
        formData.append('prompt', fullPrompt);
        formData.append('negative_prompt', negativePrompt);
        formData.append('output_format', 'png');
        formData.append('aspect_ratio', '1:1');
        
        const response = await axios.post(
            apiUrl,
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'image/*'
                },
                responseType: 'arraybuffer',
                timeout: 60000
            }
        );
        console.log(`[Stability AI Generation] ✅ Master image generated successfully.`);
        return Buffer.from(response.data);
    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error('Error calling Stability AI API:', errorMessage);
        throw new Error(`An error occurred while generating the image.`);
    }
};

export const processAndUploadImageVersions = async (prompt, style, userId, bookId, pageNumber) => {
    const masterImageBuffer = await generateImageFromApi(prompt, style);

    // FIX: Generate a single, optimized version instead of two separate ones.
    const optimizedImageBuffer = await createWebAndPrintVersion(masterImageBuffer);
    const optimizedImageName = `page_${pageNumber}`;

    const printFolder = `inkwell-ai/user_${userId}/books/${bookId}/print`;

    const imageUrl = await uploadImageToCloudinary(optimizedImageBuffer, printFolder, optimizedImageName);

    console.log(`[Image Service] ✅ Optimized image uploaded for page ${pageNumber}.`);
    return { previewUrl: imageUrl, printUrl: imageUrl };
};

export const uploadImageToCloudinary = (fileBuffer, folder, publicIdPrefix) => {
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
            resolve(result.secure_url);
        }).end(fileBuffer);
    });
};

export const uploadPdfFileToCloudinary = (filePath, folder, publicIdPrefix) => {
    // ... (This function is unchanged)
};