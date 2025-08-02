// backend/src/services/lulu.service.js

import axios from 'axios';
import { Buffer } from 'buffer';
import dns from 'dns/promises';

export const LULU_PRODUCT_CONFIGURATIONS = [
    {
        id: 'NOVBOOK_BW_5.5x8.5',
        luluSku: '0550X0850BWSTDPB060UC444GXX',
        name: 'Novella (5.75 x 8.75")',
        type: 'textBook',
        trimSize: '5.75x8.75',
        basePrice: 5.49
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

    // --- CRITICAL FIX START ---
    // Corrected endpoint for calculating cover dimensions as per Lulu's Node.js sample
    const endpoint = 'https://api.lulu.com/cover-dimensions/'; 
    // The previous incorrect endpoint was: 'https://api.lulu.com/print-jobs/cover-dimensions/';
    // --- CRITICAL FIX END ---

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
        // The response for 'cover-dimensions' returns properties directly at the root
        // Example response: { "width": "920.000", "height": "666.000", "unit": "pt" }
        // We'll convert 'pt' to 'mm' as our PDF generation uses mm.
        // Assuming spine_thickness_mm and bleed_mm are not directly in this response based on the sample.
        // If they are needed, we might need a separate call or a fixed value for now.

        // Convert points (pt) to millimeters (mm) - 1 point = 25.4/72 mm
        const ptToMm = (pt) => pt * (25.4 / 72);

        if (typeof dimensions.width === 'undefined' || typeof dimensions.height === 'undefined' || dimensions.unit !== 'pt') {
            console.error('Unexpected Lulu API response structure for cover dimensions:', JSON.stringify(dimensions, null, 2));
            throw new Error('Unexpected Lulu API response for cover dimensions. Missing expected fields (width, height) or unit is not "pt".');
        }

        const widthMm = ptToMm(parseFloat(dimensions.width));
        const heightMm = ptToMm(parseFloat(dimensions.height));
        // Lulu typically expects 3mm bleed for most covers, which is ~0.118 inches.
        // If not provided by API, a common default is 3.175mm (0.125 inches) for standard bleed.
        // For now, let's use a standard bleed. We need actual spine thickness.
        // This endpoint doesn't seem to provide spine thickness or bleed in the sample.
        // This might be provided by a different API, or calculated based on page count and paper type.
        // Given your previous rejection message, the full cover width needs to include spine.

        // Temporary hardcoded bleed and spine until we confirm Lulu's API provides them or calculate robustly.
        // These values need to be accurate for the specific POD Package ID.
        // For 0550X0850BWSTDPB060UC444GXX (Novella)
        let bleedMm = 3.175; // Standard 0.125 inch bleed
        let spineThicknessMm = 0; // Placeholder, needs calculation or specific API endpoint
        
        // This is a complex part. The 'cover-dimensions' endpoint gives us just the graphic size.
        // The *total* PDF cover size includes (Front Page + Spine + Back Page) + Bleed.
        // The spine thickness calculation based on pages and paper thickness is required.
        // For now, we'll try to use the direct width/height from this endpoint for the graphic
        // but understand we might need to add spine and bleed to THAT if this is just the 'graphic' area.
        
        // Let's revert to assuming these dimensions are the *total* canvas, as suggested by your rejection logs
        // which showed total PDF width/height including bleed.
        // But the previous rejection gave a *range* for the total width, and the sample response is fixed.
        // This is still a bit ambiguous in Lulu's docs.

        // Given the previous rejection details for 0550X0850BWSTDPB060UC444GXX, we had:
        // Expected PDF dimensions: 11.396"-11.521" x 8.688"-8.812"
        // Let's stick with the hardcoded values for that SKU as the *target* dimensions for the PDF generator,
        // and hope this new API call gives us more info for other SKUs or confirms our hardcodes.

        // For now, we will use the 'width' and 'height' from this API response for the *base graphic area*,
        // and assume bleed is added by the generateCoverPdf if it was configured.
        // It's crucial to understand if the 'width'/'height' includes bleed or not from this API.
        // Typically, print APIs give the *full* canvas size including bleed.

        // Let's stick to the previous hardcoded values for Novella, as they worked for acceptance.
        // The purpose of this API call is to make it dynamic for other books.
        // The example response (920pt x 666pt) seems quite large for a typical cover, suggesting it might be total canvas.
        
        // Let's refine the result to be clear it's the full canvas
        const result = {
            width: widthMm,
            height: heightMm,
            layout: widthMm > heightMm ? 'landscape' : 'portrait', // Determine layout from API response
            bleed: bleedMm, // Still a placeholder, needs actual data
            spineThickness: spineThicknessMm // Still a placeholder, needs actual data
        };

        coverDimensionsCache.set(cacheKey, result);
        return result;
    } catch (error) {
        console.error('Error getting cover dimensions from Lulu API (cover-dimensions endpoint):',
            error.response ? JSON.stringify(error.response.data) : error.message);
        throw new Error(`Failed to get cover dimensions for SKU ${podPackageId} with ${pageCount} pages. Lulu API error: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
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