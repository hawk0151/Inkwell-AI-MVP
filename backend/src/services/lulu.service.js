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
        id: 'A4PREMIUM_FC_8.27x11.69',
        name: 'A4 Landscape Hardcover Picture Book (11.94 x 8.52")',
        trimSize: '11.94x8.52',
        luluSku: '1169X0827FCPRECW080CW444MXX',
        basePrice: 69.99,
        defaultPageCount: 40,
        minPageCount: 24,
        maxPageCount: 800,
        wordsPerPage: 120,
        defaultWordsPerPage: 120,
        totalChapters: 1,
        category: 'pictureBook',
        bleedMm: 3.175,
        safeMarginMm: 6.35,
        type: 'pictureBook',
        isDefault: true
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
                'grant_type=client_credentials', // MODIFIED: This should be the only data argument
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
    const endpoint = `${process.env.LULU_API_BASE_URL.replace(/\/$/, '')}/cover-dimensions`;
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
        console.log(`[Lulu Service DEBUG] Full Lulu cover dimensions API response for SKU ${podPackageId}:`, JSON.stringify(dimensions, null, 2));

        const ptToMm = (pt) => pt * (25.4 / 72);

        let widthMm, heightMm;

        // NEW LOGIC: Prioritize 'width'/'height' and 'unit' fields when unit is 'pt'
        if (typeof dimensions.width === 'string' && typeof dimensions.height === 'string' && dimensions.unit === 'pt') {
            widthMm = ptToMm(parseFloat(dimensions.width));
            heightMm = ptToMm(parseFloat(dimensions.height));
            console.log(`[Lulu Service] Using width and height (in pts) from response.`);
        }
        // Fallback for width_pts/height_pts (if Lulu API ever returns this format again)
        else if (typeof dimensions.width_pts === 'number' && typeof dimensions.height_pts === 'number') {
            widthMm = ptToMm(dimensions.width_pts);
            heightMm = ptToMm(dimensions.height_pts);
            console.log(`[Lulu Service] Using width_pts and height_pts from response.`);
        }
        // Fallback for width/height with unit 'mm'
        else if (typeof dimensions.width === 'number' && typeof dimensions.height === 'number' && dimensions.unit === 'mm') {
            widthMm = dimensions.width;
            heightMm = dimensions.height;
            console.log(`[Lulu Service] Using width and height (in mm) from response.`);
        }
        // If none of the expected formats are found, throw an error
        else {
            throw new Error('Unexpected Lulu API response for cover dimensions: Missing expected "width"/"height" (in pts or mm) or "width_pts"/"height_pts".');
        }

        const result = {
            width: widthMm,
            height: heightMm,
            layout: widthMm > heightMm ? 'landscape' : 'portrait'
        };
        coverDimensionsCache.set(cacheKey, result);
        console.log(`[Lulu Service] ✅ Successfully retrieved and parsed cover dimensions: W=${widthMm.toFixed(2)}mm, H=${heightMm.toFixed(2)}mm`);
        return result;

    } catch (error) {
        let errorMessage = error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : error.message;
        console.error(`[Lulu Service] Error getting cover dimensions from Lulu API for SKU ${podPackageId}: ${errorMessage}`);
        throw new Error(`Failed to get cover dimensions for SKU ${podPackageId} with ${pageCount} pages. Error: ${errorMessage}`);
    }
}

export const getPrintJobCosts = async (lineItems, shippingAddress, selectedShippingLevel = null) => { // ADDED selectedShippingLevel parameter
    console.log(`[Lulu Service] Attempting to get print job costs from Lulu.`);
    const endpoint = `${process.env.LULU_API_BASE_URL.replace(/\/$/, '')}/print-job-cost-calculations`;
    try {
        await ensureHostnameResolvable(endpoint);
        const token = await getLuluAuthToken();
        const payload = {
            line_items: lineItems,
            shipping_address: shippingAddress,
            // Include shipping_level ONLY if provided, otherwise Lulu will return all options
            ...(selectedShippingLevel && { shipping_level: selectedShippingLevel }) 
        };
        console.log('[Lulu Service] Requesting print job costs with body:', JSON.stringify(payload, null, 2)); // Use payload for logging

        const response = await retryWithBackoff(async () => {
            return await axios.post(endpoint, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                timeout: 15000
            });
        });

        // MODIFIED RETURN: Return more comprehensive data
        console.log('[Lulu Service] Successfully retrieved print job costs and shipping options.');
        return {
            lineItemCosts: response.data.line_item_costs,
            shippingOptions: response.data.shipping_options, // Lulu returns this array
            fulfillmentCost: response.data.fulfillment_cost,
            totalCostInclTax: response.data.total_cost_incl_tax,
            currency: response.data.currency
        };

    } catch (error) {
        console.error("Error getting print job costs from Lulu:", error.response ? error.response.data : error.message);
        // MODIFIED: Log full Lulu response data for better debugging
        if (error.response && error.response.data) {
            console.error("Lulu API Error Details:", JSON.stringify(error.response.data, null, 2));
        }
        throw new Error(`Failed to get print job costs from Lulu.`);
    }
};

// MODIFIED: Simplified to use the provided full address directly, no dummy address generation
export const getLuluShippingOptionsAndCosts = async (podPackageId, pageCount, shippingAddress) => {
    console.log(`[Lulu Service] Attempting to get all shipping options for SKU: ${podPackageId}, Page Count: ${pageCount}, Address:`, shippingAddress);

    // Common Lulu shipping levels to try. Adjust if Lulu has different/new levels.
    // Based on Lulu's API spec and prior errors, these are more likely to be globally available.
    const COMMON_LULU_SHIPPING_LEVELS = ['MAIL', 'PRIORITY_MAIL', 'EXPEDITED', 'EXPRESS']; 

    const availableOptions = [];
    let basePrintCost = 0;
    let currency = 'AUD'; // Default currency (will be updated by Lulu response)

    const lineItems = [{
        pod_package_id: podPackageId,
        page_count: pageCount,
        quantity: 1
    }];

    for (const level of COMMON_LULU_SHIPPING_LEVELS) {
        try {
            console.log(`[Lulu Service] Probing shipping level: ${level}`);
            const response = await getPrintJobCosts(lineItems, shippingAddress, level); // MODIFIED: Use the real address directly
            
            // Extract the base print cost from the first successful response
            if (basePrintCost === 0 && response.lineItemCosts && response.lineItemCosts.length > 0) {
                basePrintCost = parseFloat(response.lineItemCosts[0].total_cost_incl_tax);
            }

            // MODIFIED: Corrected the typo response.response.data to response.shippingOptions
            if (response.shippingOptions && response.shippingOptions.length > 0) {
                response.shippingOptions.forEach(luluOption => {
                    if (!availableOptions.some(ao => ao.level === luluOption.level)) {
                        availableOptions.push({
                            level: luluOption.level,
                            name: luluOption.name,
                            costUsd: parseFloat(luluOption.total_cost_incl_tax), // This is still AUD from Lulu, will be converted in controller
                            estimatedDeliveryDate: luluOption.estimated_delivery_date,
                        });
                    }
                });
                currency = response.currency;
            }
            console.log(`[Lulu Service] Successfully processed options for probe level: ${level}`);
        } catch (error) {
            console.warn(`[Lulu Service] Failed to get shipping cost for level '${level}': ${error.message || error}`);
            if (error.response && error.response.data) {
                console.warn(`[Lulu Service] Lulu Probe Error Details for ${level}:`, JSON.stringify(error.response.data, null, 2));
            }
        }
    }

    const validOptions = availableOptions.filter(option => !isNaN(option.costUsd) && option.costUsd > 0);
    validOptions.sort((a, b) => a.costUsd - b.costUsd);

    if (validOptions.length === 0 && COMMON_LULU_SHIPPING_LEVELS.length > 0) {
        console.warn(`[Lulu Service] No valid shipping options retrieved for SKU ${podPackageId} to address`, shippingAddress);
    }

    return {
        shippingOptions: validOptions,
        printCost: basePrintCost,
        currency: currency
    };
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
            shipping_level: orderDetails.shipping_level, // Use the selected shipping level from orderDetails
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