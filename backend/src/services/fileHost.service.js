import fs from 'fs'; 
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

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

/**
 * Uploads a file to Cloudinary using a stream.
 * @param {string} filePath The path to the file on the server.
 * @param {string} publicId The public ID for the file on Cloudinary.
 * @param {string} folder The folder to upload the file to.
 * @returns {Promise<string>} The URL of the uploaded file.
 */
function uploadFileAsStream(filePath, publicId, folder) {
    console.log(`[File Host] Starting stream upload for ${publicId}...`);
    
    const options = {
        public_id: publicId,
        folder: folder,
        resource_type: "raw", 
        chunk_size: 6 * 1024 * 1024,
    };

    return new Promise((resolve, reject) => {
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

        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(uploadStream);
    });
}

/**
 * Uploads a temporary print file to a host.
 * @param {string} filePath The path to the file to upload.
 * @param {string} publicId A unique ID for the file.
 * @returns {Promise<string>} The URL of the uploaded file.
 */
export const uploadPrintFile = async (filePath, publicId) => {
    console.log(`[File Host] Uploading PRINT file: ${filePath}`);
    console.log('[File Host] Using Cloudinary for print file.');
    try {
        const folder = 'print-jobs';
        const url = await uploadFileAsStream(filePath, publicId, folder);
        console.log(`[File Host] Cloudinary print upload successful: ${url}`);
        return url;
    } catch (err) {
        console.error(`[File Host] Cloudinary print upload failed:`, err);
        throw new Error('Failed to upload print file.');
    }
};

/**
 * Uploads a temporary preview file to a host.
 * @param {string} filePath The path to the file to upload.
 * @param {string} publicId A unique ID for the file.
 * @returns {Promise<string>} The URL of the uploaded file.
 */
export const uploadPreviewFile = async (filePath, publicId) => {
    console.log(`[File Host] Uploading PREVIEW file: ${filePath}`);
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

/**
 * Uploads an image from a buffer directly to Cloudinary.
 * @param {Buffer} buffer The image data as a Buffer.
 * @param {string} folder The Cloudinary folder to upload to.
 * @returns {Promise<string>} The URL of the uploaded image.
 */
export const uploadImageBuffer = (buffer, folder) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({
            folder: folder,
            resource_type: "image"
        }, (error, result) => {
            if (error) {
                console.error("[File Host] Image buffer upload failed:", error);
                return reject(error);
            }
            resolve(result.secure_url);
        });
        const bufferStream = new Readable();
        bufferStream.push(buffer);
        bufferStream.push(null);
        bufferStream.pipe(uploadStream);
    });
};