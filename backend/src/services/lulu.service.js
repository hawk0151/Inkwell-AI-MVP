// backend/src/services/lulu.service.js
import fetch from 'node-fetch';
import { Buffer } from 'buffer';

const LULU_API_URL = 'https://api.sandbox.lulu.com';

// MODIFIED: Export PRODUCTS_TO_OFFER
export const PRODUCTS_TO_OFFER = [
    // --- TEXT-ONLY BOOKS ---
    {
        id: '0550X0850BWSTDCW060UC444GXX',
        name: 'Novella',
        description: 'A short & sweet 24-page hardcover story.',
        pageCount: 24,
        icon: '📖',
        type: 'novel',
        pagesPerChapter: 4, // NEW: Define pages per AI generation (chapter)
        wordsPerPage: 300   // NEW: Define target words per printed page
    },
    {
        id: '0827X1169BWPRELW060UC444GNG',
        name: 'A4 Story Book',
        description: 'A classic 48-page A4 text-based hardcover book.',
        pageCount: 48,
        icon: '📚',
        type: 'novel',
        pagesPerChapter: 4, // NEW: Define pages per AI generation
        wordsPerPage: 300   // NEW: Define target words per printed page
    },
    {
        id: '0614X0921BWPRELW060UC444GNG',
        name: 'Royal Hardcover',
        description: 'An epic 80-page premium hardcover novel.',
        pageCount: 80,
        icon: '📕',
        type: 'novel',
        pagesPerChapter: 4, // NEW: Define pages per AI generation (80 pages / 4 pages/gen = 20 generations)
        wordsPerPage: 300   // NEW: Define target words per printed page
    },
    // --- PICTURE BOOK (unchanged) ---
    {
        id: '0827X1169FCPRELW080CW444MNG',
        name: 'A4 Premium Picture Book',
        description: 'A beautiful, full-color 24-page illustrated hardcover.',
        pageCount: 24,
        icon: '🎨',
        type: 'picturebook'
    }
];

// This function now contains your custom pricing logic
export const getPrintOptions = async () => {
    console.log("Fetching print options with custom pricing...");
    const pricedProducts = PRODUCTS_TO_OFFER.map(product => {
        if (product.type === 'picturebook') {
            // Rule 1: Picture book has a fixed price
            return { ...product, price: 69.99 };
        }

        if (product.type === 'novel') {
            // Rule 2: Text books are priced relative to the Novella
            const novellaPageCount = 24; // This is a specific product's page count
            const novellaPrice = 39.99;
            const pricePerNovellaPage = novellaPrice / novellaPageCount;

            const calculatedPrice = product.pageCount * pricePerNovellaPage;
            // Ensure `price` is formatted correctly, as before.
            return { ...product, price: parseFloat(calculatedPrice.toFixed(2)) };
        }
        return product; // Fallback
    });

    return pricedProducts;
};

// --- Helper functions for Lulu API communication (unchanged) ---

const DUMMY_SHIPPING_ADDRESS = {
    street1: "123 Main St", city: "Raleigh", postcode: "27601",
    country_code: "US", state_code: "NC", phone_number: "555-555-5555"
};

const getLuluAuthToken = async () => {
    const clientKey = process.env.LULU_CLIENT_KEY;
    const clientSecret = process.env.LULU_CLIENT_SECRET;
    if (!clientKey || !clientSecret) {
        throw new Error('Lulu API credentials are not configured in .env file.');
    }
    const authUrl = `${LULU_API_URL}/auth/realms/glasstree/protocol/openid-connect/token`;
    const basicAuth = Buffer.from(`${clientKey}:${clientSecret}`).toString('base64');

    const response = await fetch(authUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basicAuth}` },
        body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[LULU_ERROR] Failed to get auth token. Status: ${response.status}. Body: ${errorBody}`);
        throw new Error('Failed to authenticate with Lulu API.');
    }
    const data = await response.json();
    return data.access_token;
};

// Note: This function is now only used for internal cost calculation if needed, not for display price.
const fetchProductCost = async (accessToken, podPackageId, pageCount) => {
    const costUrl = `${LULU_API_URL}/print-job-cost-calculations/`;
    const payload = {
        shipping_address: DUMMY_SHIPPING_ADDRESS,
        shipping_option: "MAIL",
        line_items: [{ pod_package_id: podPackageId, page_count: pageCount, quantity: 1 }]
    };

    const response = await fetch(costUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        return null;
    }
    const data = await response.json();
    return parseFloat(data.total_cost_incl_tax);
};

export const createLuluPrintJob = async (orderDetails, shippingInfo) => {
    const accessToken = await getLuluAuthToken();
    const printJobUrl = `${LULU_API_URL}/print-jobs/`;

    const payload = {
        contact_email: shippingInfo.email, // Use customer's email
        external_id: `inkwell-order-${orderDetails.id}`,
        line_items: [{
            title: orderDetails.product_name,
            quantity: 1,
            pod_package_id: orderDetails.lulu_product_id,
            printable_normalization: {
                cover: { source_url: orderDetails.cover_pdf_url },
                interior: { source_url: orderDetails.interior_pdf_url }
            }
        }],
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
        shipping_level: "MAIL" // Or other levels like "GROUND", "PRIORITY"
    };

    const response = await fetch(printJobUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorBody = await response.json();
        console.error("Lulu Print Job Error:", errorBody);
        throw new Error('Failed to create Lulu print job.');
    }

    const data = await response.json();
    console.log("Successfully created Lulu print job:", data.id);
    return data;
};