// backend/src/controllers/picturebook.controller.js

import { getDb } from '../db/database.js';
import { randomUUID } from 'crypto';
import { generateAndSavePictureBookPdf, generateCoverPdf, finalizePdfPageCount } from '../services/pdf.service.js';
import { LULU_PRODUCT_CONFIGURATIONS, getPrintOptions, getCoverDimensionsFromApi, getPrintJobCosts } from '../services/lulu.service.js';
import { createStripeCheckoutSession } from '../services/stripe.service.js';
import { uploadPdfFileToCloudinary } from '../services/image.service.js';
import jsonwebtoken from 'jsonwebtoken'; // ADDED: Import jsonwebtoken
import path from 'path';
import fs from 'fs/promises';

const AUD_TO_USD_EXCHANGE_RATE = 0.66;
const JWT_QUOTE_SECRET = process.env.JWT_QUOTE_SECRET || 'your_super_secret_jwt_quote_key_please_change_this_in_production'; // ADDED: JWT Secret
const FALLBACK_SHIPPING_OPTION = { // ADDED: Fallback option for consistency
    level: 'FALLBACK_STANDARD',
    name: 'Standard Shipping (Fallback)',
    costUsd: 15.00,
    estimatedDeliveryDate: '7-21 business days',
    isFallback: true
};

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

const VALID_ISO_COUNTRY_CODES = new Set([ // ADDED: VALID_ISO_COUNTRY_CODES
    'AF', 'AX', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AU', 'AT', 'AZ', 'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BQ', 'BA', 'BW', 'BR', 'IO', 'BN', 'BG', 'BF', 'BI', 'CV', 'KH', 'CM', 'CA', 'KY', 'CF', 'TD', 'CL', 'CN', 'CX', 'CC', 'CO', 'KM', 'CD', 'CG', 'CK', 'CR', 'CI', 'HR', 'CU', 'CW', 'CY', 'CZ', 'DK', 'DJ', 'DM', 'DO', 'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET', 'FK', 'FO', 'FJ', 'FI', 'FR', 'GF', 'PF', 'TF', 'GA', 'GM', 'GE', 'DE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY', 'HT', 'HM', 'VA', 'HN', 'HK', 'HU', 'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IM', 'IL', 'IT', 'JM', 'JP', 'JE', 'JO', 'KZ', 'KE', 'KI', 'KP', 'KR', 'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MO', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MS', 'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'NC', 'NZ', 'NI', 'NE', 'NG', 'NU', 'NF', 'MP', 'NO', 'OM', 'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PN', 'PL', 'PT', 'PR', 'QA', 'MK', 'RO', 'RU', 'RW', 'RE', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SX', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS', 'SS', 'ES', 'LK', 'SD', 'SR', 'SJ', 'SE', 'CH', 'SY', 'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TK', 'TO', 'TT', 'TN', 'TR', 'TM', 'TC', 'TV', 'UG', 'UA', 'AE', 'GB', 'US', 'UM', 'UY', 'UZ', 'VU', 'VE', 'VN', 'VG', 'VI', 'WF', 'EH', 'YE', 'ZM', 'ZW'
]);

const PROFIT_MARGIN_USD = 10.00; // Your desired profit margin per book, consistent with textbook controller

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

// REMOVED: getPictureBookShippingOptions - Replaced by generic getShippingQuotes in shipping.controller.js
// export const getPictureBookShippingOptions = async (req, res) => { /* ... removed ... */ };

export const createBookCheckoutSession = async (req, res) => {
    const { bookId } = req.params;
    const { shippingAddress, selectedShippingLevel, quoteToken } = req.body; // Expect selectedShippingLevel and quoteToken here
    let client;
    let tempInteriorPdfPath = null;
    let tempCoverPdfPath = null;

    const trimmedAddress = {
        name: shippingAddress.name ? shippingAddress.name.trim() : '',
        street1: shippingAddress.street1 ? shippingAddress.street1.trim() : '',
        street2: shippingAddress.street2 ? shippingAddress.street2.trim() : '',
        city: shippingAddress.city ? shippingAddress.city.trim() : '',
        state_code: shippingAddress.state_code ? shippingAddress.state_code.trim() : '',
        postcode: shippingAddress.postcode ? shippingAddress.postcode.trim() : '',
        country_code: shippingAddress.country_code ? shippingAddress.country_code.trim().toUpperCase() : '',
        phone_number: shippingAddress.phone_number ? shippingAddress.phone_number.trim() : '',
        email: shippingAddress.email ? shippingAddress.email.trim() : '',
    };

    if (!trimmedAddress.name || !trimmedAddress.street1 || !trimmedAddress.city ||
        !trimmedAddress.postcode || !trimmedAddress.country_code ||
        !trimmedAddress.phone_number || !trimmedAddress.email || !selectedShippingLevel || !quoteToken) {
        console.error("Missing required checkout fields or invalid request:", { trimmedAddress, selectedShippingLevel, quoteTokenPresent: !!quoteToken });
        const missingFields = [];
        if (!trimmedAddress.name) missingFields.push('name');
        if (!trimmedAddress.street1) missingFields.push('street1');
        if (!trimmedAddress.city) missingFields.push('city');
        if (!trimmedAddress.postcode) missingFields.push('postcode');
        if (!trimmedAddress.country_code) missingFields.push('country_code');
        if (!trimmedAddress.phone_number) missingFields.push('phone_number');
        if (!trimmedAddress.email) missingFields.push('email');
        if (!selectedShippingLevel) missingFields.push('selectedShippingLevel');
        if (!quoteToken) missingFields.push('quoteToken');

        return res.status(400).json({
            message: `Checkout request incomplete. Missing: ${missingFields.join(', ')}.`,
            detailedError: 'Please ensure all shipping details and selected shipping option are provided.'
        });
    }

    if (!VALID_ISO_COUNTRY_CODES.has(trimmedAddress.country_code)) {
        return res.status(400).json({ message: `Invalid country code: ${trimmedAddress.country_code}. Please use a valid ISO Alpha-2 code.` });
    }

    console.log(`[Checkout] Initiating picture book checkout for book ${bookId} to country: ${trimmedAddress.country_code} with shipping level: ${selectedShippingLevel}`);

    try {
        let decodedQuote;
        try {
            decodedQuote = jsonwebtoken.verify(quoteToken, JWT_QUOTE_SECRET);
            console.log('[Checkout] Quote token verified successfully.');
        } catch (tokenError) {
            console.error('[Checkout ERROR] Quote token verification failed:', tokenError.message);
            return res.status(403).json({ message: 'Invalid or expired shipping quote. Please get a new quote.' });
        }

        // MODIFIED: Ensure bookType matches 'pictureBook' from decoded quote
        if (decodedQuote.bookId !== bookId || decodedQuote.bookType !== 'pictureBook' || decodedQuote.pageCount === undefined || decodedQuote.luluSku === undefined) {
            console.error('[Checkout ERROR] Quote token content mismatch:', { requestBookId: bookId, decoded: decodedQuote });
            return res.status(400).json({ message: 'Shipping quote details do not match the selected book.' });
        }
        if (decodedQuote.shippingAddress.country_code !== trimmedAddress.country_code ||
            decodedQuote.shippingAddress.postcode !== trimmedAddress.postcode) {
            console.warn('[Checkout WARNING] Quote token address mismatch (country/postcode). Proceeding but noted:', { decodedAddress: decodedQuote.shippingAddress, currentAddress: trimmedAddress });
        }

        const pool = await getDb();
        client = await pool.connect();

        const book = await getFullPictureBook(bookId, req.userId, client); // Use getFullPictureBook
        if (!book) {
            console.error(`[Checkout ERROR] Project not found for bookId: ${bookId} and userId: ${req.userId}`);
            return res.status(404).json({ message: "Project not found." });
        }

        const selectedProductConfig = LULU_PRODUCT_CONFIGURATIONS.find(p => p.id === book.lulu_product_id);
        if (!selectedProductConfig) {
            console.error(`[Checkout ERROR] Picture book product configuration not found for luluProductId: ${book.lulu_product_id}`);
            return res.status(500).json({ message: "Picture book product configuration not found." });
        }

        console.log(`[Checkout] Re-generating PDFs for book ${bookId} for final order...`);
        const { path: interiorPath, pageCount: trueContentPageCount } = await generateAndSavePictureBookPdf(book, book.timeline, selectedProductConfig); // Use PictureBook PDF generation
        tempInteriorPdfPath = interiorPath;
        console.log(`[Checkout] Content PDF re-generation complete. True content page count is ${trueContentPageCount}.`);
        
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
            name: trimmedAddress.name, 
            street1: trimmedAddress.street1, 
            street2: trimmedAddress.street2, 
            city: trimmedAddress.city, 
            state_code: trimmedAddress.state_code || '', 
            postcode: trimmedAddress.postcode, 
            country_code: trimmedAddress.country_code, 
            phone_number: trimmedAddress.phone_number, 
            email: trimmedAddress.email 
        };

        let luluCostsResponse;
        let luluShippingCostUSD;
        const isFallback = selectedShippingLevel === FALLBACK_SHIPPING_OPTION.level;
        const PROFIT_MARGIN_USD = selectedProductConfig.basePrice * 0.5; // Example: 50% profit margin on base price

        if (isFallback) {
            console.log(`[Checkout] Using fallback shipping rate. Probing Lulu for print and fulfillment costs with a valid shipping level.`);
            const validLuluLevelForProbe = 'MAIL'; // Use a known valid level for the probe
            try {
                luluCostsResponse = await getPrintJobCosts(printCostLineItems, luluShippingAddressForCost, validLuluLevelForProbe);
                luluShippingCostUSD = FALLBACK_SHIPPING_OPTION.costUsd; // Use our hardcoded cost
            } catch (luluError) {
                console.error(`[Checkout] Error getting Lulu print/fulfillment cost during fallback: ${luluError.message}. Using dummy print/fulfillment costs.`);
                luluCostsResponse = {
                    lineItemCosts: [{ total_cost_incl_tax: (selectedProductConfig.basePrice / AUD_TO_USD_EXCHANGE_RATE) * 0.7 }], // Estimate 70% of base price
                    fulfillmentCost: { total_cost_incl_tax: 0 }
                };
                luluShippingCostUSD = FALLBACK_SHIPPING_OPTION.costUsd;
            }
        } else {
            try {
                luluCostsResponse = await getPrintJobCosts(printCostLineItems, luluShippingAddressForCost, selectedShippingLevel);
                const selectedShippingOption = luluCostsResponse.shippingOptions && Array.isArray(luluCostsResponse.shippingOptions)
                    ? luluCostsResponse.shippingOptions.find(opt => opt.level === selectedShippingLevel)
                    : null;

                if (!selectedShippingOption) {
                    console.warn(`Selected shipping level '${selectedShippingLevel}' not confirmed by Lulu for final calculation. Attempting to get print/fulfillment cost with 'MAIL' level.`);
                    try {
                        const fallbackLuluCostsResponse = await getPrintJobCosts(printCostLineItems, luluShippingAddressForCost, 'MAIL'); // Use 'MAIL' to get base costs
                        luluCostsResponse.lineItemCosts = fallbackLuluCostsResponse.lineItemCosts;
                        luluCostsResponse.fulfillmentCost = fallbackLuluCostsResponse.fulfillmentCost;
                        luluShippingCostUSD = 0; // Explicitly set to 0 if the selected level isn't confirmed
                    } catch (fallbackError) {
                        console.error(`Failed to get print/fulfillment costs even with 'MAIL' fallback: ${fallbackError.message}`);
                        throw new Error(`Failed to confirm selected shipping level and could not get fallback print/fulfillment costs.`);
                    }
                } else {
                    const luluShippingCostAUD = parseFloat(selectedShippingOption.total_cost_incl_tax);
                    luluShippingCostUSD = parseFloat((luluShippingCostAUD * AUD_TO_USD_EXCHANGE_RATE).toFixed(4));
                }
            } catch (luluError) {
                console.error(`[Checkout] Error fetching print costs from Lulu: ${luluError.message}. Error details:`, luluError.response?.data);
                throw luluError;
            }
        }

        if (!luluCostsResponse?.lineItemCosts?.[0]?.total_cost_incl_tax) {
            console.error("[Checkout] Lulu API response missing expected structure:", luluCostsResponse);
            throw new Error("Failed to retrieve valid item print cost from Lulu API.");
        }
        const luluPrintCostAUD = parseFloat(luluCostsResponse.lineItemCosts[0].total_cost_incl_tax);
        if (isNaN(luluPrintCostAUD) || luluPrintCostAUD <= 0) {
            console.error("[Checkout] Failed to parse or received invalid (non-positive) item print cost from Lulu:", luluCostsResponse);
            throw new Error("Failed to retrieve valid item print cost from Lulu API or cost was non-positive.");
        }
        console.log(`[Checkout] Lulu Print Cost (AUD): $${luluPrintCostAUD.toFixed(4)}`);

        const luluFulfillmentCostAUD = parseFloat(luluCostsResponse.fulfillmentCost?.total_cost_incl_tax || 0);
        console.log(`[Checkout] Lulu Fulfillment Cost (AUD): $${luluFulfillmentCostAUD.toFixed(4)}`);

        const luluPrintCostUSD = parseFloat((luluPrintCostAUD * AUD_TO_USD_EXCHANGE_RATE).toFixed(4));
        const luluFulfillmentCostUSD = parseFloat((luluFulfillmentCostAUD * AUD_TO_USD_EXCHANGE_RATE).toFixed(4));
        
        const finalPriceDollars = parseFloat((selectedProductConfig.basePrice + luluShippingCostUSD + luluFulfillmentCostUSD).toFixed(4));
        const finalPriceInCents = Math.round(finalPriceDollars * 100);

        console.log(`[Checkout] Final Pricing Breakdown (Picture Book):`);
        console.log(`  - Product Retail Price: $${selectedProductConfig.basePrice.toFixed(2)} USD`);
        console.log(`  - Lulu Print Cost: $${luluPrintCostUSD.toFixed(2)} USD (from $${luluPrintCostAUD.toFixed(2)} AUD)`);
        console.log(`  - Dynamic Shipping Cost (${selectedShippingLevel}): $${luluShippingCostUSD.toFixed(2)} USD`);
        console.log(`  - Fulfillment Cost: $${luluFulfillmentCostUSD.toFixed(2)} USD (from $${luluFulfillmentCostAUD.toFixed(2)} AUD)`);
        console.log(`  - Profit Margin: $${PROFIT_MARGIN_USD.toFixed(2)} USD`);
        console.log(`  -----------------------------------------`);
        console.log(`  - Total Price for Stripe: $${finalPriceDollars.toFixed(2)} USD (${finalPriceInCents} cents)`);

        const orderId = randomUUID();
        const insertOrderSql = `
            INSERT INTO orders (
                id, user_id, book_id, book_type, book_title, lulu_product_id, status,
                total_price_usd, currency, interior_pdf_url, cover_pdf_url, created_at, actual_page_count, is_fallback,
                lulu_print_cost_usd, lulu_shipping_cost_usd, profit_usd,
                shipping_level_selected, lulu_fulfillment_cost_usd,
                stripe_session_id, lulu_order_id, lulu_job_id, lulu_job_status, order_date, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`;

        await client.query(insertOrderSql, [
            orderId,
            req.userId,
            bookId,
            'pictureBook', // MODIFIED: Set bookType to 'pictureBook'
            book.title,
            luluSku,
            'pending',
            parseFloat(finalPriceDollars.toFixed(2)),
            'USD',
            interiorPdfUrl,
            coverPdfUrl,
            new Date().toISOString(),
            actualFinalPageCount,
            isFallback,
            luluPrintCostUSD,
            luluShippingCostUSD,
            PROFIT_MARGIN_USD,
            selectedShippingLevel,
            luluFulfillmentCostUSD,
            null,
            null,
            null,
            null,
            new Date().toISOString(),
            new Date().toISOString()
        ]);
        console.log(`[Checkout] Created pending order record ${orderId}.`);

        const finalPriceInCentsForStripe = Math.round(finalPriceDollars * 100);

        const session = await createStripeCheckoutSession(
            {
                name: book.title,
                description: `Inkwell AI Custom Picture Book - ${selectedProductConfig.name} (${selectedShippingLevel} shipping)`, // MODIFIED: Description for picture book
                priceInCents: finalPriceInCentsForStripe
            },
            trimmedAddress,
            req.userId, orderId, bookId, 'pictureBook' // MODIFIED: Pass bookType as 'pictureBook'
        );

        await client.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, orderId]);

        res.status(200).json({ url: session.url });

    } catch (error) {
        console.error("Failed to create checkout session (Picture Book):", error.stack);
        let detailedError = 'An unexpected error occurred during checkout.';
        if (error.response && error.response.data && error.response.data.shipping_address?.detail?.errors) {
            const errorDetails = error.response.data.shipping_address.detail.errors.map(err => err.message || err.field).join('; ');
            detailedError = `Shipping address validation failed with publishing partner: ${errorDetails}.`;
        } else if (error.message.includes('Lulu')) {
            detailedError = error.message;
            if (error.response && error.response.data) {
                detailedError += ` (Lulu response: ${JSON.stringify(error.response.data)})`;
            }
        } else if (error.message.includes('Quote token')) {
            detailedError = error.message;
        }
        res.status(500).json({ message: 'Failed to create checkout session.', detailedError });
    } finally {
        if (client) client.release();
        if (tempInteriorPdfPath) { try { await fs.unlink(tempInteriorPdfPath); } catch (e) { console.error(`[Cleanup] Error deleting temp interior PDF file: ${tempInteriorPdfPath} Error: ${e.message}`); } }
        if (tempCoverPdfPath) { try { await fs.unlink(tempCoverPdfPath); } catch (e) { console.error(`[Cleanup] Error deleting temp cover PDF file: ${tempCoverPdfPath} Error: ${e.message}`); } }
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