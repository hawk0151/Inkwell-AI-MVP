// backend/src/services/lulu.service.js

import axios from 'axios';
import querystring from 'querystring';

export const LULU_PRODUCT_CONFIGURATIONS = [
    {
        id: 'NOVBOOK_BW_5.5x8.5', // A logical ID for our internal configuration/template
        name: 'Novella (5.5 x 8.5")',
        type: 'textBook',
        basePrice: 5.00,
        luluType: 'PAPERBACK_PERFECT_BOUND',
        trimSize: '5.5x8.5',
        skuOptions: [
            { pageRange: { min: 24, max: 48 }, sku: '0550X0850BWSTDCW060UC444GXX' },
            { pageRange: { min: 49, max: 72 }, sku: '0550X0850BWSTDCW070UC444GXX' },
            { pageRange: { min: 73, max: 96 }, sku: '0550X0850BWSTDCW090UC444GXX' },
            { pageRange: { min: 97, max: 120 }, sku: '0550X0850BWSTDCW120UC444GXX' },
        ]
    },
    {
        id: 'A4STORY_FC_8.27x11.69',
        name: 'A4 Story Book (8.27 x 11.69")',
        type: 'pictureBook',
        basePrice: 7.50,
        luluType: 'HARDBACK_CASEWRAP',
        trimSize: '8.27x11.69',
        skuOptions: [
            { pageRange: { min: 24, max: 48 }, sku: '0827X1169BWPRELW060UC444GNG' },
            { pageRange: { min: 49, max: 72 }, sku: '0827X1169BWPRELW070UC444GNG' },
        ]
    },
    {
        id: 'ROYAL_HARDCOVER_6.14x9.21',
        name: 'Royal Hardcover (6.14 x 9.21")',
        type: 'textBook',
        basePrice: 12.00,
        luluType: 'HARDBACK_CASEWRAP',
        trimSize: '6.14x9.21',
        skuOptions: [
            { pageRange: { min: 60, max: 120 }, sku: '0614X0921BWPRELW060UC444GNG' },
            { pageRange: { min: 121, max: 180 }, sku: '0614X0921BWPRELW120UC444GNG' },
        ]
    },
    {
        id: 'A4PREMIUM_FC_8.27x11.69',
        name: 'A4 Premium Picture Book (8.27 x 11.69")',
        type: 'pictureBook',
        basePrice: 15.00,
        luluType: 'HARDBACK_CASEWRAP',
        trimSize: '8.27x11.69',
        skuOptions: [
            { pageRange: { min: 24, max: 48 }, sku: '0827X1169FCPRELW080CW444MNG' },
            { pageRange: { min: 49, max: 72 }, sku: '0827X1169FCPRELW080CW444MNG' },
        ]
    }
];

export const getLuluSkuByConfigAndPageCount = (configId, actualPageCount) => {
    const productConfig = LULU_PRODUCT_CONFIGURATIONS.find(config => config.id === configId);

    if (!productConfig) {
        throw new Error(`Lulu product configuration with ID '${configId}' not found.`);
    }

    const matchingSkuOption = productConfig.skuOptions.find(option =>
        actualPageCount >= option.pageRange.min && actualPageCount <= option.pageRange.max
    );

    if (!matchingSkuOption) {
        const fallbackSku = productConfig.skuOptions
            .filter(option => actualPageCount <= option.pageRange.max)
            .sort((a, b) => a.pageRange.min - b.pageRange.min)
            [0];

        if (fallbackSku) {
            console.warn(`WARN: No exact SKU found for config '${configId}' with page count ${actualPageCount}. Falling back to SKU '${fallbackSku.sku}' (min: ${fallbackSku.pageRange.min}, max: ${fallbackSku.pageRange.max}).`);
            return fallbackSku.sku;
        }

        throw new Error(`No suitable Lulu SKU found for configuration '${configId}' with actual page count ${actualPageCount}. Please check page count ranges in LULU_PRODUCT_CONFIGURATIONS.`);
    }

    console.log(`DEBUG: Determined dynamic SKU '${matchingSkuOption.sku}' for config '${configId}' and page count ${actualPageCount}.`);
    return matchingSkuOption.sku;
};


export const getPrintOptions = () => {
    return LULU_PRODUCT_CONFIGURATIONS.map(config => ({
        id: config.id,
        name: config.name,
        type: config.type,
        price: config.basePrice,
        minPages: config.skuOptions[0].pageRange.min,
        maxPages: config.skuOptions[config.skuOptions.length - 1].pageRange.max,
        luluType: config.luluType
    }));
};

const LULU_CLIENT_ID = process.env.LULU_CLIENT_ID;
const LULU_CLIENT_SECRET = process.env.LULU_CLIENT_SECRET;
const LULU_API_BASE_URL = process.env.LULU_API_BASE_URL;

let accessToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
    if (accessToken && Date.now() < tokenExpiry) {
        return accessToken;
    }

    console.log('Fetching new Lulu access token...');
    console.log('DEBUG: Using Lulu API Base URL for auth:', LULU_API_BASE_URL);
    // --- NEW DEBUG LOGS ---
    console.log('DEBUG: LULU_CLIENT_ID being used:', LULU_CLIENT_ID);
    console.log('DEBUG: LULU_CLIENT_SECRET being used (first 5 chars):', LULU_CLIENT_SECRET ? LULU_CLIENT_SECRET.substring(0, 5) + '...' : 'NOT SET');
    // --- END NEW DEBUG LOGS ---

    try {
        const response = await axios.post(
            `${LULU_API_BASE_URL}/auth/realms/glasstree/protocol/openid-connect/token`,
            querystring.stringify({
                grant_type: 'client_credentials',
                client_id: LULU_CLIENT_ID,
                client_secret: LULU_CLIENT_SECRET,
                scope: 'lulu.print_jobs'
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        accessToken = response.data.access_token;
        tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 5000;
        console.log('Lulu access token obtained.');
        return accessToken;
    } catch (error) {
        console.error('Error fetching Lulu access token:', error.response ? error.response.data : error.message);
        throw new Error('Failed to obtain Lulu access token.');
    }
}

const coverDimensionsCache = new Map(); // Key: pod_package_id-page_count-unit

export async function getCoverDimensionsFromApi(pod_package_id, page_count, unit = 'mm') {
    const cacheKey = `${pod_package_id}-${page_count}-${unit}`;
    if (coverDimensionsCache.has(cacheKey)) {
        console.log(`G: Reusing cached cover dimensions for ${cacheKey}`);
        return coverDimensionsCache.get(cacheKey);
    }

    try {
        const token = await getAccessToken();
        const response = await axios.get(
            `${LULU_API_BASE_URL}/print-jobs/covers`,
            {
                params: {
                    pod_package_id: pod_package_id,
                    page_count: page_count,
                    unit: unit
                },
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        const dimensions = response.data;

        const layout = dimensions.width > dimensions.height ? 'landscape' : 'portrait';

        const result = {
            width: dimensions.width,
            height: dimensions.height,
            bleed: dimensions.bleed,
            page_count: dimensions.page_count,
            cover_type: dimensions.cover_type,
            layout: layout
        };

        coverDimensionsCache.set(cacheKey, result);
        return result;

    } catch (error) {
        console.error('Error getting cover dimensions from Lulu API:', error.response ? JSON.stringify(error.response.data) : error.message);
        throw new Error(`Failed to get cover dimensions for SKU ${pod_package_id} with ${page_count} pages.`);
    }
}

export async function createLuluPrintJob(pod_package_id, page_count, interior_pdf_url, cover_pdf_url, external_id, userId, shippingInfo) {
    try {
        const token = await getAccessToken();

        const payload = {
            external_id: external_id,
            interior_file: {
                url: interior_pdf_url
            },
            cover_file: {
                url: cover_pdf_url
            },
            print_job_metadata: {
                pod_package_id: pod_package_id,
                page_count: page_count,
            },
            shipping_address: {
                name: shippingInfo.name,
                street1: shippingInfo.street1,
                street2: shippingInfo.street2 || null,
                city: shippingInfo.city,
                state_code: shippingInfo.state_code,
                postcode: shippingInfo.postcode,
                country_code: shippingInfo.country_code,
            },
            contact_email: shippingInfo.email,
            shipping_level: 'MAIL_STANDARD',
        };

        const response = await axios.post(
            `${LULU_API_BASE_URL}/print-jobs/`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('Lulu Print Job created successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error creating Lulu Print Job:', error.response ? JSON.stringify(error.response.data) : error.message);
        throw new Error('Failed to create Lulu Print Job.');
    }
}