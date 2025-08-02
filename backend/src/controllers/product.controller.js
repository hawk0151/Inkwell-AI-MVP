// backend/src/controllers/product.controller.js
import { getPrintOptions } from '../services/lulu.service.js';

export const getBookOptions = async (req, res) => {
  try {
    const options = getPrintOptions(); // No need for await here, as getPrintOptions is synchronous

    // --- CRITICAL FIX START: FORCE NO CACHE & CORRECT CONTENT-TYPE ---
    // These headers instruct the browser and any proxies not to cache the response
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache'); // For HTTP/1.0 compatibility
    res.setHeader('Expires', '0');       // For HTTP/1.0 compatibility

    // Explicitly set Content-Type to application/json.
    // While res.json() should do this, an explicit header can help
    // if there's an unusual middleware or caching interference.
    res.setHeader('Content-Type', 'application/json');
    // --- CRITICAL FIX END ---

    // Send the JSON response with 200 OK status
    res.status(200).json(options); 
  } catch (error) {
    console.error('Error fetching print options:', error);
    res.status(500).json({ message: 'Failed to fetch book options.' });
  }
};