// backend/src/services/lulu.service.js

// Now includes bleedMm and safeMarginMm

// --- LULU_PRODUCT_CONFIGURATIONS - Updated with correct A4 Landscape Picture Book SKU ---
export const LULU_PRODUCT_CONFIGURATIONS = [
    {
        id: 'NOVBOOK_BW_5.25x8.25',
        name: 'Standard Novella B&W (5.25x8.25)',
        trimSize: '5.25x8.25', // Lulu standard trim size string
        luluSku: 'LSI-12345', // Placeholder SKU for novella, replace with actual if needed
        minPageCount: 24,
        maxPageCount: 800,
        bleedMm: 3.2,
        safeMarginMm: 6.4,
        type: 'textbook',
        // Assuming this is NOT the default picture book product.
        // If you only have one main novella product, you might mark it as isDefault: true for 'textbook' type
        isDefault: false 
    },
    {
        // THIS IS YOUR UPDATED PICTURE BOOK CONFIGURATION
        id: 'PICBOOK_A4_LANDSCAPE_HARDCOVER', // A more descriptive ID
        name: 'A4 Landscape Hardcover Picture Book', // Updated name to match your screenshot
        trimSize: '11.94x8.52', // Using the Inch notation as it's common for Lulu's displayed names
        luluSku: '1169X0827FCPRECW080CW444MXX', // <-- THIS IS THE NEW, CORRECT SKU
        minPageCount: 24,
        maxPageCount: 800, // Matches the screenshot (Lulu usually has a high max for digital printing)
        // These bleed/safe margin values are from your original A4PREMIUM_FC config,
        // you might want to double check Lulu's specific guide for *this* new SKU
        // for precise values, but these are often consistent for similar products.
        bleedMm: 3.175,
        safeMarginMm: 6.35,
        type: 'pictureBook',
        isDefault: true // Set this as the default picture book product
    },
    // ... add any other product configurations you might have for other book types
];


// Lulu API print options caching mechanism
let printOptionsCache = null;
let printOptionsCacheTimestamp = 0;
const CACHE_DURATION = 1000 * 60 * 60 * 24; // Cache for 24 hours

export async function getPrintOptions() {
    if (printOptionsCache && (Date.now() - printOptionsCacheTimestamp < CACHE_DURATION)) {
        console.log("[Lulu Service] Using cached print options.");
        return printOptionsCache;
    }

    console.log("[Lulu Service] Fetching print options from Lulu API...");
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        const response = await axios.get(`${process.env.LULU_API_BASE_URL}/print-options`, {
            headers: {
                'Authorization': `Bearer ${process.env.LULU_API_CLIENT_CREDENTIALS}`,
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        printOptionsCache = response.data.map(p => ({
            id: p.id,
            name: p.name,
            podCategory: p.pod_category, // 'BOOK' or 'MAGAZINE'
            trimSize: p.trim_size, // e.g. "6x9in (152x229mm)"
            minPageCount: p.min_pages,
            maxPageCount: p.max_pages,
            // Example of extracting specific attributes if available and needed later for UI/logic
            binding: p.binding_type?.name || 'Unknown Binding',
            cover: p.cover_type?.name || 'Unknown Cover',
            paper: p.paper_type?.name || 'Unknown Paper',
            category: p.categories?.length > 0 ? p.categories[0].name : 'Unknown',
            // Example of mapping to your internal types (adjust as needed)
            type: p.pod_category === 'BOOK' && p.binding_type?.name.toLowerCase().includes('perfect') ? 'textbook' :
                  p.pod_category === 'BOOK' && p.binding_type?.name.toLowerCase().includes('hardcover') ? 'pictureBook' : 'other',
            // Default bleed and safe margins (these might need to be fine-tuned per product from Lulu's guides)
            bleedMm: 3.175, // Standard for many Lulu products
            safeMarginMm: 6.35 // Standard for many Lulu products
        }));
        printOptionsCacheTimestamp = Date.now();
        console.log("[Lulu Service] Successfully fetched and cached print options.");
        return printOptionsCache;
    } catch (error) {
        console.error("Error fetching print options from Lulu API:", error.message);
        throw new Error(`Failed to fetch print options: ${error.message}`);
    }
}

// Function to get accurate cover dimensions from Lulu API
export async function getCoverDimensionsFromApi(podPackageId, pageCount) {
    console.log(`[Lulu Service] Attempting to get cover dimensions for SKU: ${podPackageId}, Page Count: ${pageCount}`);
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        const response = await axios.post(`${process.env.LULU_API_BASE_URL}/print-job-covers`, {
            pod_package_id: podPackageId,
            page_count: pageCount
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.LULU_API_CLIENT_CREDENTIALS}`,
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const coverData = response.data;
        if (!coverData || !coverData.cover_pages || coverData.cover_pages.length === 0) {
            console.error("[Lulu Service] Lulu API response for cover dimensions missing expected 'cover_pages' data:", coverData);
            throw new Error(`Failed to get cover dimensions for SKU ${podPackageId} with ${pageCount} pages: Unexpected response structure.`);
        }

        const coverWidthMm = coverData.cover_pages[0].width_mm;
        const coverHeightMm = coverData.cover_pages[0].height_mm;

        if (!coverWidthMm || !coverHeightMm) {
            console.error("[Lulu Service] Lulu API response for cover dimensions missing width/height:", coverData);
            throw new Error(`Failed to get cover dimensions for SKU ${podPackageId} with ${pageCount} pages: Missing dimensions in response.`);
        }
        
        console.log(`[Lulu Service] ✅ Successfully retrieved cover dimensions: W=${coverWidthMm}mm, H=${coverHeightMm}mm`);
        return { width: coverWidthMm, height: coverHeightMm };

    } catch (error) {
        const errorMessage = error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : error.message;
        console.error(`[Lulu Service] Error getting cover dimensions from Lulu API for SKU ${podPackageId}: ${errorMessage}`);
        throw new Error(`Failed to get cover dimensions for SKU ${podPackageId} with ${pageCount} pages. Error: ${errorMessage}`);
    }
}

// Function to get print job costs from Lulu API
export async function getPrintJobCosts(lineItems, shippingAddress) {
    console.log(`[Lulu Service] Attempting to get print job costs from Lulu.`);
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

        const requestBody = {
            line_items: lineItems,
            shipping_address: shippingAddress
        };
        console.log('[Lulu Service] Requesting print job costs with body:', JSON.stringify(requestBody, null, 2));

        const response = await axios.post(`${process.env.LULU_API_BASE_URL}/print-job-costs`, requestBody, {
            headers: {
                'Authorization': `Bearer ${process.env.LULU_API_CLIENT_CREDENTIALS}`,
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        console.log('[Lulu Service] Successfully retrieved print job costs.');
        return response.data;

    } catch (error) {
        let errorMessage = error.message;
        if (error.response && error.response.data && error.response.data.errors) {
            errorMessage = JSON.stringify(error.response.data.errors);
            console.error(`[Lulu Service] Detailed Lulu API error response for print job costs:`, error.response.data.errors);
        } else {
            console.error(`[Lulu Service] Error getting print job costs from Lulu API:`, error);
        }
        throw new Error(`Failed to get print job costs from Lulu API: ${errorMessage}`);
    }
}

// Ensure AbortController is defined for environments where it might be missing (e.g., older Node.js versions)
let AbortController;
if (typeof globalThis.AbortController === 'function') {
    AbortController = globalThis.AbortController;
} else {
    try {
        // Fallback for Node.js < 15
        const NodeAbortController = require('node-abort-controller');
        AbortController = NodeAbortController.AbortController;
    } catch (e) {
        console.error("Critical: AbortController not available. Please ensure Node.js v15+ is used or 'node-abort-controller' is installed. Error:", e.message);
        // If it's a server environment and AbortController is truly critical and missing,
        // you might want to throw an error here to prevent server startup issues.
        throw new Error("AbortController is not available. Please install 'node-abort-controller' or use Node.js v15+.");
    }
}