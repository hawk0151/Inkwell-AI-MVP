// backend/src/services/lulu.service.js
import axios from 'axios';
import { Buffer } from 'buffer';
import dns from 'dns/promises';

// Ensure AbortController is defined
let AbortController;
if (typeof globalThis.AbortController === 'function') {
    AbortController = globalThis.AbortController;
} else {
    try {
        const NodeAbortController = require('node-abort-controller');
        AbortController = NodeAbortController.AbortController;
    } catch (e) {
        console.error("Critical: AbortController not available. Please ensure Node.js v15+ is used or 'node-abort-controller' is installed. Error:", e.message);
        throw new Error("AbortController is not available.");
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
        wordTarget: { min: 800, max: 1200 }, // Standard word target
        category: 'novel',
        bleedMm: 3.175,
        safeMarginMm: 6.35,
        isDefault: false
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
        wordsPerPage: 700,
        defaultWordsPerPage: 700,
        totalChapters: 10,
        wordTarget: { min: 2400, max: 3600 }, // INCREASED word target
        category: 'novel',
        bleedMm: 3.175,
        safeMarginMm: 6.35,
        isDefault: false
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
        wordTarget: { min: 800, max: 1200 }, // Standard word target
        category: 'novel',
        bleedMm: 3.175,
        safeMarginMm: 6.35,
        isDefault: false
    },
    {
        id: 'SQUARE_HC_8.75x8.75',
        name: 'Square Hardcover Picture Book (8.75 x 8.75")',
        trimSize: '8.75x8.75',
        luluSku: '0850X0850FCPRECW080CW444MXX',
        basePrice: 59.99,
        defaultPageCount: 24,
        minPageCount: 24,
        maxPageCount: 24,
        wordsPerPage: 0,
        defaultWordsPerPage: 0,
        totalChapters: 0,
        category: 'pictureBook',
        bleedMm: 3.175,
        safeMarginMm: 6.35,
        type: 'pictureBook',
        isDefault: true,
        aliases: ['A4PREMIUM_FC_8.27x11.69'] 
    }
];

export const findProductConfiguration = (productId) => {
    if (!productId) return undefined;
    return LULU_PRODUCT_CONFIGURATIONS.find(p => 
        p.id === productId || 
        (p.aliases && p.aliases.includes(productId))
    );
};

export const getPrintOptions = () => {
    return LULU_PRODUCT_CONFIGURATIONS.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type,
        price: p.basePrice,
        defaultPageCount: p.defaultPageCount,
        defaultWordsPerPage: p.defaultWordsPerPage,
        totalChapters: p.totalChapters,
        category: p.category
    }));
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

export async function getCoverDimensions(podPackageId, pageCount) {
    console.log(`[Lulu Service] Attempting to get cover dimensions for SKU: ${podPackageId}, Page Count: ${pageCount}`);
    const cacheKey = `${podPackageId}-${pageCount}-pt`;
    if (coverDimensionsCache.has(cacheKey)) {
        return coverDimensionsCache.get(cacheKey);
    }
    const endpoint = `${process.env.LULU_API_BASE_URL.replace(/\/$/, '')}/cover-dimensions/`;
    try {
        await ensureHostnameResolvable(endpoint);
        const token = await getLuluAuthToken();
        const response = await retryWithBackoff(async () => {
            return await axios.post(
                endpoint,
                { pod_package_id: podPackageId, interior_page_count: pageCount, unit: 'pt' },
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
        let widthPts, heightPts;

        if (dimensions.width && dimensions.height && dimensions.unit === 'pt') {
            widthPts = parseFloat(dimensions.width);
            heightPts = parseFloat(dimensions.height);
        } else {
            throw new Error('Unexpected Lulu API response for cover dimensions.');
        }

        const result = {
            width: widthPts,
            height: heightPts,
        };
        coverDimensionsCache.set(cacheKey, result);
        console.log(`[Lulu Service] ✅ Successfully retrieved cover dimensions: W=${widthPts.toFixed(2)}pts, H=${heightPts.toFixed(2)}pts`);
        return result;

    } catch (error) {
        let errorMessage = error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : error.message;
        console.error(`[Lulu Service] Error getting cover dimensions for SKU ${podPackageId}: ${errorMessage}`);
        throw new Error(`Failed to get cover dimensions for SKU ${podPackageId} with ${pageCount} pages. Error: ${errorMessage}`);
    }
}

export async function validateInteriorFile(sourceUrl, podPackageId) {
    console.log(`[Lulu Service] Validating interior file for SKU: ${podPackageId}...`);
    const endpoint = `${process.env.LULU_API_BASE_URL.replace(/\/$/, '')}/validate-interior/`;
    try {
        const token = await getLuluAuthToken();
        const response = await retryWithBackoff(async () => {
            return await axios.post(
                endpoint,
                { source_url: sourceUrl, pod_package_id: podPackageId },
                {
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
                    timeout: 30000 
                }
            );
        }, 3, 500);

        const validationJobId = response.data.id;
        if (!validationJobId) {
            throw new Error('Lulu API did not return a validation job ID.');
        }

        console.log(`[Lulu Service] Interior file validation started, job ID: ${validationJobId}`);
        return await pollValidationStatus(validationJobId, token, 'interior');
    } catch (error) {
        let errorMessage = error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : error.message;
        console.error(`[Lulu Service] Error submitting interior file for validation: ${errorMessage}`);
        return { status: 'ERROR', errors: [errorMessage] };
    }
}

export async function validateCoverFile(sourceUrl, podPackageId, pageCount) {
    console.log(`[Lulu Service] Validating cover file for SKU: ${podPackageId}, Page Count: ${pageCount}...`);
    const endpoint = `${process.env.LULU_API_BASE_URL.replace(/\/$/, '')}/validate-cover/`;
    try {
        const token = await getLuluAuthToken();
        const response = await retryWithBackoff(async () => {
            return await axios.post(
                endpoint,
                { source_url: sourceUrl, pod_package_id: podPackageId, interior_page_count: pageCount },
                {
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    timeout: 30000
                }
            );
        }, 3, 500);
        
        const validationJobId = response.data.id;
        if (!validationJobId) {
            throw new Error('Lulu API did not return a validation job ID.');
        }
        
        console.log(`[Lulu Service] Cover file validation started, job ID: ${validationJobId}`);
        return await pollValidationStatus(validationJobId, token, 'cover');

    } catch (error) {
        let errorMessage = error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : error.message;
        console.error(`[Lulu Service] Error submitting cover file for validation: ${errorMessage}`);
        return { status: 'ERROR', errors: [errorMessage] };
    }
}

async function pollValidationStatus(jobId, token, fileType, timeout = 180000, interval = 10000) {
    const start = Date.now();
    const endpoint = `${process.env.LULU_API_BASE_URL.replace(/\/$/, '')}/${fileType === 'cover' ? 'validate-cover' : 'validate-interior'}/${jobId}/`;
    
    while (Date.now() - start < timeout) {
        try {
            const response = await axios.get(endpoint, {
                headers: { 'Authorization': `Bearer ${token}` },
                timeout: interval - 1000,
            });
            const status = response.data.status;
            console.log(`[Lulu Service] ${fileType} validation status for job ${jobId}: ${status}`);
            
            if (status === 'VALIDATED' || status === 'NORMALIZED') {
                return response.data;
            } else if (status === 'ERROR') {
                console.error(`[Lulu Service] ${fileType} validation job ${jobId} failed with errors:`, response.data.errors);
                return response.data;
            }
        } catch (err) {
            console.error(`[Lulu Service] Polling error for job ${jobId}:`, err.message);
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    console.error(`[Lulu Service] Validation for job ${jobId} timed out after ${timeout / 1000} seconds.`);
    return { status: 'TIMEOUT', errors: ['Validation timed out.'] };
}

/**
 * DEPRECATED: This function only retrieves shipping costs.
 */
export const getLuluShippingOptionsAndCosts = async (podPackageId, pageCount, shippingAddress, currency = 'AUD') => {
    console.log(`[Lulu Service] Getting all shipping options from /shipping-options/ for SKU: ${podPackageId}, Page: ${pageCount}`);
    const endpoint = `${process.env.LULU_API_BASE_URL.replace(/\/$/, '')}/shipping-options/`;
    const availableOptions = [];
    
    const payload = {
        currency: currency,
        line_items: [{ page_count: pageCount, pod_package_id: podPackageId, quantity: 1 }],
        shipping_address: {
            city: shippingAddress.city,
            country: shippingAddress.country_code,
            postcode: shippingAddress.postcode,
            state_code: shippingAddress.state_code || '',
            street1: shippingAddress.street1,
            street2: shippingAddress.street2 || '',
            name: shippingAddress.name,
            phone_number: shippingAddress.phone_number,
            email: shippingAddress.email
        }
    };
    
    console.log('[Lulu Service] Requesting shipping options with payload:', JSON.stringify(payload, null, 2));

    try {
        await ensureHostnameResolvable(endpoint);
        const token = await getLuluAuthToken();
        const response = await retryWithBackoff(async () => {
            return await axios.post(endpoint, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                timeout: 15000
            });
        });

        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
            response.data.forEach(luluOption => {
                const cost = parseFloat(luluOption.cost_excl_tax);
                if (!isNaN(cost) && cost >= 0) {
                    availableOptions.push({
                        level: luluOption.level,
                        name: luluOption.name || luluOption.level,
                        cost: cost,
                        estimatedDeliveryDate: `${luluOption.min_delivery_date || 'N/A'} - ${luluOption.max_delivery_date || 'N/A'}`,
                        traceable: luluOption.traceable || false
                    });
                }
            });
            availableOptions.sort((a, b) => a.cost - b.cost);
            console.log('[Lulu Service] Successfully retrieved shipping options from Lulu:', JSON.stringify(availableOptions, null, 2));
        } else {
            console.warn('[Lulu Service] /shipping-options/ returned no options:', response.data);
        }

    } catch (error) {
        console.error(`[Lulu Service] Error getting shipping options from /shipping-options/: ${error.message || error}`);
        if (error.response && error.response.data) {
            console.error("Lulu API Error Details (shipping-options):", JSON.stringify(error.response.data, null, 2));
        }
        throw new Error(`Failed to get dynamic shipping options from Lulu.`);
    }
    
    return { shippingOptions: availableOptions };
};

/**
 * Retrieves the total cost of a print job, including production and shipping.
 * @param {Array<object>} lineItems An array of line items for the order.
 * @param {object} shippingAddress The shipping address.
 * @param {string} selectedShippingLevel The selected shipping level (e.g., 'MAIL', 'EXPEDITED').
 * @returns {Promise<object>} An object containing the total cost including tax.
 */
export const getPrintJobCosts = async (lineItems, shippingAddress, selectedShippingLevel) => {
    console.log(`[Lulu Service] Getting print job costs for shipping level: ${selectedShippingLevel}`);
    const endpoint = `${process.env.LULU_API_BASE_URL.replace(/\/$/, '')}/print-job-cost/`;
    
    const payload = {
        currency: 'AUD',
        line_items: lineItems,
        shipping_address: {
            city: shippingAddress.city,
            country: shippingAddress.country_code,
            postcode: shippingAddress.postcode,
            state_code: shippingAddress.state_code || '',
            street1: shippingAddress.street1,
            street2: shippingAddress.street2 || '',
            name: shippingAddress.name,
            phone_number: shippingAddress.phone_number,
            email: shippingAddress.email
        },
        shipping_level: selectedShippingLevel
    };

    try {
        await ensureHostnameResolvable(endpoint);
        const token = await getLuluAuthToken();
        const response = await retryWithBackoff(async () => {
            return await axios.post(endpoint, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                timeout: 15000
            });
        });

        const totalCostInclTax = response.data.total_cost_incl_tax;
        console.log(`[Lulu Service] ✅ Successfully retrieved total print job cost: $${totalCostInclTax}`);

        return { totalCostInclTax: parseFloat(totalCostInclTax) };
    } catch (error) {
        console.error(`[Lulu Service] Error getting print job costs from /print-job-cost/: ${error.message || error}`);
        if (error.response && error.response.data) {
            console.error("Lulu API Error Details (print-job-cost):", JSON.stringify(error.response.data, null, 2));
        }
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
            shipping_level: orderDetails.shipping_level_selected,
            shipping_address: {
                name: shippingInfo.name, street1: shippingInfo.street1, street2: shippingInfo.street2, city: shippingInfo.city,
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