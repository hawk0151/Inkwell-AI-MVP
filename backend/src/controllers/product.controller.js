// backend/src/controllers/product.controller.js
import { getPrintOptions } from '../services/lulu.service.js';

export const getBookOptions = async (req, res) => {
    console.log('DEBUG: getBookOptions controller hit!'); // ADD THIS LINE
    try {
        const options = getPrintOptions();

        // --- CRITICAL FIX START: FORCE 200 OK AND CORRECT CONTENT-TYPE ---
        // Remove headers that Express uses to determine 'freshness' and send a 304
        res.removeHeader('ETag');
        res.removeHeader('Last-Modified');

        // Explicitly set cache control to ensure no caching occurs
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache'); // For HTTP/1.0 compatibility
        res.setHeader('Expires', '0');       // For HTTP/1.0 compatibility

        // Explicitly set Content-Type to application/json
        res.setHeader('Content-Type', 'application/json');
        // --- CRITICAL FIX END ---

        // Send the JSON response with 200 OK status
        res.status(200).json(options);
    } catch (error) {
        console.error('Error fetching print options:', error);
        res.status(500).json({ message: 'Failed to fetch book options.' });
    }
};