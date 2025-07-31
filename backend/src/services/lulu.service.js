// backend/src/services/lulu.service.js
import fetch from 'node-fetch';
import { Buffer } from 'buffer';

const LULU_API_URL = 'https://api.sandbox.lulu.com';

export const PRODUCTS_TO_OFFER = [
    { id: '0550X0850BWSTDCW060UC444GXX', name: 'Novella', description: 'A short & sweet 24-page hardcover story.', pageCount: 24, icon: '📖', type: 'novel', pagesPerChapter: 4, wordsPerPage: 300 },
    { id: '0827X1169BWPRELW060UC444GNG', name: 'A4 Story Book', description: 'A classic 48-page A4 text-based hardcover book.', pageCount: 48, icon: '📚', type: 'novel', pagesPerChapter: 4, wordsPerPage: 300 },
    { id: '0614X0921BWPRELW060UC444GNG', name: 'Royal Hardcover', description: 'An epic 80-page premium hardcover novel.', pageCount: 80, icon: '📕', type: 'novel', pagesPerChapter: 4, wordsPerPage: 300 },
    { id: '0827X1169FCPRELW080CW444MNG', name: 'A4 Premium Picture Book', description: 'A beautiful, full-color 24-page illustrated hardcover.', pageCount: 24, icon: '🎨', type: 'picturebook' }
];

export const getPrintOptions = async () => {
    const pricedProducts = PRODUCTS_TO_OFFER.map(product => {
        if (product.type === 'picturebook') return { ...product, price: 69.99 };
        if (product.type === 'novel') {
            const novellaPageCount = 24;
            const novellaPrice = 39.99;
            const pricePerNovellaPage = novellaPrice / novellaPageCount;
            const calculatedPrice = product.pageCount * pricePerNovellaPage;
            return { ...product, price: parseFloat(calculatedPrice.toFixed(2)) };
        }
        return product;
    });
    return pricedProducts;
};


const getLuluAuthToken = async () => {
    const clientKey = process.env.LULU_CLIENT_KEY;
    const clientSecret = process.env.LULU_CLIENT_SECRET;
    if (!clientKey || !clientSecret) throw new Error('Lulu API credentials are not configured in .env file.');
    
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


export const createLuluPrintJob = async (orderDetails, shippingInfo) => {
    const accessToken = await getLuluAuthToken();
    const printJobUrl = `${LULU_API_URL}/print-jobs/`;

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
            title: orderDetails.product_name,
            quantity: 1,
            // CORRECTED: Moved pod_package_id INSIDE printable_normalization
            printable_normalization: {
                pod_package_id: orderDetails.lulu_product_id,
                cover: { source_url: orderDetails.cover_pdf_url },
                interior: { source_url: orderDetails.interior_pdf_url }
            }
        }],
    };

    const response = await fetch(printJobUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Lulu Print Job Raw Error Text:", errorText);
        throw new Error('Failed to create Lulu print job.');
    }

    const data = await response.json();
    console.log("✅ Successfully created Lulu print job:", data.id);
    return data;
};