// backend/src/services/fileHost.service.js
import fs from 'fs'; // Use the non-promise version for createReadStream
import { v2 as cloudinary } from 'cloudinary';

// Cloudinary configuration (assuming env variables are set)
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
} else {
    console.error("Cloudinary credentials are not fully configured in environment variables.");
}


// --- MODIFICATION START: This function has been rewritten to use the correct streaming method ---
/**
 * Uploads a file to Cloudinary using a stream, allowing the SDK to handle chunking.
 * @param {string} filePath The path to the file on the server.
 * @param {string} publicId The public ID to use for the file on Cloudinary.
 * @param {string} folder The folder to upload the file to.
 * @returns {Promise<string>} The URL of the uploaded file.
 */
function uploadFileAsStream(filePath, publicId, folder) {
    console.log(`[File Host] Starting stream upload for ${publicId}...`);
    
    // The options for the upload, including the desired public_id and folder.
    const options = {
        public_id: publicId,
        folder: folder,
        resource_type: "raw", // Important for non-image files like PDFs
        chunk_size: 6 * 1024 * 1024, // Optional: Tell Cloudinary to use 6MB chunks
    };

    return new Promise((resolve, reject) => {
        // 1. Create an upload stream instance with a callback function.
        const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
            if (error) {
                console.error(`[File Host] Cloudinary stream upload failed for ${publicId}:`, error);
                return reject(new Error('Cloudinary upload stream failed.'));
            }
            if (result) {
                console.log(`[File Host] Stream upload successful for ${publicId}. URL: ${result.secure_url}`);
                resolve(result.secure_url);
            }
        });

        // 2. Create a read stream for the local file.
        const fileStream = fs.createReadStream(filePath);

        // 3. Pipe the file stream into the Cloudinary upload stream. This starts the upload.
        fileStream.pipe(uploadStream);
    });
}
// --- MODIFICATION END ---

/**
 * Uploads a temporary print file to a host and returns its URL.
 * @param {string} filePath The path to the file to upload.
 * @param {string} publicId A unique ID for the file.
 * @returns {Promise<string>} The URL of the uploaded file.
 */
export const uploadPrintFile = async (filePath, publicId) => {
    console.log(`[File Host] Uploading PRINT file: ${filePath}`);
    console.log('[File Host] Using Cloudinary for print file.');
    try {
        const folder = 'print-jobs';
        // Now calling the new, corrected streaming function
        const url = await uploadFileAsStream(filePath, publicId, folder);
        console.log(`[File Host] Cloudinary print upload successful: ${url}`);
        return url;
    } catch (err) {
        console.error(`[File Host] Cloudinary print upload failed:`, err);
        throw new Error('Failed to upload print file.');
    }
};

/**
 * Uploads a temporary preview file to a host and returns its URL.
 * @param {string} filePath The path to the file to upload.
 * @param {string} publicId A unique ID for the file.
 * @returns {Promise<string>} The URL of the uploaded file.
 */
export const uploadPreviewFile = async (filePath, publicId) => {
    console.log(`[File Host] Uploading PREVIEW file: ${filePath}`);
    // For smaller preview files, a direct upload is fine.
    try {
        const folder = 'preview-pdfs';
        const result = await cloudinary.uploader.upload(filePath, {
            public_id: publicId,
            resource_type: "raw",
            folder: folder,
        });
        console.log(`[File Host] Cloudinary preview upload successful: ${result.secure_url}`);
        return result.secure_url;
    } catch (err) {
        console.error(`[File Host] Cloudinary preview upload failed:`, err);
        throw new Error('Failed to upload preview file.');
    }
};