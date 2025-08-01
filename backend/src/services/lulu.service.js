// backend/src/services/lulu.service.js

import axios from 'axios';
import { Buffer } from 'buffer';
import dns from 'dns/promises';

export const LULU_PRODUCT_CONFIGURATIONS = [
    {
        id: 'NOVBOOK_BW_5.5x8.5',
        luluSku: '0550X0850BWSTDCW060UC444GXX',
        name: 'Novella (5.5 x 8.5")',
        type: 'textBook',
        trimSize: '5.5x8.5',
        basePrice: 5.0
    },
    {
        id: 'A4STORY_FC_8.27x11.69',
        luluSku: '0827X1169BWPRELW060UC444GNG',
        name: 'A4 Story Book (8.27 x 11.69")',
        type: 'pictureBook',
        trimSize: '8.27x11.69',
        basePrice: 7.5
    },
    {
        id: 'ROYAL_HARDCOVER_6.14x9.21',
        luluSku: '0614X0921BWPRELW060UC444GNG',
        name: 'Royal Hardcover (6.14 x 9.21")',
        type: 'textBook',
        trimSize: '6.14x9.21',
        basePrice: 12.0
    },
    {
        id: 'A4PREMIUM_FC_8.27x11.69',
        luluSku: '0827X1169FCPRELW080CW444MNG',
        name: 'A4 Premium Picture Book (8.27 x 11.69")',
        type: 'pictureBook',
        trimSize: '8.27x11.69',
        basePrice: 15.0
    }
];

export const getPrintOptions = () => {
    return LULU_PRODUCT_CONFIGURATIONS.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type,
        price: p.basePrice
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
        return;
    } catch (err) {
        throw new Error(`DNS resolution failed for Lulu host in URL "${url}": ${err.message}`);
    }
}

async function getLuluAuthToken() {
    if (accessToken && Date.now() < tokenExpiry) {
        return accessToken;
    }

    console.log('Fetching new Lulu access token (Legacy Method)...');

    const clientKey = process.env.LULU_CLIENT_ID;
    const clientSecret = process.env.LULU_CLIENT_SECRET;
    if (!clientKey || !clientSecret) {
        throw new Error('Lulu API credentials are not configured.');
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
        console.log('Lulu access token obtained (Legacy Method).');
        return accessToken;
    } catch (error) {
        if (error.message && error.message.includes('DNS resolution failed')) {
            console.error('Network/DNS error while fetching Lulu token:', error.message);
            throw new Error('Network/DNS error fetching Lulu auth token.');
        }

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

const coverDimensionsCache = new Map();

export async function getCoverDimensionsFromApi(podPackageId, pageCount) {
    const cacheKey = `${podPackageId}-${pageCount}-mm`;
    if (coverDimensionsCache.has(cacheKey)) {
        console.log(`Reusing cached cover dimensions for ${cacheKey}`);
        return coverDimensionsCache.get(cacheKey);
    }

    const baseUrl = process.env.LULU_API_BASE_URL;
    if (!baseUrl) {
        throw new Error('LULU_API_BASE_URL is not configured.');
    }

    const endpoint = `${baseUrl.replace(/\/$/, '')}/cover-templates/`;

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
                {
                    pod_package_id: podPackageId,
                    page_count: pageCount
                },
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
        const layout = dimensions.pdf_width_mm > dimensions.pdf_height_mm ? 'landscape' : 'portrait';

        const result = {
            width: dimensions.pdf_width_mm,
            height: dimensions.pdf_height_mm,
            layout: layout
        };

        coverDimensionsCache.set(cacheKey, result);
        return result;
    } catch (error) {
        console.error('Error getting cover dimensions from Lulu API (Legacy):',
            error.response ? JSON.stringify(error.response.data) : error.message);
        throw new Error(`Failed to get cover dimensions for SKU ${podPackageId} with ${pageCount} pages.`);
    }
}

export const createLuluPrintJob = async (orderDetails, shippingInfo) => {
    try {
        const token = await getLuluAuthToken();

        const baseUrl = process.env.LULU_API_BASE_URL;
        if (!baseUrl) {
            throw new Error('LULU_API_BASE_URL is not configured.');
        }

        const printJobUrl = `${baseUrl.replace(/\/$/, '')}/print-jobs/`;

        try {
            await ensureHostnameResolvable(printJobUrl);
        } catch (dnsErr) {
            console.error('DNS resolution issue before creating print job:', dnsErr.message);
            throw new Error(`Network/DNS error when trying to reach Lulu for print job: ${dnsErr.message}`);
        }

        const payload = {
            contact_email: shippingInfo.email,
            external_id: `inkwell-order-${orderDetails.id}`,
            shipping_level: "MAIL",
            shipping_address: {
                name: shippingInfo.name,
                street1: shippingInfo.street1,
                city: shippingInfo.city,
                postcode: shippingInfo.postcode,
                country_code: shippingInfo.country_code,
                state_code: shippingInfo.state_code,
                phone_number: shippingInfo.phone_number,
                email: shippingInfo.email
            },
            line_items: [{
                title: orderDetails.book_title,
                quantity: 1,
                pod_package_id: orderDetails.lulu_product_id,
                cover: {
                    source_url: orderDetails.cover_pdf_url
                },
                interior: {
                    source_url: orderDetails.interior_pdf_url
                }
            }],
        };

        console.log("DEBUG: Submitting print job to Lulu...");

        const response = await retryWithBackoff(async () => {
            return await axios.post(printJobUrl, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                timeout: 60000
            });
        }, 3, 500);

        console.log("✅ Successfully created Lulu print job:", response.data.id);
        return response.data;
    } catch (error) {
        if (error.response) {
            console.error("❌ Error creating Lulu Print Job (API response):", {
                status: error.response.status,
                data: error.response.data
            });
        } else {
            console.error("❌ Error creating Lulu Print Job (network/unknown):", error.message);
        }
        throw new Error('Failed to create Lulu Print Job.');
    }
};