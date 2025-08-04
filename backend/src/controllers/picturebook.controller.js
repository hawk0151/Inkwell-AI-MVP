// backend/src/controllers/picturebook.controller.js

// CHANGES:
// - Implemented full flat-rate shipping integration in createBookCheckoutSession, mirroring textbook logic.
// - Price calculation now includes Lulu print cost (AUD to USD conversion), flat-rate shipping (AUD to USD), and profit margin.
// - Detailed pricing is saved to 'orders' table.
// - Comprehensive console logging of pricing breakdown.
// - Added comprehensive input validation for shipping address (trimming, ISO country code validation, phone_number).
// - Uses getFlatShippingRate helper function (copied from textbook controller).
// - Enhanced error handling for Lulu's getPrintJobCosts and response structure.
// - Integrated two-pass PDF generation: generateAndSavePictureBookPdf for content, then finalizePdfPageCount for padding/evenness.
// - Corrected Lulu print cost extraction from 'line_item_costs[0].total_cost_incl_tax'.
// - Added isPageCountFallback tracking for database record.
// - MODIFIED: addTimelineEvent and getFullPictureBook now use 'story_text' and 'is_bold_story_text'
//   instead of 'description' for picture book pages.
// - FIXED: 'syntax error at or near " "' by re-typing SQL queries to remove hidden non-breaking spaces.
// --- NEW CHANGES FOR DYNAMIC SHIPPING ---
// - Added getPictureBookShippingOptions to fetch and return available Lulu shipping methods.
// - Modified createBookCheckoutSession to accept selectedShippingLevel and use dynamic shipping costs from Lulu.
// - Removed flat shipping rate logic.

import { getDb } from '../db/database.js';
import { randomUUID } from 'crypto';
import { generateAndSavePictureBookPdf, generateCoverPdf, finalizePdfPageCount } from '../services/pdf.service.js';
import { LULU_PRODUCT_CONFIGURATIONS, getPrintOptions, getCoverDimensionsFromApi, getPrintJobCosts } from '../services/lulu.service.js';
import { createStripeCheckoutSession } from '../services/stripe.service.js';
import { uploadPdfFileToCloudinary } from '../services/image.service.js';
import path from 'path';
import fs from 'fs/promises';

let AbortController;
if (typeof globalThis.AbortController === 'function') {
    AbortController = globalThis.AbortController;
} else {
    try {
        const NodeAbortController = require('node-abort-controller');
        AbortController = NodeAbortController.AbortController;
    } catch (e) {
        console.error("Critical: AbortController not available. Please ensure Node.js v15+ is used or 'node-abort-controller' is installed. Error:", e.message);
        throw new Error("AbortController is not available. Please install 'node-abort-controller' or use Node.js v15+.");
    }
}

const VALID_ISO_COUNTRY_CODES = new Set([
    'AF', 'AX', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AU', 'AT', 'AZ', 'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BQ', 'BA', 'BW', 'BR', 'IO', 'BN', 'BG', 'BF', 'BI', 'CV', 'KH', 'CM', 'CA', 'KY', 'CF', 'TD', 'CL', 'CN', 'CX', 'CC', 'CO', 'KM', 'CD', 'CG', 'CK', 'CR', 'CI', 'HR', 'CU', 'CW', 'CY', 'CZ', 'DK', 'DJ', 'DM', 'DO', 'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET', 'FK', 'FO', 'FJ', 'FI', 'FR', 'GF', 'PF', 'TF', 'GA', 'GM', 'GE', 'DE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY', 'HT', 'HM', 'VA', 'HN', 'HK', 'HU', 'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IM', 'IL', 'IT', 'JM', 'JP', 'JE', 'JO', 'KZ', 'KE', 'KI', 'KP', 'KR', 'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MO', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MS', 'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'NC', 'NZ', 'NI', 'NE', 'NG', 'NU', 'NF', 'MP', 'NO', 'OM', 'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PN', 'PL', 'PT', 'PR', 'QA', 'MK', 'RO', 'RU', 'RW', 'RE', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SX', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS', 'SS', 'ES', 'LK', 'SD', 'SR', 'SJ', 'SE', 'CH', 'SY', 'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TK', 'TO', 'TT', 'TN', 'TR', 'TM', 'TC', 'TV', 'UG', 'UA', 'AE', 'GB', 'US', 'UM', 'UY', 'UZ', 'VU', 'VE', 'VN', 'VG', 'VI', 'WF', 'EH', 'YE', 'ZM', 'ZW'
]);

const PROFIT_MARGIN_USD = 10.00; // Your desired profit margin per book

const AUD_TO_USD_EXCHANGE_RATE = 0.66; // Current conversion rate

// Removed getFlatShippingRate as we will use dynamic rates

async function getFullPictureBook(bookId, userId, client) {
    const bookResult = await client.query(`SELECT * FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
    const book = bookResult.rows[0];
    if (!book) return null;

    const eventsSql = `SELECT *, uploaded_image_url, overlay_text, story_text, is_bold_story_text FROM timeline_events WHERE book_id = $1 ORDER BY page_number ASC`;
    const timelineResult = await client.query(eventsSql, [bookId]);
    book.timeline = timelineResult.rows;
    return book;
}

export const createPictureBook = async (req, res) => {
    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();

        let { title, luluProductId } = req.body;
        const userId = req.userId;

        if (!luluProductId) {
            const defaultPictureBookConfig = LULU_PRODUCT_CONFIGURATIONS.find(p => p.type === 'pictureBook' && p.isDefault);
            if (defaultPictureBookConfig) {
                luluProductId = defaultPictureBookConfig.id;
                console.warn(`[Create Picture Book] No luluProductId provided by frontend. Using default: ${luluProductId}`);
            } else {
                return res.status(400).json({ message: "Lulu product ID is required to create a picture book, and no default could be found." });
            }
        }

        const countSql = `SELECT COUNT(*) as count FROM picture_books WHERE user_id = $1`;
        const countResult = await client.query(countSql, [userId]);
        const { count } = countResult.rows[0];

        if (count >= 5) {
            return res.status(403).json({ message: "You have reached the maximum of 5 projects." });
        }

        const bookId = randomUUID();
        const currentDate = new Date().toISOString();
        const sql = `INSERT INTO picture_books (id, user_id, title, date_created, last_modified, lulu_product_id) VALUES ($1, $2, $3, $4, $5, $6)`;
        await client.query(sql, [bookId, userId, title, currentDate, currentDate, luluProductId]);

        res.status(201).json({ bookId: bookId });
    } catch (err) {
        console.error("Error creating picture book:", err.message);
        res.status(500).json({ message: 'Failed to create picture book.' });
    } finally {
        if (client) client.release();
    }
};

export const getPictureBook = async (req, res) => {
    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();

        const { bookId } = req.params;
        const userId = req.userId;
        
        const book = await getFullPictureBook(bookId, userId, client);
        if (!book) {
            return res.status(404).json({ message: 'Project not found.' });
        }
        
        res.status(200).json({ book, timeline: book.timeline });
    } catch (err) {
        console.error("Error fetching project:", err.message);
        res.status(500).json({ message: 'Failed to fetch project details.' });
    } finally {
        if (client) client.release();
    }
};

export const getPictureBooks = async (req, res) => {
    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();

        const userId = req.userId;
        const sql = `
            SELECT pb.id, pb.title, pb.last_modified, pb.is_public, pb.cover_image_url, pb.lulu_product_id
            FROM picture_books pb
            WHERE pb.user_id = $1
            ORDER BY pb.last_modified DESC`;
        const booksResult = await client.query(sql, [userId]);
        const books = booksResult.rows;

        const printOptionsCache = await getPrintOptions();
        const booksWithType = books.map(book => {
            const productConfig = printOptionsCache.find(p => p.id === book.lulu_product_id);
            return { ...book, productName: productConfig ? productConfig.name : 'Unknown Book', type: 'pictureBook' };
        });
        res.status(200).json(booksWithType);
    } catch (err) {
        console.error("Error fetching projects:", err.message);
        res.status(500).json({ message: 'Failed to fetch projects.' });
    } finally {
        if (client) client.release();
    }
};

export const addTimelineEvent = async (req, res) => {
    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();

        const { bookId } = req.params;
        const { page_number, event_date = null, story_text = null, image_url = null, image_style = null, uploaded_image_url = null, overlay_text = null, is_bold_story_text = false } = req.body;

        if (page_number === undefined || page_number === null) {
            return res.status(400).json({ message: "Page number is a required field." });
        }

        const finalImageUrl = uploaded_image_url || image_url;

        const sql = `
            INSERT INTO timeline_events (book_id, page_number, event_date, story_text, image_url, image_style, uploaded_image_url, overlay_text, is_bold_story_text)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT(book_id, page_number) DO UPDATE SET
            event_date = EXCLUDED.event_date,
            story_text = EXCLUDED.story_text,
            image_url = EXCLUDED.image_url,
            image_style = EXCLUDED.image_style,
            uploaded_image_url = EXCLUDED.uploaded_image_url,
            overlay_text = EXCLUDED.overlay_text,
            is_bold_story_text = EXCLUDED.is_bold_story_text,
            last_modified = CURRENT_TIMESTAMP;
        `;
        await client.query(sql, [bookId, page_number, event_date, story_text, finalImageUrl, image_style, uploaded_image_url, overlay_text, is_bold_story_text]);

        await client.query(`UPDATE picture_books SET last_modified = $1 WHERE id = $2`, [new Date().toISOString(), bookId]);

        res.status(201).json({ message: 'Event saved.' });
    } catch (err) {
        console.error("Error in addTimelineEvent:", err.message);
        res.status(500).json({ message: 'Failed to save timeline event.' });
    } finally {
        if (client) client.release();
    }
};

// NEW: Controller to get shipping options
export const getPictureBookShippingOptions = async (req, res) => {
    let client;
    let tempInteriorPdfPath = null;
    let tempCoverPdfPath = null;
    try {
        const pool = await getDb();
        client = await pool.connect();

        const { bookId } = req.params;
        const { country_code, postcode } = req.query; // Expect country_code and postcode from frontend query params

        if (!country_code) {
            return res.status(400).json({ message: "Country code is required to get shipping options." });
        }
        if (!VALID_ISO_COUNTRY_CODES.has(country_code.toUpperCase())) {
            return res.status(400).json({ message: `Invalid country code: ${country_code}. Please use a valid ISO Alpha-2 code.` });
        }
        // Postcode is optional for some countries, but good to have for more accurate quotes if available.

        console.log(`[Shipping Options] Fetching for book ${bookId} to country: ${country_code}, postcode: ${postcode || 'N/A'}`);

        const book = await getFullPictureBook(bookId, req.userId, client);
        if (!book) return res.status(404).json({ message: "Project not found." });

        const selectedProductConfig = LULU_PRODUCT_CONFIGURATIONS.find(p => p.id === book.lulu_product_id);
        if (!selectedProductConfig) {
            console.error(`[Shipping Options ERROR] Picture book product configuration not found for luluProductId: ${book.lulu_product_id}`);
            return res.status(500).json({ message: "Picture book product configuration not found." });
        }

        // Generate interior PDF to get the exact page count required for Lulu cost calculation
        console.log(`[Shipping Options] Generating Picture Book PDFs temporarily for page count...`);
        const { path: interiorPath, pageCount: trueContentPageCount } = await generateAndSavePictureBookPdf(book, book.timeline, selectedProductConfig);
        tempInteriorPdfPath = interiorPath;
        
        let actualFinalPageCount = trueContentPageCount;
        if (trueContentPageCount === null) {
            console.warn(`[Shipping Options] True content page count was null. Falling back to product's defaultPageCount: ${selectedProductConfig.defaultPageCount}`);
            actualFinalPageCount = selectedProductConfig.defaultPageCount;
        }

        const finalPaddedPageCount = await finalizePdfPageCount(tempInteriorPdfPath, selectedProductConfig, actualFinalPageCount);
        if (finalPaddedPageCount === null) {
            console.error(`[Shipping Options] Failed to finalize PDF page count for shipping options.`);
            return res.status(500).json({ message: 'Failed to prepare book for shipping cost calculation.' });
        }
        actualFinalPageCount = finalPaddedPageCount;
        console.log(`[Shipping Options] Final padded page count for cost calc: ${actualFinalPageCount}.`);

        // Prepare dummy shipping address for Lulu cost calculation (only country & postcode needed for options)
        const luluShippingAddressForCost = {
            country_code: country_code,
            postcode: postcode || ''
            // Lulu does not strictly require full address for *just* shipping options, but it helps for accuracy.
            // We'll send what we have and let Lulu validate.
        };

        const printCostLineItems = [{
            pod_package_id: selectedProductConfig.luluSku,
            page_count: actualFinalPageCount,
            quantity: 1
        }];

        // Call getPrintJobCosts WITHOUT a selectedShippingLevel to get ALL options
        const luluCostsResponse = await getPrintJobCosts(printCostLineItems, luluShippingAddressForCost, null); // Pass null for selectedShippingLevel

        if (!luluCostsResponse || !Array.isArray(luluCostsResponse.shippingOptions) || luluCostsResponse.shippingOptions.length === 0) {
            console.error("[Shipping Options] Lulu API response missing expected 'shippingOptions' structure or is empty:", luluCostsResponse);
            return res.status(500).json({ message: "No shipping options available for this destination." });
        }

        const availableShippingOptions = luluCostsResponse.shippingOptions.map(option => ({
            level: option.level,
            name: option.name,
            costAud: parseFloat(option.total_cost_incl_tax),
            costUsd: parseFloat(option.total_cost_incl_tax) * AUD_TO_USD_EXCHANGE_RATE,
            estimatedDeliveryDate: option.estimated_delivery_date
        }));

        res.status(200).json({ shippingOptions: availableShippingOptions });

    } catch (error) {
        console.error("Error fetching picture book shipping options:", error.message);
        console.error("Stack trace:", error.stack);
        res.status(500).json({ message: "Failed to retrieve shipping options. Please check the country/postcode and try again." });
    } finally {
        if (client) client.release();
        // Clean up temporary PDFs even if just calculating costs
        if (tempInteriorPdfPath) {
            try { await fs.unlink(tempInteriorPdfPath); } catch (e) { console.error(`[Cleanup] Error deleting temp interior PDF: ${e.message}`); }
        }
    }
};


export const createBookCheckoutSession = async (req, res) => {
    const { bookId } = req.params;
    const { shippingAddress, selectedShippingLevel } = req.body; // Expect selectedShippingLevel here
    let client;
    let tempInteriorPdfPath = null;
    let tempCoverPdfPath = null;

    // Validate incoming shippingAddress fields - these will be collected by Stripe and then passed to Lulu
    // We still need country_code and postcode for Lulu cost calculations
    const trimmedAddress = {
        name: shippingAddress.name ? shippingAddress.name.trim() : '',
        street1: shippingAddress.street1 ? shippingAddress.street1.trim() : '',
        street2: shippingAddress.street2 ? shippingAddress.street2.trim() : '',
        city: shippingAddress.city ? shippingAddress.city.trim() : '',
        state_code: shippingAddress.state_code ? shippingAddress.state_code.trim() : '',
        postcode: shippingAddress.postcode ? shippingAddress.postcode.trim() : '',
        country_code: shippingAddress.country_code ? shippingAddress.country_code.trim().toUpperCase() : '',
        phone_number: shippingAddress.phone_number ? shippingAddress.phone_number.trim() : '000-000-0000',
        email: shippingAddress.email ? shippingAddress.email.trim() : 'placeholder@example.com' // Lulu requires email for print job
    };

    // Basic validation, more comprehensive validation will happen on Stripe side or via Lulu API responses
    if (!trimmedAddress.name || !trimmedAddress.street1 || !trimmedAddress.city || !trimmedAddress.postcode || !trimmedAddress.country_code || !selectedShippingLevel) {
        return res.status(400).json({ message: 'Full shipping address and selected shipping level are required.' });
    }
    if (!VALID_ISO_COUNTRY_CODES.has(trimmedAddress.country_code)) {
        return res.status(400).json({ message: `Invalid country code: ${trimmedAddress.country_code}. Please use a valid ISO Alpha-2 code.` });
    }

    console.log(`[Checkout] Initiating picture book checkout for book ${bookId} to country: ${trimmedAddress.country_code} with shipping level: ${selectedShippingLevel}`);

    try {
        const pool = await getDb();
        client = await pool.connect();

        console.log(`[Checkout DEBUG] Connected to DB pool for book ${bookId}.`);

        const book = await getFullPictureBook(bookId, req.userId, client);
        if (!book) {
            console.error(`[Checkout ERROR] Project not found for bookId: ${bookId} and userId: ${req.userId}`);
            return res.status(404).json({ message: "Project not found." });
        }
        console.log(`[Checkout DEBUG] Successfully fetched book details for book ${bookId}. Book title: ${book.title}`);

        const selectedProductConfig = LULU_PRODUCT_CONFIGURATIONS.find(p => p.id === book.lulu_product_id);
        if (!selectedProductConfig) {
            console.error(`[Checkout ERROR] Picture book product configuration not found for luluProductId: ${book.lulu_product_id}`);
            return res.status(500).json({ message: "Picture book product configuration not found." });
        }
        console.log(`[Checkout DEBUG] Selected product configuration: ${selectedProductConfig.name}`);

        console.log(`[Checkout] Generating Picture Book PDFs...`);
        const { path: interiorPath, pageCount: trueContentPageCount } = await generateAndSavePictureBookPdf(book, book.timeline, selectedProductConfig);
        tempInteriorPdfPath = interiorPath;
        console.log(`[Checkout] Content PDF generation complete. True content page count is ${trueContentPageCount}.`);
        
        let actualFinalPageCount = trueContentPageCount;
        let isPageCountFallback = false;

        if (trueContentPageCount === null) {
            console.warn(`[Checkout] True content page count was null. Falling back to product's defaultPageCount: ${selectedProductConfig.defaultPageCount}`);
            actualFinalPageCount = selectedProductConfig.defaultPageCount;
            isPageCountFallback = true;
        }

        const finalPaddedPageCount = await finalizePdfPageCount(tempInteriorPdfPath, selectedProductConfig, actualFinalPageCount);
        if (finalPaddedPageCount === null) {
            console.error(`[Checkout] Failed to finalize PDF page count (padding/evenness).`);
            return res.status(500).json({ message: 'Failed to finalize book PDF for printing.' });
        }
        actualFinalPageCount = finalPaddedPageCount;
        console.log(`[Checkout] PDF finalization complete. Final padded page count is ${actualFinalPageCount}.`);


        if (actualFinalPageCount > selectedProductConfig.maxPageCount) {
            const errorMessage = `This picture book has ${actualFinalPageCount} pages, which exceeds the maximum allowed for this format (${selectedProductConfig.maxPageCount} pages). Please consider a different product or reducing content length.`;
            console.error("[Checkout] Failed for picture book: Page count exceeded max limit.", { bookId, finalPageCount: actualFinalPageCount, product: selectedProductConfig.id });
            return res.status(400).json({ message: errorMessage });
        }
        if (actualFinalPageCount < selectedProductConfig.minPageCount) {
            const errorMessage = `Generated picture book page count (${actualFinalPageCount}) is below the minimum required for this format (${selectedProductConfig.minPageCount}). This indicates an issue with PDF generation or unexpected content. Please generate more content or try a different product.`;
            console.error("[Checkout] ERROR: Page count still below minimum after PDF generation/fallback.", { bookId, finalPageCount: actualFinalPageCount, product: selectedProductConfig.id });
            return res.status(400).json({ message: errorMessage });
        }


        const interiorPdfUrl = await uploadPdfFileToCloudinary(tempInteriorPdfPath, `inkwell-ai/user_${req.userId}/books`, `book_${bookId}_interior`);
        
        const luluSku = selectedProductConfig.luluSku;
        const coverDimensions = await getCoverDimensionsFromApi(luluSku, actualFinalPageCount);
        tempCoverPdfPath = await generateCoverPdf(book, selectedProductConfig, coverDimensions);
        const coverPdfUrl = await uploadPdfFileToCloudinary(tempCoverPdfPath, `inkwell-ai/user_${req.userId}/covers`, `book_${bookId}_cover`);
        console.log(`[Checkout] PDFs uploaded to Cloudinary.`);

        console.log("[Checkout] Fetching print costs from Lulu with selected shipping level...");
        const printCostLineItems = [{ 
            pod_package_id: luluSku, 
            page_count: actualFinalPageCount, 
            quantity: 1 
        }];
        const luluShippingAddressForCost = { 
            // Only send country/postcode for cost calculation, full address gathered later by Stripe
            country_code: trimmedAddress.country_code,
            postcode: trimmedAddress.postcode
        };

        // Call getPrintJobCosts with the SELECTED shipping level
        const luluCostsResponse = await getPrintJobCosts(printCostLineItems, luluShippingAddressForCost, selectedShippingLevel); 

        if (!luluCostsResponse || !Array.isArray(luluCostsResponse.lineItemCosts) || luluCostsResponse.lineItemCosts.length === 0 || luluCostsResponse.lineItemCosts[0].total_cost_incl_tax === undefined || typeof parseFloat(luluCostsResponse.lineItemCosts[0].total_cost_incl_tax) !== 'number') {
            console.error("[Checkout] Lulu API response missing expected 'lineItemCosts[0].total_cost_incl_tax' structure or is empty/invalid type:", luluCostsResponse);
            throw new Error("Failed to retrieve valid item print cost from Lulu API: Unexpected response structure or missing cost.");
        }
        const luluPrintCostAUD = parseFloat(luluCostsResponse.lineItemCosts[0].total_cost_incl_tax);
        if (isNaN(luluPrintCostAUD) || luluPrintCostAUD <= 0) {
            console.error("[Checkout] Failed to parse or received invalid (non-positive) item print cost from Lulu:", luluCostsResponse);
            throw new Error("Failed to retrieve valid item print cost from Lulu API or cost was non-positive.");
        }
        console.log(`[Checkout] Lulu Print Cost (AUD): $${luluPrintCostAUD.toFixed(4)}`);

        // Extract the selected shipping level cost
        const selectedShippingOption = luluCostsResponse.shippingOptions.find(opt => opt.level === selectedShippingLevel);
        if (!selectedShippingOption) {
            console.error(`[Checkout] Selected shipping level '${selectedShippingLevel}' not found in Lulu response.`);
            throw new Error(`Selected shipping option is not valid for this destination or product.`);
        }
        const luluShippingCostAUD = parseFloat(selectedShippingOption.total_cost_incl_tax);
        console.log(`[Checkout] Lulu Dynamic Shipping Cost (AUD) for level ${selectedShippingLevel}: $${luluShippingCostAUD.toFixed(4)}`);

        const luluFulfillmentCostAUD = parseFloat(luluCostsResponse.fulfillmentCost?.total_cost_incl_tax || 0);
        console.log(`[Checkout] Lulu Fulfillment Cost (AUD): $${luluFulfillmentCostAUD.toFixed(4)}`);


        const luluPrintCostUSD = parseFloat((luluPrintCostAUD * AUD_TO_USD_EXCHANGE_RATE).toFixed(4));
        const luluShippingCostUSD = parseFloat((luluShippingCostAUD * AUD_TO_USD_EXCHANGE_RATE).toFixed(4));
        const luluFulfillmentCostUSD = parseFloat((luluFulfillmentCostAUD * AUD_TO_USD_EXCHANGE_RATE).toFixed(4));
        
        const finalPriceDollars = parseFloat((luluPrintCostUSD + luluShippingCostUSD + luluFulfillmentCostUSD + PROFIT_MARGIN_USD).toFixed(4));
        const finalPriceInCents = Math.round(finalPriceDollars * 100);

        console.log(`[Checkout] Final Pricing Breakdown (Picture Book):`);
        console.log(`  - Lulu Print Cost: $${luluPrintCostUSD.toFixed(2)} USD (from $${luluPrintCostAUD.toFixed(2)} AUD)`);
        console.log(`  - Dynamic Shipping Cost (${selectedShippingLevel}): $${luluShippingCostUSD.toFixed(2)} USD (from $${luluShippingCostAUD.toFixed(2)} AUD)`);
        console.log(`  - Fulfillment Cost: $${luluFulfillmentCostUSD.toFixed(2)} USD (from $${luluFulfillmentCostAUD.toFixed(2)} AUD)`);
        console.log(`  - Profit Margin: $${PROFIT_MARGIN_USD.toFixed(2)} USD`);
        console.log(`  - Total Price for Stripe: $${finalPriceDollars.toFixed(2)} USD (${finalPriceInCents} cents)`);
        
        const orderId = randomUUID();
        const insertOrderSql = `
            INSERT INTO orders (
                id, user_id, book_id, book_type, book_title, lulu_product_id, status, 
                total_price_usd, interior_pdf_url, cover_pdf_url, order_date, actual_page_count, is_fallback, 
                lulu_print_cost_usd, flat_shipping_cost_usd, profit_usd,
                shipping_level_selected,
                lulu_fulfillment_cost_usd
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12, $13, $14, $15, $16, $17)`;

        await client.query(insertOrderSql, [
            orderId, 
            req.userId, 
            bookId, 
            'pictureBook',
            book.title, 
            luluSku, 
            'pending', 
            finalPriceDollars, 
            interiorPdfUrl, 
            coverPdfUrl, 
            actualFinalPageCount, 
            isPageCountFallback, 
            luluPrintCostUSD, 
            luluShippingCostUSD, // Now storing the dynamic shipping cost
            PROFIT_MARGIN_USD,
            selectedShippingLevel, // Store the selected shipping level
            luluFulfillmentCostUSD // Store fulfillment cost
        ]);
        console.log(`[Checkout] Created pending order record ${orderId} with final price and selected shipping level.`);

        const session = await createStripeCheckoutSession(
            { 
                name: book.title, 
                description: `Inkwell AI Custom Picture Book - ${selectedProductConfig.name} (${selectedShippingLevel} shipping)`, // Include shipping level in description
                priceInCents: finalPriceInCents
            },
            req.userId,
            orderId,
            bookId,
            'pictureBook'
        );
        
        await client.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, orderId]);

        res.status(200).json({ url: session.url });
    } catch (error) {
        console.error("Failed to create checkout session (Picture Book):", error.message);
        console.error("Stack trace:", error.stack);
        res.status(500).json({ message: "Failed to create checkout session." });
    } finally {
        if (client) client.release();
        if (tempInteriorPdfPath) {
            try {
                await fs.unlink(tempInteriorPdfPath);
                console.log(`[Cleanup] Deleted temporary interior PDF: ${tempInteriorPdfPath}`);
            } catch (unlinkError) {
                console.error(`[Cleanup] Error deleting temporary interior PDF ${tempInteriorPdfPath}:`, unlinkError);
            }
        }
        if (tempCoverPdfPath) {
            try {
                await fs.unlink(tempCoverPdfPath);
                console.log(`[Cleanup] Deleted temporary cover PDF: ${tempCoverPdfPath}`);
            } catch (unlinkError) {
                console.error(`[Cleanup] Error deleting temporary cover PDF ${tempCoverPdfPath}:`, unlinkError);
            }
        }
    }
};

export const deletePictureBook = async (req, res) => {
    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();
        await client.query('BEGIN');

        const { bookId } = req.params;
        const userId = req.userId;

        const bookResult = await client.query(`SELECT id FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        const book = bookResult.rows[0];
        if (!book) return res.status(404).json({ message: 'Project not found.' });

        await client.query(`DELETE FROM timeline_events WHERE book_id = $1`, [bookId]);
        await client.query(`DELETE FROM picture_books WHERE id = $1`, [bookId]);

        await client.query('COMMIT');
        res.status(200).json({ message: 'Project deleted successfully.' });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("Error deleting project:", err.message);
        res.status(500).json({ message: 'Failed to delete project.' });
    } finally {
        if (client) client.release();
    }
};

export const deleteTimelineEvent = async (req, res) => {
    let client;
    const { bookId, pageNumber } = req.params;
    const userId = req.userId;

    try {
        const pool = await getDb();
        client = await pool.connect();

        const bookResult = await client.query(`SELECT id FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        const book = bookResult.rows[0];
        if (!book) {
            return res.status(404).json({ message: 'Project not found or you do not have permission to edit it.' });
        }

        await client.query(`DELETE FROM timeline_events WHERE book_id = $1 AND page_number = $2`, [bookId, pageNumber]);
        await client.query(`UPDATE timeline_events SET page_number = page_number - 1 WHERE book_id = $1 AND page_number > $2`, [bookId, pageNumber]);
        await client.query(`UPDATE picture_books SET last_modified = $1 WHERE id = $2`, [new Date().toISOString(), bookId]);

        res.status(200).json({ message: `Page ${pageNumber} deleted successfully and subsequent pages re-ordered.` });
    } catch (err) {
        console.error(`Error in deleteTimelineEvent controller:`, err.message);
        res.status(500).json({ message: 'Failed to delete the page.' });
    } finally {
        if (client) client.release();
    }
};

export const togglePictureBookPrivacy = async (req, res) => {
    let client;
    const { bookId } = req.params;
    const userId = req.userId;
    const { is_public } = req.body;

    if (typeof is_public !== 'boolean') {
        return res.status(400).json({ message: 'is_public must be a boolean value.' });
    }

    try {
        const pool = await getDb();
        client = await pool.connect();

        const bookResult = await client.query(`SELECT id, user_id FROM picture_books WHERE id = $1`, [bookId]);
        const book = bookResult.rows[0];

        if (!book) {
            return res.status(404).json({ message: 'Project not found.' });
        }
        if (book.user_id !== userId) {
            return res.status(403).json({ message: 'You are not authorized to edit this project.' });
        }

        await client.query(`UPDATE picture_books SET is_public = $1 WHERE id = $2`, [is_public, bookId]);

        res.status(200).json({
            message: `Book status successfully set to ${is_public ? 'public' : 'private'}.`,
            is_public: is_public
        });
    } catch (err) {
        console.error("Error toggling book privacy:", err.message);
        res.status(500).json({ message: 'Failed to update project status.' });
    } finally {
        if (client) client.release();
    }
};