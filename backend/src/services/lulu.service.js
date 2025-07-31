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

export const getCoverDimensionsMm = (luluProductId, pageCount) => {
    const productInfo = PRODUCTS_TO_OFFER.find(p => p.id === luluProductId);
    if (!productInfo) {
        throw new Error(`Product with ID ${luluProductId} not found for cover dimensions.`);
    }

    // --- FIX START: Declare variables here ---
    let coverWidthMm, coverHeightMm, targetPdfkitLayout;
    // --- FIX END ---

    let targetLuluWidthMm, targetLuluHeightMm; // These are intermediate values for clarity

    switch (luluProductId) {
        case '0550X0850BWSTDCW060UC444GXX': // Novella (5.5 x 8.5" book size)
            targetLuluWidthMm = (328.61 + 331.79) / 2; // ~330.20mm
            targetLuluHeightMm = (258.76 + 261.94) / 2; // ~260.35mm

            coverWidthMm = targetLuluHeightMm; // This becomes PDFKit's width (smaller)
            coverHeightMm = targetLuluWidthMm; // This becomes PDFKit's height (larger)
            targetPdfkitLayout = 'portrait'; // Because PDFKit's height is now > width
            break;
        case '0827X1169BWPRELW060UC444GNG': // A4 Story Book
        case '0614X0921BWPRELW060UC444GNG': // Royal Hardcover
            const spineWidth = getHardcoverSpineWidthMm(pageCount);
            let trimWidth, trimHeight;
            if (luluProductId === '0827X1169BWPRELW060UC444GNG') { trimWidth = 210; trimHeight = 297; }
            else { trimWidth = 156; trimHeight = 234; }

            const outerBleedMm = 3.175; // 0.125 inches
            const hardcoverHingeMm = 19.05; // 0.75 inches
            const hardcoverTurnInMm = 15.875; // 0.625 inches

            targetLuluWidthMm = (2 * trimWidth) + spineWidth + (2 * outerBleedMm) + (2 * hardcoverHingeMm) + (2 * hardcoverTurnInMm);
            targetLuluHeightMm = trimHeight + (2 * outerBleedMm) + (2 * hardcoverTurnInMm);

            coverWidthMm = targetLuluHeightMm; // PDFKit width
            coverHeightMm = targetLuluWidthMm; // PDFKit height
            targetPdfkitLayout = 'portrait';
            break;
        case '0827X1169FCPRELW080CW444MNG': // A4 Premium Picture Book (landscape)
            const spineWidthPicture = getHardcoverSpineWidthMm(pageCount);
            const trimWidthPicture = 297; // Landscape trim width
            const trimHeightPicture = 210; // Landscape trim height

            targetLuluWidthMm = (2 * trimWidthPicture) + spineWidthPicture + (2 * outerBleedMm) + (2 * hardcoverHingeMm) + (2 * hardcoverTurnInMm);
            targetLuluHeightMm = trimHeightPicture + (2 * outerBleedMm) + (2 * hardcoverTurnInMm);

            coverWidthMm = targetLuluHeightMm; // PDFKit width
            coverHeightMm = targetLuluWidthMm; // PDFKit height
            targetPdfkitLayout = 'portrait';
            break;
        default:
            throw new Error(`Unknown product ID ${luluProductId} for cover dimensions calculation.`);
    }

    console.log(`DEBUG: For ${luluProductId} (Pages: ${pageCount}) -> Lulu EXPECTS ${targetLuluWidthMm.toFixed(2)}x${targetLuluHeightMm.toFixed(2)}mm (Landscape). Generating PDFKit as ${coverWidthMm.toFixed(2)}x${coverHeightMm.toFixed(2)}mm (Portrait).`);

    return {
        width: coverWidthMm,
        height: coverHeightMm,
        layout: targetPdfkitLayout
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