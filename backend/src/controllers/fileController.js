// This controller will handle file-related operations

export const uploadImage = (req, res) => {
    // Multer places the uploaded file's information in req.file
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    // Construct the URL to access the uploaded image.
    // This assumes your backend server (e.g., localhost:5001) will serve static files
    // from the 'uploads' directory under the '/uploads' URL path.
    const imageUrl = `http://localhost:5001/uploads/${req.file.filename}`;

    res.status(200).json({
        message: 'Image uploaded successfully!',
        filename: req.file.filename,
        url: imageUrl, // Send the URL back to the frontend
    });
};

// You can add more file-related functions here in the future if needed
// e.g., deleteImage, getImageUrlById, etc.