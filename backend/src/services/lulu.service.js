import fetch from 'node-fetch';
import { Buffer } from 'buffer';

const LULU_API_URL = 'https://api.sandbox.lulu.com';

export const PRODUCTS_TO_OFFER = [
    { id: '0550X0850BWSTDCW060UC444GXX', name: 'Novella', description: 'A short & sweet 24-page hardcover story.', pageCount: 24, icon: '📖', type: 'novel', pagesPerChapter: 4, wordsPerPage: 300, binding: 'hardcover' },
    { id: '0827X1169BWPRELW060UC444GNG', name: 'A4 Story Book', description: 'A classic 48-page A4 text-based hardcover book.', pageCount: 48, icon: '📚', type: 'novel', pagesPerChapter: 4, wordsPerPage: 300, binding: 'hardcover' },
    { id: '0614X0921BWPRELW060UC444GNG', name: 'Royal Hardcover', description: 'An epic 80-page premium hardcover novel.', pageCount: 80, icon: '📕', type: 'novel', pagesPerChapter: 4, wordsPerPage: 300, binding: 'hardcover' },
    { id: '0827X1169FCPRELW080CW444MNG', name: 'A4 Premium Picture Book', description: 'A beautiful, full-color 24-page illustrated hardcover.', pageCount: 24, icon: '🎨', type: 'picturebook', binding: 'hardcover' }
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

// Helper function to convert inches to millimeters
const inchesToMm = (inches) => inches * 25.4;

// Helper function to convert millimeters to inches
const mmToInches = (mm) => mm / 25.4;

// --- NEW: Function to get Hardcover Spine Width in mm ---
export const getHardcoverSpineWidthMm = (pageCount) => {
    if (pageCount < 24) return 0; // Hardcover minimum is 24 pages
    if (pageCount <= 84) return 6; // 0.25 in
    if (pageCount <= 140) return 13; // 0.5 in
    if (pageCount <= 168) return 16; // 0.625 in
    if (pageCount <= 194) return 17; // 0.688 in
    if (pageCount <= 222) return 19; // 0.75 in
    if (pageCount <= 250) return 21; // 0.813 in
    if (pageCount <= 278) return 22; // 0.875 in
    if (pageCount <= 306) return 24; // 0.938 in
    if (pageCount <= 334) return 25; // 1 in
    if (pageCount <= 360) return 27; // 1.063 in
    if (pageCount <= 388) return 29; // 1.125 in
    if (pageCount <= 416) return 30; // 1.188 in
    if (pageCount <= 444) return 32; // 1.25 in
    if (pageCount <= 472) return 33; // 1.313 in
    if (pageCount <= 500) return 35; // 1.375 in
    if (pageCount <= 528) return 37; // 1.438 in
    if (pageCount <= 556) return 38; // 1.5 in
    if (pageCount <= 582) return 40; // 1.563 in
    if (pageCount <= 610) return 41; // 1.625 in
    if (pageCount <= 638) return 43; // 1.688 in
    if (pageCount <= 666) return 44; // 1.75 in
    if (pageCount <= 694) return 46; // 1.813 in
    if (pageCount <= 722) return 48; // 1.875 in
    if (pageCount <= 750) return 49; // 1.938 in
    if (pageCount <= 778) return 51; // 2 in
    if (pageCount <= 799) return 52; // 2.063 in
    if (pageCount === 800) return 54; // 2.125 in

    console.warn(`[Lulu Service] Page count ${pageCount} outside standard hardcover spine calculation range.`);
    return 54;
};

// --- MODIFIED: Function to get full cover spread dimensions in MM ---
export const getCoverDimensionsMm = (luluProductId, pageCount) => {
    const productInfo = PRODUCTS_TO_OFFER.find(p => p.id === luluProductId);
    if (!productInfo) {
        throw new Error(`Product with ID ${luluProductId} not found for cover dimensions.`);
    }

    let coverWidthMm, coverHeightMm, layout;

    // --- TEMPORARY FIX: Hardcode exact dimensions for Novella as per Lulu's rejection message ---
    if (luluProductId === '0550X0850BWSTDCW060UC444GXX') {
        coverWidthMm = (328.61 + 331.79) / 2; // Midpoint of required range
        coverHeightMm = (258.76 + 261.94) / 2; // Midpoint of required range
        layout = 'landscape';
        console.log(`DEBUG: Using HARDCODED cover dimensions for ${luluProductId}: ${coverWidthMm.toFixed(2)}x${coverHeightMm.toFixed(2)}mm`);
        return { width: coverWidthMm, height: coverHeightMm, layout: layout };
    }
    // --- END TEMPORARY FIX ---

    // This section will be used for other products, or if the temporary fix doesn't work, we'll refine this.

    // Get interior trim dimensions
    let trimWidthMm, trimHeightMm;
    switch (luluProductId) {
        case '0550X0850BWSTDCW060UC444GXX': // Novella
            trimWidthMm = 139.7; // 5.5 inches (using interior trim for reference)
            trimHeightMm = 215.9; // 8.5 inches
            break;
        case '0827X1169BWPRELW060UC444GNG': // A4 Story Book
            trimWidthMm = 209.55;
            trimHeightMm = 296.9;
            break;
        case '0614X0921BWPRELW060UC444GNG': // Royal Hardcover
            trimWidthMm = 156;
            trimHeightMm = 234;
            break;
        case '0827X1169FCPRELW080CW444MNG': // A4 Premium Picture Book (landscape)
            trimWidthMm = 296.9; // height of A4 portrait
            trimHeightMm = 209.55; // width of A4 portrait
            break;
        default:
            throw new Error(`Unknown product ID ${luluProductId} for cover trim dimensions calculation.`);
    }

    const spineWidthMm = getHardcoverSpineWidthMm(pageCount);
    const outerBleedMm = 3.175; // 0.125 inches
    const hardcoverHingeMm = 19.05; // 0.75 inches
    const hardcoverTurnInMm = 15.875; // 0.625 inches

    coverWidthMm = (2 * trimWidthMm) + spineWidthMm + (2 * outerBleedMm) + (2 * hardcoverHingeMm) + (2 * hardcoverTurnInMm);
    coverHeightMm = trimHeightMm + (2 * outerBleedMm) + (2 * hardcoverTurnInMm);
    layout = (coverWidthMm > coverHeightMm) ? 'landscape' : 'portrait';

    console.log(`DEBUG: Calculated Cover for product ${luluProductId} (Pages: ${pageCount}) -> Spine: ${spineWidthMm.toFixed(2)}mm. Calculated Cover Dimensions in MM: ${coverWidthMm.toFixed(2)}x${coverHeightMm.toFixed(2)}`);

    return {
        width: coverWidthMm,
        height: coverHeightMm,
        layout: layout
    };
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