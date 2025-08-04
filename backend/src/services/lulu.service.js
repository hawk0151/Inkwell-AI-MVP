// backend/src/services/lulu.service.js

import axios from 'axios';
import { Buffer } from 'buffer';
import dns from 'dns/promises';

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
        throw new Error("AbortController is not available. Please install 'node-abort-controller' or use Node.js v15+.");
    }
}

export const LULU_PRODUCT_CONFIGURATIONS = [
    {
        id: 'NOVBOOK_BW_5.25x8.25',
        luluSku: '0500X0800BWSTDPB060UC444MXX',
        name: 'Novella (5.25 x 8.25" Paperback)',
        type: 'textBook',
        trimSize: '5.25x8.25',
        basePrice: 39.99,
        defaultPageCount: 40,
        minPageCount: 32,
        maxPageCount: 800,
        wordsPerPage: 250,
        defaultWordsPerPage: 250,
        totalChapters: 6,
        category: 'novel',
        bleedMm: 3.175,
        safeMarginMm: 6.35,
        isDefault: false // Not default for picture books
    },
    {
        id: 'A4NOVEL_PB_8.52x11.94',
        luluSku: '0827X1169BWSTDPB060UC444MXX',
        name: 'A4 Novel (8.52 x 11.94" Paperback)',
        type: 'textBook',
        trimSize: '8.52x11.94',
        basePrice: 49.99,
        defaultPageCount: 80,
        minPageCount: 32,
        maxPageCount: 800,
        wordsPerPage: 450,
        defaultWordsPerPage: 400,
        totalChapters: 8,
        category: 'novel',
        bleedMm: 3.175,
        safeMarginMm: 6.35,
        isDefault: false // Not default for picture books
    },
    {
        id: 'ROYAL_HARDCOVER_6.39x9.46',
        luluSku: '0614X0921BWSTDCW060UC444MXX',
        name: '80-page Novel (6.39 x 9.46" Hardcover)',
        type: 'textBook',
        trimSize: '6.39x9.46',
        basePrice: 59.99,
        defaultPageCount: 100,
        minPageCount: 24,
        maxPageCount: 800,
        wordsPerPage: 300,
        defaultWordsPerPage: 300,
        totalChapters: 10,
        category: 'novel',
        bleedMm: 3.175,
        safeMarginMm: 6.35,
        isDefault: false // Not default for picture books
    },
    {
        // THIS IS YOUR UPDATED PICTURE BOOK CONFIGURATION with the correct SKU and isDefault: true
        id: 'A4PREMIUM_FC_8.27x11.69', // This ID is still used in your DB
        name: 'A4 Landscape Hardcover Picture Book (11.94 x 8.52")', // Updated name to match screenshot/common usage
        trimSize: '11.94x8.52', // Updated to match the landscape dimensions
        luluSku: '1169X0827FCPRECW080CW444MXX', // <-- THIS IS THE NEW, CORRECT SKU
        basePrice: 69.99, // Assuming original base price
        defaultPageCount: 40, // Retaining values from your previous lulu.service.js for this product
        minPageCount: 24,
        maxPageCount: 800, // Matches the screenshot
        wordsPerPage: 120,
        defaultWordsPerPage: 120,
        totalChapters: 1, // Picture books typically have one "story"
        category: 'pictureBook',
        bleedMm: 3.175,
        safeMarginMm: 6.35,
        type: 'pictureBook',
        isDefault: true // Set this as the default picture book product
    }
];

export const getPrintOptions = () => {
    const options = LULU_PRODUCT_CONFIGURATIONS.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type,
        price: p.basePrice,
        defaultPageCount: p.defaultPageCount,
        defaultWordsPerPage: p.defaultWordsPerPage,
        totalChapters: p.totalChapters,
        category: p.category
    }));
    return options;
};

let accessToken = null;
let tokenExpiry = 0;

async function retryWithBackoff(fn, attempts = 3, baseDelayMs = 300) {
    let attempt = 0;
    while (attempt < attempts) {
        try {
            return await fn();
        } catch (err) {
            attempt++;
            if (attempt >= attempts) {
                throw err;
            }
            const delay = baseDelayMs * Math.pow(2, attempt - 1);
            console.warn(`Retrying after error (attempt ${attempt}/${attempts}) in ${delay}ms:`, err.message || err);
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

async function ensureHostnameResolvable(url) {
    try {
        const { hostname } = new URL(url);
        await dns.lookup(hostname);
        return;
    } catch (err) {
        throw new Error(`DNS resolution failed for Lulu host in URL "${url}": ${err.message}`);
    }
}

async function getLuluAuthToken() {
    if (accessToken && Date.now() < tokenExpiry) {
        return accessToken;
    }
    const clientKey = process.env.LULU_CLIENT_ID;
    const clientSecret = process.env.LULU_CLIENT_SECRET;
    if (!clientKey || !clientSecret) {
        throw new Error('Lulu API credentials (LULU_CLIENT_ID) are not configured.');
    }
    const baseUrl = process.env.LULU_API_BASE_URL;
    if (!baseUrl) {
        throw new Error('LULU_API_BASE_URL is not set in environment.');
    }
    const authUrl = `${baseUrl.replace(/\/$/, '')}/auth/realms/glasstree/protocol/openid-connect/token`;
    const basicAuth = Buffer.from(`${clientKey}:${clientSecret}`).toString('base64');
    await ensureHostnameResolvable(authUrl);
    try {
        const response = await retryWithBackoff(async () => {
            return await axios.post(
                authUrl,
                'grant_type=client_credentials',
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': `Basic ${basicAuth}`
                    },
                    timeout: 10000
                }
            );
        }, 3, 500);
        accessToken = response.data.access_token;
        tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 5000;
        return accessToken;
    } catch (error) {
        console.error('Authentication error fetching Lulu token:', error.response ? error.response.data : error.message);
        throw new Error('Failed to authenticate with Lulu API.');
    }
}

const coverDimensionsCache = new Map();

export async function getCoverDimensionsFromApi(podPackageId, pageCount) {
    console.log(`[Lulu Service] Attempting to get cover dimensions for SKU: ${podPackageId}, Page Count: ${pageCount}`);
    const cacheKey = `${podPackageId}-${pageCount}-mm`;
    if (coverDimensionsCache.has(cacheKey)) {
        return coverDimensionsCache.get(cacheKey);
    }
    const endpoint = `${process.env.LULU_API_BASE_URL.replace(/\/$/, '')}/cover-dimensions`; // Corrected endpoint for cover dimensions
    try {
        await ensureHostnameResolvable(endpoint);
        const token = await getLuluAuthToken();
        const response = await retryWithBackoff(async () => {
            return await axios.post(
                endpoint,
                { pod_package_id: podPackageId, interior_page_count: pageCount },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    timeout: 10000
                }
            );
        }, 3, 300);
        const dimensions = response.data;
        const ptToMm = (pt) => pt * (25.4 / 72);
        
        // Lulu's cover dimensions API usually returns in points, so convert to mm
        if (typeof dimensions.width_pts === 'undefined' || typeof dimensions.height_pts === 'undefined') {
             // Fallback for older API versions or unexpected response
             console.warn("[Lulu Service] API response for cover dimensions did not contain 'width_pts' or 'height_pts'. Checking for 'width'/'height' in mm.");
             if (typeof dimensions.width === 'undefined' || typeof dimensions.height === 'undefined' || dimensions.unit !== 'mm') {
                throw new Error('Unexpected Lulu API response for cover dimensions (missing expected fields).');
             }
             // If already in mm, just use them
             const widthMm = parseFloat(dimensions.width);
             const heightMm = parseFloat(dimensions.height);
             const result = {
                width: widthMm,
                height: heightMm,
                layout: widthMm > heightMm ? 'landscape' : 'portrait'
             };
             coverDimensionsCache.set(cacheKey, result);
             return result;
        }

        const widthMm = ptToMm(parseFloat(dimensions.width_pts));
        const heightMm = ptToMm(parseFloat(dimensions.height_pts));
        
        const result = {
            width: widthMm,
            height: heightMm,
            layout: widthMm > heightMm ? 'landscape' : 'portrait'
        };
        coverDimensionsCache.set(cacheKey, result);
        console.log(`[Lulu Service] ✅ Successfully retrieved cover dimensions: W=${widthMm.toFixed(2)}mm, H=${heightMm.toFixed(2)}mm (from points)`);
        return result;

    } catch (error) {
        let errorMessage = error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : error.message;
        console.error(`[Lulu Service] Error getting cover dimensions from Lulu API for SKU ${podPackageId}: ${errorMessage}`);
        throw new Error(`Failed to get cover dimensions for SKU ${podPackageId} with ${pageCount} pages. Error: ${errorMessage}`);
    }
}

export const getPrintJobCosts = async (lineItems, shippingAddress) => {
    const endpoint = `${process.env.LULU_API_BASE_URL.replace(/\/$/, '')}/print-job-cost-calculations`; // Corrected endpoint
    try {
        await ensureHostnameResolvable(endpoint);
        const token = await getLuluAuthToken();
        const payload = {
            line_items: lineItems,
            shipping_address: shippingAddress,
            shipping_level: "MAIL" // Default to MAIL as per previous successful calls
        };
        const response = await retryWithBackoff(async () => {
            return await axios.post(endpoint, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                timeout: 15000
            });
        });
        return response.data;
    } catch (error) {
        console.error("Error getting print job costs from Lulu:", error.response ? error.response.data : error.message);
        throw new Error(`Failed to get print job costs from Lulu.`);
    }
};

export const createLuluPrintJob = async (orderDetails, shippingInfo) => {
    try {
        const token = await getLuluAuthToken();
        const baseUrl = process.env.LULU_API_BASE_URL;
        if (!baseUrl) {
            throw new Error('LULU_API_BASE_URL is not configured.');
        }
        const printJobUrl = `${baseUrl.replace(/\/$/, '')}/print-jobs/`;
        await ensureHostnameResolvable(printJobUrl);
        const payload = {
            contact_email: shippingInfo.email,
            external_id: `inkwell-order-${orderDetails.id}`,
            shipping_level: "MAIL",
            shipping_address: {
                name: shippingInfo.name, street1: shippingInfo.street1, city: shippingInfo.city,
                postcode: shippingInfo.postcode, country_code: shippingInfo.country_code,
                state_code: shippingInfo.state_code, phone_number: shippingInfo.phone_number,
                email: shippingInfo.email
            },
            line_items: [{
                title: orderDetails.book_title, quantity: 1, pod_package_id: orderDetails.lulu_product_id,
                cover: { source_url: orderDetails.cover_pdf_url },
                interior: { source_url: orderDetails.interior_pdf_url }
            }],
        };
        const response = await retryWithBackoff(async () => {
            return await axios.post(printJobUrl, payload, {
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                timeout: 60000
            });
        }, 3, 500);
        return response.data;
    } catch (error) {
        console.error("Error creating Lulu Print Job:", error.response ? error.response.data : error.message);
        throw new Error('Failed to create Lulu Print Job.');
    }
};

export const getPrintJobStatus = async (luluJobId) => {
    try {
        const token = await getLuluAuthToken();
        const baseUrl = process.env.LULU_API_BASE_URL;
        if (!baseUrl) {
            throw new Error('LULU_API_BASE_URL is not configured.');
        }
        const statusUrl = `${baseUrl.replace(/\/$/, '')}/print-jobs/${luluJobId}/`;
        await ensureHostnameResolvable(statusUrl);
        const response = await retryWithBackoff(async () => {
            return await axios.get(statusUrl, {
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                timeout: 15000
            });
        });
        return {
            status: response.data.status?.name || 'Unknown',
            tracking_urls: response.data.line_items?.[0]?.tracking_urls || []
        };
    } catch (error) {
        console.error(`Error fetching status for Lulu Job ${luluJobId}:`, error.response ? error.response.data : error.message);
        throw new Error(`Failed to fetch status for Lulu job ${luluJobId}.`);
    }
};