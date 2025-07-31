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

const inchesToMm = (inches) => inches * 25.4;
const mmToInches = (mm) => mm / 25.4;

export const getHardcoverSpineWidthMm = (pageCount) => {
    if (pageCount < 24) return 0;
    if (pageCount <= 84) return 6;
    if (pageCount <= 140) return 13;
    if (pageCount <= 168) return 16;
    if (pageCount <= 194) return 17;
    if (pageCount <= 222) return 19;
    if (pageCount <= 250) return 21;
    if (pageCount <= 278) return 22;
    if (pageCount <= 306) return 24;
    if (pageCount <= 334) return 25;
    if (pageCount <= 360) return 27;
    if (pageCount <= 388) return 29;
    if (pageCount <= 416) return 30;
    if (pageCount <= 444) return 32;
    if (pageCount <= 472) return 33;
    if (pageCount <= 500) return 35;
    if (pageCount <= 528) return 37;
    if (pageCount <= 556) return 38;
    if (pageCount <= 582) return 40;
    if (pageCount <= 610) return 41;
    if (pageCount <= 638) return 43;
    if (pageCount <= 666) return 44;
    if (pageCount <= 694) return 46;
    if (pageCount <= 722) return 48;
    if (pageCount <= 750) return 49;
    if (pageCount <= 778) return 51;
    if (pageCount <= 799) return 52;
    if (pageCount === 800) return 54;

    console.warn(`[Lulu Service] Page count ${pageCount} outside standard hardcover spine calculation range.`);
    return 54;
};

// --- MODIFIED: getCoverDimensionsMm to use explicit target ranges ---
export const getCoverDimensionsMm = (luluProductId, pageCount) => {
    const productInfo = PRODUCTS_TO_OFFER.find(p => p.id === luluProductId);
    if (!productInfo) {
        throw new Error(`Product with ID ${luluProductId} not found for cover dimensions.`);
    }

    let coverWidthMm, coverHeightMm, layout;

    // Use Lulu's *required* range to derive the precise dimensions for each product ID
    switch (luluProductId) {
        case '0550X0850BWSTDCW060UC444GXX': // Novella (5.5 x 8.5" book size)
            // Lulu's required range for this specific product's hardcover cover:
            // 12.938"-13.062" x 10.188"-10.312" (imperial)
            // 328.61mm-331.79mm x 258.76mm-261.94mm (metric)
            coverWidthMm = (328.61 + 331.79) / 2; // Midpoint
            coverHeightMm = (258.76 + 261.94) / 2; // Midpoint
            layout = 'landscape'; // The total cover spread is always landscape
            break;
        case '0827X1169BWPRELW060UC444GNG': // A4 Story Book (8.27 x 11.69" book size)
            // Need to find Lulu's exact cover template dimensions for A4 Hardcover (not just interior)
            // Or apply the general formula. Let's start with general, but be ready to hardcode if needed.
            // Trim: 210mm x 297mm
            // Assuming 24 pages for now, need spine. For 48 pages, spine is still 6mm.
            
            // General calculation for hardcovers: (2 * Trim Width) + Spine + (2 * Bleed) + (2 * Hinge) + (2 * Turn-in)
            // Height: Trim Height + (2 * Bleed) + (2 * Turn-in)
            const spineWidthA4 = getHardcoverSpineWidthMm(pageCount);
            const trimWidthA4 = 210; // A4 portrait width
            const trimHeightA4 = 297; // A4 portrait height
            const outerBleedMm = 3.175; // 0.125 inches
            const hardcoverHingeMm = 19.05; // 0.75 inches
            const hardcoverTurnInMm = 15.875; // 0.625 inches

            coverWidthMm = (2 * trimWidthA4) + spineWidthA4 + (2 * outerBleedMm) + (2 * hardcoverHingeMm) + (2 * hardcoverTurnInMm);
            coverHeightMm = trimHeightA4 + (2 * outerBleedMm) + (2 * hardcoverTurnInMm);
            layout = 'landscape';
            break;
        case '0614X0921BWPRELW060UC444GNG': // Royal Hardcover (6.14 x 9.21" book size)
            // Need to find Lulu's exact cover template dimensions for Royal Hardcover
            // Trim: 156mm x 234mm
            const spineWidthRoyal = getHardcoverSpineWidthMm(pageCount);
            const trimWidthRoyal = 156;
            const trimHeightRoyal = 234;
            // Common values for Royal Hardcover (adjust if Lulu template specifies otherwise)
            // Will use same general calculation as A4 if no explicit template data
            coverWidthMm = (2 * trimWidthRoyal) + spineWidthRoyal + (2 * outerBleedMm) + (2 * hardcoverHingeMm) + (2 * hardcoverTurnInMm);
            coverHeightMm = trimHeightRoyal + (2 * outerBleedMm) + (2 * hardcoverTurnInMm);
            layout = 'landscape';
            break;
        case '0827X1169FCPRELW080CW444MNG': // A4 Premium Picture Book (landscape)
            // This is a picture book, often with different cover type.
            // Trim: 297mm (width) x 210mm (height) (landscape trim)
            // Need to confirm if 'FCPRELW080CW444MNG' is also hardcover and uses same cover calculation.
            // Assuming it is hardcover for now.
            const spineWidthPicture = getHardcoverSpineWidthMm(pageCount); // Page count for picture book is 24, so spine is 6mm
            const trimWidthPicture = 297; // Landscape width is 297
            const trimHeightPicture = 210; // Landscape height is 210
            
            coverWidthMm = (2 * trimWidthPicture) + spineWidthPicture + (2 * outerBleedMm) + (2 * hardcoverHingeMm) + (2 * hardcoverTurnInMm);
            coverHeightMm = trimHeightPicture + (2 * outerBleedMm) + (2 * hardcoverTurnInMm);
            layout = 'landscape';
            break;
        default:
            throw new Error(`Unknown product ID ${luluProductId} for cover dimensions calculation.`);
    }

    console.log(`DEBUG: Final Cover Dimensions for ${luluProductId} (Pages: ${pageCount}) -> Spine: ${getHardcoverSpineWidthMm(pageCount).toFixed(2)}mm. Resulting Cover Dimensions in MM: ${coverWidthMm.toFixed(2)}x${coverHeightMm.toFixed(2)}. Layout: ${layout}`);

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