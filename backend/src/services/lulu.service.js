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
        wordsPerPage: 450,
        defaultWordsPerPage: 400,
        totalChapters: 8,
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
        category: 'novel',
        bleedMm: 3.175,
        safeMarginMm: 6.35,
        isDefault: false
    },
    // NEW: Added the missing configuration for the picture book
    {
        id: 'A4PREMIUM_FC_8.27x11.69',
        luluSku: '0827X1169FCPREPB080UC444MXX', // This is an assumption based on a common SKU format, please verify
        name: 'A4 Landscape Picture Book',
        type: 'pictureBook',
        trimSize: '8.27x11.69',
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
    }
];

/**
 * NEW HELPER FUNCTION
 * Robustly finds a product configuration by its primary ID or an alias.
 * @param {string} productId The ID to look up.
 * @returns {object|undefined} The configuration object or undefined if not found.
 */
export const findProductConfiguration = (productId) => {
    if (!productId) return undefined;
    return LULU_PRODUCT_CONFIGURATIONS.find(p => 
        p.id === productId || 
        (p.aliases && p.aliases.includes(productId))
    );
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
        const ptToMm = (pt) => pt * (25.4 / 72);
        let widthMm, heightMm;

        if (typeof dimensions.width === 'string' && typeof dimensions.height === 'string' && dimensions.unit === 'pt') {
            widthMm = ptToMm(parseFloat(dimensions.width));
            heightMm = ptToMm(parseFloat(dimensions.height));
        }
        else if (typeof dimensions.width_pts === 'number' && typeof dimensions.height_pts === 'number') {
            widthMm = ptToMm(dimensions.width_pts);
            heightMm = ptToMm(dimensions.height_pts);
        }
        else if (typeof dimensions.width === 'number' && typeof dimensions.height === 'number' && dimensions.unit === 'mm') {
            widthMm = dimensions.width;
            heightMm = dimensions.height;
        }
        else {
            throw new Error('Unexpected Lulu API response for cover dimensions.');
        }

        const result = {
            width: widthMm,
            height: heightMm,
            layout: widthMm > heightMm ? 'landscape' : 'portrait'
        };
        coverDimensionsCache.set(cacheKey, result);
        console.log(`[Lulu Service] ✅ Successfully retrieved cover dimensions: W=${widthMm.toFixed(2)}mm, H=${heightMm.toFixed(2)}mm`);
        return result;

    } catch (error) {
        let errorMessage = error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : error.message;
        console.error(`[Lulu Service] Error getting cover dimensions from Lulu API for SKU ${podPackageId}: ${errorMessage}`);
        throw new Error(`Failed to get cover dimensions for SKU ${podPackageId} with ${pageCount} pages. Error: ${errorMessage}`);
    }
}

export const getPrintJobCosts = async (lineItems, shippingAddress, selectedShippingLevel) => {
    console.log(`[Lulu Service] Getting FINAL print job costs from Lulu for level: ${selectedShippingLevel}.`);
    const endpoint = `${process.env.LULU_API_BASE_URL.replace(/\/$/, '')}/print-job-cost-calculations`;
    try {
        await ensureHostnameResolvable(endpoint);
        const token = await getLuluAuthToken();
        const payload = {
            line_items: lineItems,
            shipping_address: shippingAddress,
            shipping_level: selectedShippingLevel
        };
        console.log('[Lulu Service] Requesting final print job costs with body:', JSON.stringify(payload, null, 2));

        const response = await retryWithBackoff(async () => {
            return await axios.post(endpoint, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                timeout: 15000
            });
        });

        console.log('[Lulu Service] Successfully retrieved final print job costs.');
        return {
            lineItemCosts: response.data.line_item_costs,
            shippingOptions: response.data.shipping_options,
            fulfillmentCost: response.data.fulfillment_cost,
            totalCostInclTax: response.data.total_cost_incl_tax,
            currency: response.data.currency
        };

    } catch (error) {
        console.error(`Error getting print job costs from Lulu for level '${selectedShippingLevel}':`, error.response ? error.response.data : error.message);
        if (error.response && error.response.data) {
            console.error("Lulu API Error Details:", JSON.stringify(error.response.data, null, 2));
        }
        throw new Error(`Failed to get print job costs from Lulu for level '${selectedShippingLevel}'.`);
    }
};

export const getLuluShippingOptionsAndCosts = async (podPackageId, pageCount, shippingAddress, currency = 'USD') => {
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
                        costUsd: cost,
                        estimatedDeliveryDate: `${luluOption.min_delivery_date || 'N/A'} - ${luluOption.max_delivery_date || 'N/A'}`,
                        traceable: luluOption.traceable || false
                    });
                }
            });
            availableOptions.sort((a, b) => a.costUsd - b.costUsd);
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

// backend/src/controllers/shipping.controller.js

import { getDb } from '../db/database.js';
import { findProductConfiguration, getLuluShippingOptionsAndCosts } from '../services/lulu.service.js';
import { generateAndSaveTextBookPdf, finalizePdfPageCount } from '../services/pdf.service.js';
import jsonwebtoken from 'jsonwebtoken';
import fs from 'fs/promises';

const JWT_QUOTE_SECRET = process.env.JWT_QUOTE_SECRET || 'your_super_secret_jwt_quote_key_please_change_this_in_production';
const QUOTE_TOKEN_EXPIRY_MINUTES = 10;

const FALLBACK_SHIPPING_OPTION = {
    level: 'FALLBACK_STANDARD',
    name: 'Standard Shipping (Fallback)',
    costUsd: 15.00,
    estimatedDeliveryDate: '7-21 business days',
    isFallback: true
};

const VALID_ISO_COUNTRY_CODES = new Set(['AF', 'AX', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AU', 'AT', 'AZ', 'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BQ', 'BA', 'BW', 'BV', 'BR', 'IO', 'BN', 'BG', 'BF', 'BI', 'CV', 'KH', 'CM', 'CA', 'KY', 'CF', 'TD', 'CL', 'CN', 'CX', 'CC', 'CO', 'KM', 'CD', 'CG', 'CK', 'CR', 'CI', 'HR', 'CU', 'CW', 'CY', 'CZ', 'DK', 'DJ', 'DM', 'DO', 'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET', 'FK', 'FO', 'FJ', 'FI', 'FR', 'GF', 'PF', 'TF', 'GA', 'GM', 'GE', 'DE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY', 'HT', 'HM', 'VA', 'HN', 'HK', 'HU', 'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IM', 'IL', 'IT', 'JM', 'JP', 'JE', 'JO', 'KZ', 'KE', 'KI', 'KP', 'KR', 'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MO', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MS', 'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'NC', 'NZ', 'NI', 'NE', 'NG', 'NU', 'NF', 'MP', 'NO', 'OM', 'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PN', 'PL', 'PT', 'PR', 'QA', 'MK', 'RO', 'RU', 'RW', 'RE', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SX', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS', 'SS', 'ES', 'LK', 'SD', 'SR', 'SJ', 'SE', 'CH', 'SY', 'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TK', 'TO', 'TT', 'TN', 'TR', 'TM', 'TC', 'TV', 'UG', 'UA', 'AE', 'GB', 'US', 'UM', 'UY', 'UZ', 'VU', 'VE', 'VN', 'VG', 'VI', 'WF', 'EH', 'YE', 'ZM', 'ZW']);

async function getFullTextBook(bookId, userId, client) {
    const bookResult = await client.query(`SELECT * FROM text_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
    const book = bookResult.rows[0];
    if (!book) return null;
    const chaptersResult = await client.query(`SELECT * FROM chapters WHERE book_id = $1 ORDER BY chapter_number ASC`, [bookId]);
    book.chapters = chaptersResult.rows;
    return book;
}

async function getFullPictureBook(bookId, userId, client) {
    const bookResult = await client.query(`SELECT * FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
    const book = bookResult.rows[0];
    if (!book) return null;
    const eventsSql = `SELECT *, uploaded_image_url, overlay_text, story_text, is_bold_story_text FROM timeline_events WHERE book_id = $1 ORDER BY page_number ASC`;
    const timelineResult = await client.query(eventsSql, [bookId]);
    book.timeline = timelineResult.rows;
    return book;
}

// CRITICAL FIX: The "export" keyword is present here.
export const getShippingQuotes = async (req, res) => {
    let client;
    let tempInteriorPdfPath = null;
    const { bookId, bookType, shippingAddress } = req.body;
    const userId = req.userId;

    const trimmedAddress = {
        name: shippingAddress?.name?.trim() || '',
        street1: shippingAddress?.street1?.trim() || '',
        street2: shippingAddress?.street2?.trim() || '',
        city: shippingAddress?.city?.trim() || '',
        state_code: shippingAddress?.state_code?.trim() || '',
        postcode: shippingAddress?.postcode?.trim() || '',
        country_code: shippingAddress?.country_code?.trim().toUpperCase() || '',
        phone_number: shippingAddress?.phone_number?.trim() || '',
        email: shippingAddress?.email?.trim() || ''
    };

    if (!bookId || !bookType || !trimmedAddress.country_code || !trimmedAddress.name || !trimmedAddress.street1 || !trimmedAddress.city || !trimmedAddress.postcode) {
        return res.status(400).json({ message: "Book ID, book type, and a full shipping address are required." });
    }
    if (!['textBook', 'pictureBook'].includes(bookType)) {
        return res.status(400).json({ message: "Invalid book type provided." });
    }
    if (!VALID_ISO_COUNTRY_CODES.has(trimmedAddress.country_code)) {
        return res.status(400).json({ message: `Invalid country code: ${trimmedAddress.country_code}.` });
    }

    console.log(`[Shipping Quotes] Request for book ${bookId} (${bookType}) to ${trimmedAddress.country_code}`);

    try {
        const pool = await getDb();
        client = await pool.connect();

        let book;
        if (bookType === 'textBook') {
            book = await getFullTextBook(bookId, userId, client);
        } else { // pictureBook
            book = await getFullPictureBook(bookId, userId, client);
        }

        if (!book) {
            return res.status(404).json({ message: `Book project not found or not authorized.` });
        }

        const selectedProductConfig = findProductConfiguration(book.lulu_product_id);
        if (!selectedProductConfig) {
            console.error(`[Shipping Quotes ERROR] Product configuration not found for luluProductId: ${book.lulu_product_id}`);
            return res.status(500).json({ message: "Book product configuration not found." });
        }

        let actualFinalPageCount;
        if (bookType === 'pictureBook') {
            console.log(`[Shipping Quotes] Picture book detected. Using fixed page count from configuration.`);
            actualFinalPageCount = selectedProductConfig.defaultPageCount;
        } else { // bookType === 'textBook'
            console.log(`[Shipping Quotes] Textbook detected. Generating temporary PDF for page count...`);
            const { path: interiorPath, pageCount: trueContentPageCount } = await generateAndSaveTextBookPdf(book, selectedProductConfig);
            tempInteriorPdfPath = interiorPath;
            let pageCountForFinalize = trueContentPageCount;

            if (pageCountForFinalize === null) {
                console.warn(`[Shipping Quotes] True content page count was null. Falling back to product's defaultPageCount: ${selectedProductConfig.defaultPageCount}`);
                pageCountForFinalize = selectedProductConfig.defaultPageCount;
            }
            actualFinalPageCount = await finalizePdfPageCount(tempInteriorPdfPath, selectedProductConfig, pageCountForFinalize);
            if (actualFinalPageCount === null) {
                console.error(`[Shipping Quotes] Failed to finalize PDF page count.`);
                return res.status(500).json({ message: 'Failed to prepare book for shipping cost calculation.' });
            }
        }
        
        console.log(`[Shipping Quotes] Using final page count for cost calc: ${actualFinalPageCount}.`);

        let dynamicShippingResult;
        try {
            dynamicShippingResult = await getLuluShippingOptionsAndCosts(
                selectedProductConfig.luluSku,
                actualFinalPageCount,
                trimmedAddress,
                'USD'
            );
        } catch (luluServiceError) {
            console.warn(`[Shipping Quotes WARNING] Dynamic shipping options failed. Error: ${luluServiceError.message}`);
            dynamicShippingResult = { shippingOptions: [] };
        }

        let finalShippingOptions = dynamicShippingResult.shippingOptions.length > 0
            ? dynamicShippingResult.shippingOptions
            : [FALLBACK_SHIPPING_OPTION];
            
        const luluPrintCostUSD = selectedProductConfig.basePrice * 0.5;
        const baseProductPriceUSD = selectedProductConfig.basePrice;

        const payload = {
            bookId,
            bookType,
            luluSku: selectedProductConfig.luluSku,
            pageCount: actualFinalPageCount,
            shippingAddress: trimmedAddress,
            isFallback: finalShippingOptions[0].isFallback || false,
        };
        const quoteToken = jsonwebtoken.sign(payload, JWT_QUOTE_SECRET, { expiresIn: `${QUOTE_TOKEN_EXPIRY_MINUTES}m` });
        const expiresAt = new Date(Date.now() + QUOTE_TOKEN_EXPIRY_MINUTES * 60 * 1000);

        res.status(200).json({
            quote_token: quoteToken,
            expires_at: expiresAt.toISOString(),
            shipping_options: finalShippingOptions,
            print_cost_usd: luluPrintCostUSD,
            base_product_price_usd: baseProductPriceUSD,
            currency: 'USD'
        });

    } catch (error) {
        console.error(`[Shipping Quotes FATAL] ${error.message}`, { stack: error.stack });
        return res.status(500).json({ message: "An internal error occurred while retrieving shipping quotes." });
    } finally {
        if (client) client.release();
        if (tempInteriorPdfPath) {
            try { await fs.unlink(tempInteriorPdfPath); } catch (e) { console.error(`[Cleanup] Error deleting temp PDF: ${e.message}`); }
        }
    }
};