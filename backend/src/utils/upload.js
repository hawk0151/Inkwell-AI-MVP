import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs'; // Node.js File System module

// Get __dirname equivalent for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define the absolute path to the 'uploads' directory
// It's one level up from 'utils' (i.e., in the backend root)
const uploadsDir = path.join(__dirname, '..', 'uploads');

// Ensure the uploads directory exists. If not, create it.
if (!fs.existsSync(uploadsDir)) {
    console.log(`Creating uploads directory: ${uploadsDir}`);
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Set up storage for uploaded files using diskStorage
const storage = multer.diskStorage({
    // Where to store the files
    destination: (req, file, cb) => {
        cb(null, uploadsDir); // Files will be stored in the 'backend/uploads' directory
    },
    // How to name the files
    filename: (req, file, cb) => {
        // Generate a unique filename: fieldname-timestamp.ext
        // path.extname(file.originalname) gets the original file extension (e.g., .jpg, .png)
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    },
});

// Filter to accept only image files
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        // Accept the file
        cb(null, true);
    } else {
        // Reject the file
        cb(new Error('Only image files are allowed!'), false);
    }
};

// Create the multer instance with our storage and file filter
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB (adjust as needed)
    fileFilter: fileFilter,
});

export default upload;