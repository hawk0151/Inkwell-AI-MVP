import axios from 'axios';
import { Buffer } from 'buffer';
import dns from 'dns/promises';

export const LULU_PRODUCT_CONFIGURATIONS = [
    {
        id: 'NOVBOOK_BW_5.25x8.25',
        luluSku: '0500X0800BWSTDSS060UC444MXX',
        name: 'Novella (5.25 x 8.25" Paperback)',
        type: 'textBook',
        trimSize: '5.25x8.25',
        basePrice: 5.99,
        defaultPageCount: 40,
        defaultWordsPerPage: 250,
        totalChapters: 6,
        category: 'novel'
    },
    {
        id: 'A4NOVEL_PB_8.52x11.94',
        luluSku: '0827X1169BWSTDPB060UC444MXX',
        name: 'A4 Novel (8.52 x 11.94" Paperback)',
        type: 'textBook',
        trimSize: '8.52x11.94',
        basePrice: 15.99,
        defaultPageCount: 80,
        defaultWordsPerPage: 400,
        totalChapters: 8,
        category: 'novel'
    },
    {
        id: 'ROYAL_HARDCOVER_6.39x9.46',
        luluSku: '0614X0921BWSTDCW060UC444MXX',
        name: 'Royal Hardcover (6.39 x 9.46")',
        type: 'textBook',
        trimSize: '6.39x9.46',
        basePrice: 24.99,
        defaultPageCount: 100,
        defaultWordsPerPage: 300,
        totalChapters: 10,
        category: 'novel'
    },
    {
        id: 'A4PREMIUM_FC_8.27x11.69',
        luluSku: '0827X1169PFSTDPB080GC444MXX',
        name: 'A4 Premium Picture Book (8.27 x 11.69")',
        type: 'pictureBook',
        trimSize: '8.27x11.69',
        basePrice: 15.0,
        defaultPageCount: 40,
        defaultWordsPerPage: 120,
        totalChapters: 1,
        category: 'pictureBook'
    }
];

export const getPrintOptions = () => {
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

    console.log("DEBUG getPrintOptions: Options array being returned:", options);
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

// --- MODIFIED: Switched to the official Lulu authentication method ---
async function getLuluAuthToken() {
    if (accessToken && Date.now() < tokenExpiry) {
        return accessToken;
    }

    console.log('Fetching new Lulu access token (Official Method)...');

    const clientKey = process.env.LULU_CLIENT_KEY; // Using LULU_CLIENT_KEY
    const clientSecret = process.env.LULU_CLIENT_SECRET;
    if (!clientKey || !clientSecret) {
        throw new Error('Lulu API credentials (LULU_CLIENT_KEY, LULU_CLIENT_SECRET) are not configured.');
    }

    const authUrl = 'https://api.lulu.com/auth/realms/glassthompson/protocol/openid-connect/token';
    
    await ensureHostnameResolvable(authUrl);

    try {
        const response = await retryWithBackoff(async () => {
            return await axios.post(
                authUrl,
                new URLSearchParams({
                    'grant_type': 'client_credentials',
                    'client_key': clientKey,
                    'client_secret': clientSecret
                }),
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    timeout: 10000
                }
            );
        });

        accessToken = response.data.access_token;
        tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 5000;
        console.log('Lulu access token obtained (Official Method).');
        return accessToken;
    } catch (error) {
        console.error('Authentication error fetching Lulu token:', {
            status: error.response?.status,
            data: error.response?.data
        });
        throw new Error('Failed to authenticate with Lulu API using the official method.');
    }
}

const coverDimensionsCache = new Map();

export async function getCoverDimensionsFromApi(podPackageId, pageCount) {
    const cacheKey = `${podPackageId}-${pageCount}-mm`;
    if (coverDimensionsCache.has(cacheKey)) {
        console.log(`Reusing cached cover dimensions for ${cacheKey}`);
        return coverDimensionsCache.get(cacheKey);
    }

    const endpoint = 'https://api.lulu.com/cover-dimensions/';

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
                    interior_page_count: pageCount
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
        
        const ptToMm = (pt) => pt * (25.4 / 72);

        if (typeof dimensions.width === 'undefined' || typeof dimensions.height === 'undefined' || dimensions.unit !== 'pt') {
            console.error('Unexpected Lulu API response structure for cover dimensions:', JSON.stringify(dimensions, null, 2));
            throw new Error('Unexpected Lulu API response for cover dimensions. Missing expected fields (width, height) or unit is not "pt".');
        }

        const widthMm = ptToMm(parseFloat(dimensions.width));
        const heightMm = ptToMm(parseFloat(dimensions.height));
        let bleedMm = 3.175; 
        let spineThicknessMm = 0; 
        
        const result = {
            width: widthMm,
            height: heightMm,
            layout: widthMm > heightMm ? 'landscape' : 'portrait', 
            bleed: bleedMm, 
            spineThickness: spineThicknessMm 
        };

        coverDimensionsCache.set(cacheKey, result);
        return result;
    } catch (error) {
        console.error('Error getting cover dimensions from Lulu API (cover-dimensions endpoint):',
            error.response ? JSON.stringify(error.response.data) : error.message);
        throw new Error(`Failed to get cover dimensions for SKU ${podPackageId} with ${pageCount} pages. Lulu API error: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    }
}

export const getPrintJobCosts = async (lineItems, shippingAddress) => {
    const endpoint = `${process.env.LULU_API_BASE_URL.replace(/\/$/, '')}/print-job-cost-calculations/`;

    try {
        await ensureHostnameResolvable(endpoint);
        const token = await getLuluAuthToken();

        const payload = {
            line_items: lineItems,
            shipping_address: shippingAddress,
            shipping_level: "MAIL"
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
};

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