import axios from 'axios';
import { Buffer } from 'buffer';
import dns from 'dns/promises'; // Ensure dns/promises is correctly used for Node.js v15+

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Lulu API Endpoints
const LULU_API_BASE_URL = process.env.LULU_API_BASE_URL || 'https://api.lulu.com/print-api/v0';
const LULU_AUTH_URL = process.env.LULU_AUTH_URL || 'https://api.lulu.com/auth/realms/glasgow/protocol/openid-connect/token'; // Verify this URL based on Lulu docs
const LULU_CLIENT_ID = process.env.LULU_CLIENT_ID;
const LULU_CLIENT_SECRET = process.env.LULU_CLIENT_SECRET;

// In-memory cache for Lulu access token and product configs
let accessToken = null;
let tokenExpiry = 0;
// productConfigsCache is managed by getPrintOptions, so it doesn't need a global let.

// NEW: Define standard bleed value (0.125 inches per side)
const STANDARD_BLEED_MM = 3.175; // 0.125 inches = 3.175mm

// LULU_PRODUCT_CONFIGURATIONS: Defines various book product templates with their properties
// This array should ideally be loaded from a database or external configuration for dynamic management.
// For now, it's hardcoded based on known Lulu offerings.
export const LULU_PRODUCT_CONFIGURATIONS = [
    {
        id: 'NOVBOOK_BW_5.25x8.25',
        luluSku: '0500X0800BWSTDPB060UC444MXX', // 5.25x8.25 in, Black & White, Standard Paperback, Glossy
        name: 'Novella (5.25 x 8.25" Paperback)',
        type: 'textBook',
        trimSize: '5.25x8.25',
        bleedMm: STANDARD_BLEED_MM, // Added bleed for interior pages
        basePrice: 5.99, // Base print cost from Lulu (AUD) - Corrected based on actual API response
        defaultPageCount: 40,
        minPageCount: 32,
        maxPageCount: 800,
        wordsPerPage: 250,
        defaultWordsPerPage: 250,
        totalChapters: 6,
        category: 'novel'
    },
    {
        id: 'A4NOVEL_PB_8.52x11.94',
        luluSku: '0827X1169BWSTDPB060UC444MXX', // Verify actual Lulu SKU for A4 size
        name: 'A4 Novel (8.52 x 11.94" Paperback)',
        type: 'textBook',
        trimSize: '8.52x11.94', // A4 equivalent trim size
        bleedMm: STANDARD_BLEED_MM,
        basePrice: 15.99, // Base print cost from Lulu (AUD) - Corrected
        defaultPageCount: 80,
        minPageCount: 32, // Verify actual min/max for A4
        maxPageCount: 800,
        wordsPerPage: 450,
        defaultWordsPerPage: 400,
        totalChapters: 8,
        category: 'novel'
    },
    {
        id: 'ROYAL_HARDCOVER_6.39x9.46',
        luluSku: '0614X0921BWSTDCW060UC444MXX', // Verify actual Lulu SKU
        name: 'Royal Hardcover (6.39 x 9.46")',
        type: 'textBook', // Can be used for text-heavy books
        trimSize: '6.39x9.46',
        bleedMm: STANDARD_BLEED_MM,
        basePrice: 24.99, // Base print cost from Lulu (AUD) - Corrected
        defaultPageCount: 100,
        minPageCount: 24,
        maxPageCount: 800,
        wordsPerPage: 300,
        defaultWordsPerPage: 300,
        totalChapters: 10,
        category: 'novel'
    },
    // NEW PICTURE BOOK PRODUCT CONFIGURATION (based on user's provided specs)
    {
        id: 'FC_PREMIUM_HL_11.25x8.75', // Custom ID for this specific landscape picture book
        luluSku: '1100X0850FCPRECW080CW444GXX', // User provided SKU
        name: 'Premium Photo Book (11.25 x 8.75" Landscape)', // Descriptive name
        type: 'pictureBook',
        trimSize: '8.75x11.25_LANDSCAPE', // Custom trimSize to represent landscape orientation from portrait base dimensions (W x H)
        bleedMm: STANDARD_BLEED_MM,
        basePrice: 15.00, // Base print cost from Lulu (AUD) - Corrected
        defaultPageCount: 40,
        minPageCount: 24, // User provided min
        maxPageCount: 800, // User provided max
        wordsPerPage: 120, // Lower words per page for picture books
        defaultWordsPerPage: 120,
        totalChapters: 1, // Typically 1 chapter/story for picture books
        category: 'pictureBook'
    }
];

// In-memory cache for Lulu access token
let luluAccessToken = null;
let accessTokenExpiry = 0;

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

export async function getLuluAuthToken() {
    if (luluAccessToken && Date.now() < accessTokenExpiry) {
        return luluAccessToken;
    }
    console.log('Fetching new Lulu access token (Legacy Method)...');
    const clientKey = LULU_CLIENT_ID;
    const clientSecret = LULU_CLIENT_SECRET;
    if (!clientKey || !clientSecret) {
        throw new Error('Lulu API credentials (LULU_CLIENT_ID, LULU_CLIENT_SECRET) are not configured.');
    }
    const apiUrl = `${LULU_API_BASE_URL.replace(/\/v0$/, '')}/auth/realms/glasgow/protocol/openid-connect/token`; // Use base URL directly for auth
    const basicAuth = Buffer.from(`${clientKey}:${clientSecret}`).toString('base64');
    await ensureHostnameResolvable(apiUrl); // Check auth URL hostname
    try {
        const response = await retryWithBackoff(async () => {
            return await axios.post(
                apiUrl,
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
        luluAccessToken = response.data.access_token;
        accessTokenExpiry = Date.now() + (response.data.expires_in * 1000) - 5000; // 5 seconds buffer
        console.log('Lulu access token obtained (Legacy Method).');
        return luluAccessToken;
    } catch (error) {
        if (error.response) {
            console.error('Authentication error fetching Lulu token:', {
                status: error.response.status,
                data: error.response.data
            });
        } else {
            console.error('Unknown error fetching Lulu token:', error.message);
        }
        throw new Error('Failed to authenticate with Lulu API.');
    }
}

export async function getPrintOptions() {
    if (productConfigsCache) {
        return productConfigsCache;
    }
    console.log("DEBUG getPrintOptions: LULU_PRODUCT_CONFIGURATIONS status:",
        LULU_PRODUCT_CONFIGURATIONS && LULU_PRODUCT_CONFIGURATIONS.length > 0 ? "POPULATED" : "EMPTY/UNDEFINED");
    if (LULU_PRODUCT_CONFIGURATIONS) {
        console.log("DEBUG getPrintOptions: First product config (if any):", LULU_PRODUCT_CONFIGURATIONS[0]);
    }

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

    productConfigsCache = options; // Cache the mapped options
    console.log("DEBUG getPrintOptions: Options array being returned:", options);
    return options;
}

export async function getPrintJobCosts(lineItems, shippingAddress, shippingLevel = "MAIL") { // Added shippingLevel parameter
    const endpoint = `${LULU_API_BASE_URL.replace(/\/$/, '')}/print-job-cost-calculations/`;
    try {
        await ensureHostnameResolvable(endpoint);
        const token = await getLuluAuthToken();
        const payload = {
            line_items: lineItems,
            shipping_address: shippingAddress,
            shipping_level: shippingLevel // Use the passed shippingLevel
        };
        console.log("DEBUG: Requesting print job cost calculation from Lulu...");
        const response = await retryWithBackoff(async () => {
            return await axios.post(endpoint, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                timeout: 15000
            });
        });
        console.log("✅ Successfully retrieved print job costs from Lulu.");
        return response.data;
    } catch (error) {
        if (error.response) {
            console.error("❌ Error getting print job costs from Lulu (API response):", {
                status: error.response.status,
                data: error.response.data
            });
        } else {
            console.error("❌ Error getting print job costs from Lulu (network/unknown):", error.message);
        }
        throw new Error(`Failed to get print job costs. Lulu API error: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    }
}

export async function getCoverDimensionsFromApi(podPackageId, pageCount) {
    const endpoint = `${LULU_API_BASE_URL.replace(/\/$/, '')}/cover-dimensions/`;
    try {
        await ensureHostnameResolvable(endpoint);
    } catch (dnsErr) {
        console.error('DNS resolution issue before fetching cover dimensions:', dnsErr.message);
        throw new Error(`Network/DNS error when trying to reach Lulu for cover dimensions: ${dnsErr.message}`);
    }
    try {
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
        if (typeof dimensions.width === 'undefined' || typeof dimensions.height === 'undefined' || dimensions.unit !== 'pt') {
            console.error('Unexpected Lulu API response structure for cover dimensions:', JSON.stringify(dimensions, null, 2));
            throw new Error('Unexpected Lulu API response for cover dimensions. Missing expected fields (width, height) or unit is not "pt".');
        }
        const widthMm = ptToMm(parseFloat(dimensions.width));
        const heightMm = ptToMm(parseFloat(dimensions.height));
        const result = {
            width: widthMm,
            height: heightMm,
            layout: widthMm > heightMm ? 'landscape' : 'portrait',
            bleed: 3.175,
            spineThickness: 0
        };
        // coverDimensionsCache.set(cacheKey, result); // Cache key is not used, fix or remove
        return result;
    } catch (error) {
        console.error('Error getting cover dimensions from Lulu API (cover-dimensions endpoint):',
            error.response ? JSON.stringify(error.response.data) : error.message);
        throw new Error(`Failed to get cover dimensions for SKU ${podPackageId} with ${pageCount} pages. Lulu API error: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    }
}