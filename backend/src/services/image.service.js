// backend/src/services/image.service.js
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';
import path from 'path'; // Needed for path.basename to extract filename

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

export const generateImageFromApi = async (prompt, style) => {
    const apiKey = process.env.STABILITY_API_KEY;
    if (!apiKey) {
        throw new Error("Stability AI API key is not configured in .env file.");
    }

    const engineId = 'stable-diffusion-xl-1024-v1-0';
    const apiUrl = `https://api.stability.ai/v1/generation/${engineId}/text-to-image`;

    const fullPrompt = `A beautiful, whimsical, ${style}-style children's book illustration of: ${prompt}. Clean lines, vibrant pastel colors, storybook setting, safe for all audiences, high detail.`;

    try {
        const response = await axios.post(
            apiUrl,
            {
                text_prompts: [{ text: fullPrompt }],
                cfg_scale: 7, height: 1024, width: 1024,
                samples: 1, steps: 30,
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
            }
        );

        const image = response.data.artifacts[0];
        if (image && image.base64) {
            return image.base64;
        } else {
            throw new Error('Failed to parse image from Stability AI API response.');
        }
    } catch (error) {
        const errorMessage = error.response ? error.response.data.message : error.message;
        console.error('Error calling Stability AI API:', errorMessage);
        throw new Error('An error occurred while generating the image.');
    }
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

        // Note: For PDFs intended for Lulu POD, we will use the new uploadPdfFileToCloudinary.
        // This function will primarily handle images or other 'auto' detected types.
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
        // Use the publicIdPrefix + random suffix, then append .pdf
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
            access_mode: 'public' // <--- ADDED THIS LINE!
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