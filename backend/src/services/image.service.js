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

const createPreviewVersion = async (inputBuffer) => {
    console.log('[Image Service] Creating preview version (1024x1024 JPEG)...');
    return sharp(inputBuffer)
        .resize(1024, 1024)
        .jpeg({ quality: 85 })
        .toBuffer();
};

const createPrintVersion = async (inputBuffer) => {
    console.log('[Image Service] Creating print version (3072x3072 PNG)...');
    return sharp(inputBuffer)
        .resize(3072, 3072)
        .png()
        .toBuffer();
};


// --- MODIFICATION START: This function is updated with the new prompt architecture ---
export const generateImageFromApi = async (prompt, style) => {
    const apiKey = process.env.STABILITY_API_KEY;
    if (!apiKey) {
        throw new Error("Stability AI API key is not configured.");
    }
    const apiUrl = `https://api.stability.ai/v2beta/stable-image/generate/core`;

    // 1. The Core Subject & Style (from user input)
    const corePrompt = `${prompt}, in the style of a ${style}`;

    // 2. The Quality Boosters (our expert instructions)
    const qualityBoosters = "masterpiece, best quality, high detail, sharp focus, professional, atmospheric, dramatic lighting";

    // 3. The final Positive Prompt
    const fullPrompt = `${corePrompt}, ${qualityBoosters}`;

    // 4. The final Negative Prompt (for safety and quality)
    const negativePrompt = "blurry, fuzzy, ugly, disfigured, deformed, low quality, noisy, jpeg artifacts, text, words, watermark, signature, artist name, nudity, nsfw, sexual, lewd, hateful, racist, sexist, offensive, gore, violence, disturbing";
    
    console.log(`[Stability AI Generation] Generating image with enhanced prompt...`);
    
    try {
        const formData = new FormData();
        formData.append('prompt', fullPrompt);
        formData.append('negative_prompt', negativePrompt);
        formData.append('output_format', 'png');
        formData.append('aspect_ratio', '1:1');
        // We let Stability AI choose the best dimensions for the model, guided by aspect ratio.
        
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
// --- MODIFICATION END ---

export const processAndUploadImageVersions = async (prompt, style, userId, bookId, pageNumber) => {
    const masterImageBuffer = await generateImageFromApi(prompt, style);

    const [previewBuffer, printBuffer] = await Promise.all([
        createPreviewVersion(masterImageBuffer),
        createPrintVersion(masterImageBuffer)
    ]);

    const previewFolder = `inkwell-ai/user_${userId}/books/${bookId}/previews`;
    const printFolder = `inkwell-ai/user_${userId}/books/${bookId}/print`;

    const [previewUrl, printUrl] = await Promise.all([
        uploadImageToCloudinary(previewBuffer, previewFolder, `page_${pageNumber}_preview`),
        uploadImageToCloudinary(printBuffer, printFolder, `page_${pageNumber}_print`)
    ]);

    console.log(`[Image Service] ✅ Preview and Print versions uploaded for page ${pageNumber}.`);
    return { previewUrl, printUrl };
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