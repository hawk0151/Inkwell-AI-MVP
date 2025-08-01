// backend/src/services/lulu.service.js

import axios from 'axios';
import { Buffer } from 'buffer';

export const LULU_PRODUCT_CONFIGURATIONS = [
    { 
        id: 'NOVBOOK_BW_5.5x8.5',
        luluSku: '0550X0850BWSTDCW060UC444GXX',
        name: 'Novella (5.5 x 8.5")', 
        type: 'textBook',
        trimSize: '5.5x8.5'
    },
    { 
        id: 'A4STORY_FC_8.27x11.69',
        luluSku: '0827X1169BWPRELW060UC444GNG',
        name: 'A4 Story Book (8.27 x 11.69")',
        type: 'pictureBook',
        trimSize: '8.27x11.69'
    },
    { 
        id: 'ROYAL_HARDCOVER_6.14x9.21',
        luluSku: '0614X0921BWPRELW060UC444GNG',
        name: 'Royal Hardcover (6.14 x 9.21")',
        type: 'textBook',
        trimSize: '6.14x9.21'
    },
    { 
        id: 'A4PREMIUM_FC_8.27x11.69',
        luluSku: '0827X1169FCPRELW080CW444MNG',
        name: 'A4 Premium Picture Book (8.27 x 11.69")',
        type: 'pictureBook',
        trimSize: '8.27x11.69'
    }
];

export const getPrintOptions = () => {
    return LULU_PRODUCT_CONFIGURATIONS.map(p => ({ id: p.id, name: p.name, type: p.type }));
};

let accessToken = null;
let tokenExpiry = 0;

async function getLuluAuthToken() {
    if (accessToken && Date.now() < tokenExpiry) {
        return accessToken;
    }
    console.log('Fetching new Lulu access token (Legacy Method)...');
    
    const clientKey = process.env.LULU_CLIENT_ID;
    const clientSecret = process.env.LULU_CLIENT_SECRET;
    if (!clientKey || !clientSecret) throw new Error('Lulu API credentials are not configured.');

    const authUrl = `${process.env.LULU_API_BASE_URL}/auth/realms/glasstree/protocol/openid-connect/token`;
    const basicAuth = Buffer.from(`${clientKey}:${clientSecret}`).toString('base64');

    try {
        const response = await axios.post(
            authUrl,
            'grant_type=client_credentials',
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${basicAuth}`
                }
            }
        );
        accessToken = response.data.access_token;
        tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 5000;
        console.log('Lulu access token obtained (Legacy Method).');
        return accessToken;
    } catch (error) {
        console.error('Error fetching Lulu access token (Legacy Method):', error.response ? error.response.data : error.message);
        throw new Error('Failed to authenticate with Lulu API.');
    }
}

const coverDimensionsCache = new Map();

export async function getCoverDimensionsFromApi(podPackageId, pageCount, unit = 'mm') {
    const cacheKey = `${podPackageId}-${pageCount}-${unit}`;
    if (coverDimensionsCache.has(cacheKey)) {
        console.log(`Reusing cached cover dimensions for ${cacheKey}`);
        return coverDimensionsCache.get(cacheKey);
    }

    try {
        const token = await getLuluAuthToken();
        const response = await axios.post(
            `${process.env.LULU_API_BASE_URL}/cover-templates/`, 
            {
                pod_package_id: podPackageId,
                page_count: pageCount
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            }
        );

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
        console.error('Error getting cover dimensions from Lulu API (Legacy):', error.response ? JSON.stringify(error.response.data) : error.message);
        throw new Error(`Failed to get cover dimensions for SKU ${podPackageId} with ${pageCount} pages.`);
    }
}

// --- FIXED: Restored the createLuluPrintJob function ---
export const createLuluPrintJob = async (orderDetails, shippingInfo) => {
    try {
        const accessToken = await getLuluAuthToken();
        const printJobUrl = `${process.env.LULU_API_BASE_URL}/print-jobs/`;

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
        
        console.log("DEBUG: Submitting print job to Lulu with payload:", JSON.stringify(payload, null, 2));

        const response = await axios.post(printJobUrl, payload, {
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${accessToken}` 
            },
            timeout: 60000 // 60 second timeout
        });

        console.log("✅ Successfully created Lulu print job:", response.data.id);
        return response.data;
    } catch (error) {
        console.error("❌ Error creating Lulu Print Job:", error.response ? JSON.stringify(error.response.data) : error.message);
        throw new Error('Failed to create Lulu Print Job.');
    }
};