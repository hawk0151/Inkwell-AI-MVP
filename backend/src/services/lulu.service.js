import fetch from 'node-fetch';
import { Buffer } from 'buffer';

const LULU_API_URL = 'https://api.sandbox.lulu.com';

export const PRODUCTS_TO_OFFER = [
    { id: '0550X0850BWSTDCW060UC444GXX', name: 'Novella', description: 'A short & sweet 24-page hardcover story.', pageCount: 24, icon: '📖', type: 'novel', pagesPerChapter: 4, wordsPerPage: 300, binding: 'hardcover' }, // Added binding type
    { id: '0827X1169BWPRELW060UC444GNG', name: 'A4 Story Book', description: 'A classic 48-page A4 text-based hardcover book.', pageCount: 48, icon: '📚', type: 'novel', pagesPerChapter: 4, wordsPerPage: 300, binding: 'hardcover' }, // Added binding type
    { id: '0614X0921BWPRELW060UC444GNG', name: 'Royal Hardcover', description: 'An epic 80-page premium hardcover novel.', pageCount: 80, icon: '📕', type: 'novel', pagesPerChapter: 4, wordsPerPage: 300, binding: 'hardcover' }, // Added binding type
    { id: '0827X1169FCPRELW080CW444MNG', name: 'A4 Premium Picture Book', description: 'A beautiful, full-color 24-page illustrated hardcover.', pageCount: 24, icon: '🎨', type: 'picturebook', binding: 'hardcover' } // Added binding type
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

// --- NEW: Function to get Hardcover Spine Width in mm  ---
export const getHardcoverSpineWidthMm = (pageCount) => {
    // This table is derived from Lulu's "Hardcover Covers" table 
    if (pageCount < 24) return 0; // Hardcover minimum is 24 pages [cite: 223]
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
    if (pageCount <= 610) return 41; // 1.625 in [cite: 244]
    if (pageCount <= 638) return 43; // 1.688 in [cite: 244]
    if (pageCount <= 666) return 44; // 1.75 in [cite: 244]
    if (pageCount <= 694) return 46; // 1.813 in [cite: 244]
    if (pageCount <= 722) return 48; // 1.875 in [cite: 244]
    if (pageCount <= 750) return 49; // 1.938 in [cite: 244]
    if (pageCount <= 778) return 51; // 2 in [cite: 244]
    if (pageCount <= 799) return 52; // 2.063 in [cite: 244]
    if (pageCount === 800) return 54; // 2.125 in [cite: 244]
    
    // Fallback for very high page counts not in typical tables, or error
    console.warn(`[Lulu Service] Page count ${pageCount} outside standard hardcover spine calculation range.`);
    // You might need to extrapolate or define a maximum
    return 54; // Max known spine width from table
};

// --- NEW: Function to get full cover spread dimensions in MM ---
export const getCoverDimensionsMm = (luluProductId, pageCount) => {
    const bleed = 3.175; // 0.125 inches in mm [cite: 159, 545]
    // These are often referred to as "case wrap" or "turn-in" in Lulu's guides.
    // For standard hardcovers, a common turn-in is 15.875mm (0.625in) on all 4 edges
    // and an additional hinge area, often 19.05mm (0.75in) on each side of the spine.
    // This is where Lulu's templates are very specific.
    // Let's use a standard case wrap value that should cover most hardcovers, or be adjusted if specific templates differ
    const hardcoverCaseWrapX = 19.05 + 15.875; // Hinge + Turn-in per side for width
    const hardcoverCaseWrapY = 15.875 * 2; // Turn-in top/bottom

    const productInfo = PRODUCTS_TO_OFFER.find(p => p.id === luluProductId);
    if (!productInfo) {
        throw new Error(`Product with ID ${luluProductId} not found for cover dimensions.`);
    }

    // Get interior trim dimensions (which we already have in pdf.service.js, but let's make it available here)
    let trimWidthMm, trimHeightMm;
    switch (luluProductId) {
        case '0550X0850BWSTDCW060UC444GXX': // Novella [cite: 17]
            trimWidthMm = 127; // 5 inches
            trimHeightMm = 203; // 8 inches
            break;
        case '0827X1169BWPRELW060UC444GNG': // A4 Story Book [cite: 30]
            trimWidthMm = 210; // 8.27 inches
            trimHeightMm = 297; // 11.69 inches
            break;
        case '0614X0921BWPRELW060UC444GNG': // Royal Hardcover [cite: 42]
            trimWidthMm = 156; // 6.14 inches
            trimHeightMm = 234; // 9.21 inches
            break;
        case '0827X1169FCPRELW080CW444MNG': // A4 Premium Picture Book [cite: 30] (assuming it's landscape trim)
            // Note: For landscape cover, trimHeightMm becomes the "width" of the landscape page, and trimWidthMm becomes the "height"
            trimWidthMm = 297; // 11.69 inches
            trimHeightMm = 210; // 8.27 inches
            break;
        default:
            throw new Error(`Unknown product ID ${luluProductId} for cover trim dimensions.`);
    }

    const spineWidthMm = getHardcoverSpineWidthMm(pageCount);

    // Total width = Back Cover Trim + Bleed + Hinge + Spine Width + Hinge + Front Cover Trim + Bleed
    // Simplified: (Trim Width * 2) + Spine Width + (2 * bleed) + (2 * wrap around board from each side)
    // Lulu templates often combine bleed and wrap into a total "document size with bleed/wrap"
    // Let's use the provided template "TOTAL DOCUMENT SIZE (WITH BLEED)" and add the spine.

    // Re-calculating based on the previous error:
    // Lulu error suggested: 328.61mm-331.79mm x 258.76mm-261.94mm
    // This range is for a specific product.
    // The total cover dimensions are: (2 * trim_width) + spine_width + (2 * bleed) + (2 * wrap/hinge for hardcovers)

    let coverWidthMm, coverHeightMm;

    if (productInfo.binding === 'hardcover') {
        // Standard hardcover calculations from general Lulu guidelines (verify with specific product templates if issues persist)
        // Back Cover + Spine + Front Cover + Bleeds + Case Wraps (turn-in and hinge)
        // Typical hardcover turn-in: 0.625 inches (15.875 mm) top/bottom/sides of trim
        // Typical hardcover hinge: 0.75 inches (19.05 mm) on each side of spine
        
        // This is the source of the specific error range you received.
        // For a hardcover, the full spread is:
        // (2 * Trim Width) + Spine Width + (2 * Outer Bleed) + (2 * Hinge Area) + (2 * Turn-in Width)
        // Height is: Trim Height + (2 * Top/Bottom Bleed) + (2 * Turn-in Height)

        // Let's use a more direct calculation found on Lulu's template guides for hardcovers.
        // It's usually: (Trim Width * 2) + Spine Width + (2 * 0.125in bleed) + (2 * 0.75in hinge) + (2 * 0.625in turn-in)
        // Height: Trim Height + (2 * 0.125in bleed) + (2 * 0.625in turn-in)

        // Converting to MM for precision:
        const outerBleedMm = 3.175; // 0.125 inches [cite: 159, 545]
        const hardcoverHingeMm = 19.05; // 0.75 inches (common for hardcover hinge)
        const hardcoverTurnInMm = 15.875; // 0.625 inches (common for hardcover turn-in)

        coverWidthMm = (2 * trimWidthMm) + spineWidthMm + (2 * outerBleedMm) + (2 * hardcoverHingeMm) + (2 * hardcoverTurnInMm);
        coverHeightMm = trimHeightMm + (2 * outerBleedMm) + (2 * hardcoverTurnInMm);

    } else if (productInfo.binding === 'paperback') {
        // Paperback calculations
        // (2 * Trim Width) + Spine Width + (2 * Bleed)
        const outerBleedMm = 3.175;
        coverWidthMm = (2 * trimWidthMm) + spineWidthMm + (2 * outerBleedMm);
        coverHeightMm = trimHeightMm + (2 * outerBleedMm);
    } else {
        throw new Error(`Unsupported binding type: ${productInfo.binding} for cover dimensions.`);
    }


    console.log(`DEBUG: Cover for product ${luluProductId} (Pages: ${pageCount}) -> Spine: ${spineWidthMm.toFixed(2)}mm. Calculated Cover Dimensions in MM: ${coverWidthMm.toFixed(2)}x${coverHeightMm.toFixed(2)}`);

    return {
        width: coverWidthMm,
        height: coverHeightMm,
        layout: (coverWidthMm > coverHeightMm) ? 'landscape' : 'portrait' // Covers are usually landscape spread
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