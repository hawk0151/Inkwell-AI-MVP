// backend/src/controllers/picturebook.controller.js

// CHANGES:
// - Implemented full flat-rate shipping integration in createBookCheckoutSession.
// - Price calculation now includes Lulu print cost, flat-rate shipping (AUD converted to USD), and a profit margin.
// - Detailed pricing information is saved to the 'orders' table.
// - Comprehensive console logging of the pricing breakdown is included for auditing.
// - Added comprehensive input validation for shipping address (trimming, ISO country code validation).
// - Refactored flat shipping rate lookup into a dedicated helper function (`getFlatShippingRate`).
// - Added comments emphasizing dynamic exchange rate fetching in production.
// - Enhanced error handling for Lulu's `getPrintJobCosts` with clearer messages and retry considerations (commented).
// - Improved currency conversion precision using `toFixed(4)` for intermediate steps.
// - Ensured database inserts for pricing fields use actual numeric types, not strings, to preserve precision.
// - Implemented more robust temporary PDF file cleanup with specific error logging.
// - AbortController import/usage adjusted for CommonJS/Node.js compatibility.
// - Added a security note regarding sensitive data in logs.
// - Added a defensive guard in checkout flow to check generated page count against product maxPageCount.

import { getDb } from '../db/database.js';
import { randomUUID } from 'crypto';
import { generateAndSavePictureBookPdf, generateCoverPdf } from '../services/pdf.service.js';
import { LULU_PRODUCT_CONFIGURATIONS, getPrintOptions, getCoverDimensionsFromApi, getPrintJobCosts } from '../services/lulu.service.js';
import { createStripeCheckoutSession } from '../services/stripe.service.js';
import { uploadPdfFileToCloudinary } from '../services/image.service.js';
import path from 'path';
import fs from 'fs/promises';

// --- AbortController import/module system compatibility ---
// This robustly handles both Node.js versions with global AbortController (v15+)
// and older CommonJS environments requiring the polyfill.
let AbortController;
if (typeof globalThis.AbortController === 'function') {
    AbortController = globalThis.AbortController;
} else {
    // Dynamically require for CommonJS environments
    try {
        const NodeAbortController = require('node-abort-controller');
        AbortController = NodeAbortController.AbortController;
    } catch (e) {
        console.error("Critical: AbortController not available. Please ensure Node.js v15+ is used or 'node-abort-controller' is installed. Error:", e.message);
        // Fail loudly if AbortController cannot be obtained, as timeouts won't work otherwise.
        throw new Error("AbortController is not available. Please install 'node-abort-controller' or use Node.js v15+.");
    }
}

// List of ISO 3166-1 alpha-2 country codes for validation. This list should be kept up-to-date.
// For a production system, consider fetching this from a reliable external source or a larger library.
const VALID_ISO_COUNTRY_CODES = new Set([
    'AF', 'AX', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AU', 'AT', 'AZ', 'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BQ', 'BA', 'BW', 'BV', 'BR', 'IO', 'BN', 'BG', 'BF', 'BI', 'CV', 'KH', 'CM', 'CA', 'KY', 'CF', 'TD', 'CL', 'CN', 'CX', 'CC', 'CO', 'KM', 'CD', 'CG', 'CK', 'CR', 'CI', 'HR', 'CU', 'CW', 'CY', 'CZ', 'DK', 'DJ', 'DM', 'DO', 'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET', 'FK', 'FO', 'FJ', 'FI', 'FR', 'GF', 'PF', 'TF', 'GA', 'GM', 'GE', 'DE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY', 'HT', 'HM', 'VA', 'HN', 'HK', 'HU', 'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IM', 'IL', 'IT', 'JM', 'JP', 'JE', 'JO', 'KZ', 'KE', 'KI', 'KP', 'KR', 'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MO', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MS', 'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'NC', 'NZ', 'NI', 'NE', 'NG', 'NU', 'NF', 'MP', 'NO', 'OM', 'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PN', 'PL', 'PT', 'PR', 'QA', 'MK', 'RO', 'RU', 'RW', 'RE', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SX', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS', 'SS', 'ES', 'LK', 'SD', 'SR', 'SJ', 'SE', 'CH', 'SY', 'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TK', 'TO', 'TT', 'TN', 'TR', 'TM', 'TC', 'TV', 'UG', 'UA', 'AE', 'GB', 'US', 'UM', 'UY', 'UZ', 'VU', 'VE', 'VN', 'VG', 'VI', 'WF', 'EH', 'YE', 'ZM', 'ZW'
]);

const PROFIT_MARGIN_USD = 10.00; // This can be dynamic based on product/strategy

// --- Flat shipping rates in AUD ---
const FLAT_SHIPPING_RATES_AUD = {
    'US': 25.00, // USA
    'CA': 25.00, // Canada
    'MX': 25.00, // Mexico
    'AU': 15.00, // Australia
    'GB': 15.00, // United Kingdom
    'DEFAULT': 35.00 // "Rest of World" shipping rate
};

// --- Exchange Rate AUD to USD ---
// IMPORTANT: This is a static placeholder for MVP.
// For a production application, this rate MUST be fetched dynamically
// and regularly (e.g., daily or hourly) from a reliable currency exchange API (e.g., Fixer.io, Open Exchange Rates)
// to avoid significant financial loss due to currency fluctuations.
const AUD_TO_USD_EXCHANGE_RATE = 0.66; // Current approximate rate at 2025-08-02 (ADELAIDE, SA)

// --- Helper function for flat shipping rate lookup ---
/**
 * Retrieves the flat shipping rate for a given country code.
 * Logs a warning if the country code is unknown and the default rate is used.
 * @param {string} countryCode - The ISO Alpha-2 country code (e.g., 'US', 'AU').
 * @returns {number} The flat shipping rate in AUD.
 */
function getFlatShippingRate(countryCode) {
    const upperCaseCountryCode = countryCode.toUpperCase();
    let flatShippingRateAUD = FLAT_SHIPPING_RATES_AUD[upperCaseCountryCode];
    let isDefault = false;

    if (flatShippingRateAUD === undefined) {
        flatShippingRateAUD = FLAT_SHIPPING_RATES_ATUD['DEFAULT'];
        isDefault = true;
    }

    if (isDefault) {
        console.warn(`[Shipping Calculation] No specific flat shipping rate found for country code: ${upperCaseCountryCode}. Using default rate: $${flatShippingRateAUD.toFixed(2)} AUD.`);
    } else {
        console.log(`[Shipping Calculation] Flat Shipping Rate (AUD) for ${upperCaseCountryCode}: $${flatShippingRateAUD.toFixed(2)}`);
    }
    return flatShippingRateAUD;
}

async function getFullPictureBook(bookId, userId, client) {
    const bookResult = await client.query(`SELECT * FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
    const book = bookResult.rows[0];
    if (!book) return null;

    // The order by page_number ASC is crucial for PDF generation sequence
    const eventsSql = `SELECT *, uploaded_image_url, overlay_text FROM timeline_events WHERE book_id = $1 ORDER BY page_number ASC`; 
    const timelineResult = await client.query(eventsSql, [bookId]);
    book.timeline = timelineResult.rows;
    return book;
}

export const createPictureBook = async (req, res) => {
    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();

        const { title, luluProductId } = req.body;
        const userId = req.userId;

        const countSql = `SELECT COUNT(*) as count FROM picture_books WHERE user_id = $1`;
        const countResult = await client.query(countSql, [userId]);
        const { count } = countResult.rows[0];

        if (count >= 5) { // Limit number of projects per user
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

        const printOptionsCache = await getPrintOptions(); // Ensure this function is robust and handles its own caching
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
        const { page_number, event_date = null, description = null, image_url = null, image_style = null, uploaded_image_url = null, overlay_text = null } = req.body;

        if (page_number === undefined || page_number === null) {
            return res.status(400).json({ message: "Page number is a required field." });
        }

        const finalImageUrl = uploaded_image_url || image_url;

        const sql = `
            INSERT INTO timeline_events (book_id, page_number, event_date, description, image_url, image_style, uploaded_image_url, overlay_text)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT(book_id, page_number) DO UPDATE SET
            event_date = EXCLUDED.event_date,
            description = EXCLUDED.description,
            image_url = EXCLUDED.image_url,
            image_style = EXCLUDED.image_style,
            uploaded_image_url = EXCLUDED.uploaded_image_url,
            overlay_text = EXCLUDED.overlay_text,
            last_modified = CURRENT_TIMESTAMP;
        `;
        await client.query(sql, [bookId, page_number, event_date, description, finalImageUrl, image_style, uploaded_image_url, overlay_text]);

        await client.query(`UPDATE picture_books SET last_modified = $1 WHERE id = $2`, [new Date().toISOString(), bookId]);

        res.status(201).json({ message: 'Event saved.' });
    } catch (err) {
        console.error("Error in addTimelineEvent:", err.message);
        res.status(500).json({ message: 'Failed to save timeline event.' });
    } finally {
        if (client) client.release();
    }
};

export const createBookCheckoutSession = async (req, res) => {
    const { bookId } = req.params;
    const shippingAddress = req.body.shippingAddress || {}; // Ensure shippingAddress exists
    let client;
    let tempInteriorPdfPath = null;
    let tempCoverPdfPath = null;

    // 1. Input validation for shipping address fields
    const trimmedAddress = {
        name: shippingAddress.name ? shippingAddress.name.trim() : '',
        street1: shippingAddress.street1 ? shippingAddress.street1.trim() : '',
        street2: shippingAddress.street2 ? shippingAddress.street2.trim() : '', // Allow optional
        city: shippingAddress.city ? shippingAddress.city.trim() : '',
        state_code: shippingAddress.state_code ? shippingAddress.state_code.trim() : '', // Optional
        postcode: shippingAddress.postcode ? shippingAddress.postcode.trim() : '',
        country_code: shippingAddress.country_code ? shippingAddress.country_code.trim().toUpperCase() : '',
    };

    if (!trimmedAddress.name || !trimmedAddress.street1 || !trimmedAddress.city || !trimmedAddress.postcode || !trimmedAddress.country_code) {
        return res.status(400).json({ message: 'Shipping address must include name, street, city, postal code, and country.' });
    }
    if (!VALID_ISO_COUNTRY_CODES.has(trimmedAddress.country_code)) {
        return res.status(400).json({ message: `Invalid country code: ${trimmedAddress.country_code}. Please use a valid ISO Alpha-2 code.` });
    }

    // SECURITY: Be cautious logging sensitive user data like full addresses in production.
    // Consider using a logger that can redact or mask such information.
    console.log(`[Checkout] Initiating picture book checkout for book ${bookId} to country: ${trimmedAddress.country_code}`);

    try {
        const pool = await getDb();
        client = await pool.connect();

        const book = await getFullPictureBook(bookId, req.userId, client);
        if (!book) return res.status(404).json({ message: "Project not found." });

        const selectedProductConfig = LULU_PRODUCT_CONFIGURATIONS.find(p => p.id === book.lulu_product_id);
        if (!selectedProductConfig) return res.status(500).json({ message: "Picture book product configuration not found." });
        
        console.log(`[Checkout] Generating Picture Book PDFs...`);
        // --- MODIFIED: Use the new memory-efficient PDF generation method for Picture Books ---
        // This function now returns both the path and the pageCount directly.
        // Ensure book.timeline is passed correctly.
        const { path: interiorPath, pageCount: finalPageCount } = await generateAndSavePictureBookPdf(book, book.timeline, selectedProductConfig);
        tempInteriorPdfPath = interiorPath;
        console.log(`[Checkout] Picture book PDF generation complete. Final page count is ${finalPageCount}.`);
        
        if (finalPageCount < selectedProductConfig.minPageCount || finalPageCount > selectedProductConfig.maxPageCount) {
            const errorMessage = `This picture book has ${finalPageCount} pages, but the selected product format only supports ${selectedProductConfig.minPageCount}-${selectedProductConfig.maxPageCount} pages.`;
            // --- ADDED: More detailed error logging for out-of-range page count ---
            console.error("[Checkout] Failed for picture book: Page count out of range.", { bookId, finalPageCount, product: selectedProductConfig.id });
            return res.status(400).json({ message: errorMessage });
        }

        const interiorPdfUrl = await uploadPdfFileToCloudinary(tempInteriorPdfPath, `inkwell-ai/user_${req.userId}/books`, `book_${bookId}_interior`);
        const luluSku = selectedProductConfig.luluSku;
        const coverDimensions = await getCoverDimensionsFromApi(luluSku, finalPageCount);
        tempCoverPdfPath = await generateCoverPdf(book, selectedProductConfig, coverDimensions);
        const coverPdfUrl = await uploadPdfFileToCloudinary(tempCoverPdfPath, `inkwell-ai/user_${req.userId}/covers`, `book_${bookId}_cover`);
        console.log(`[Checkout] PDFs uploaded to Cloudinary.`);

        console.log("[Checkout] Fetching print costs from Lulu (shipping excluded from Lulu cost calculation)...");
        const printCostLineItems = [{ 
            pod_package_id: luluSku, 
            page_count: finalPageCount, 
            quantity: 1 
        }];
        const luluShippingAddressForCost = { 
            name: trimmedAddress.name,
            street1: trimmedAddress.street1,
            street2: trimmedAddress.street2,
            city: trimmedAddress.city,
            state_code: trimmedAddress.state_code || '', 
            postcode: trimmedAddress.postcode,
            country_code: trimmedAddress.country_code
        };

        let luluCostsResponse;
        try {
            // 4. Error handling for Lulu’s getPrintJobCosts
            luluCostsResponse = await getPrintJobCosts(printCostLineItems, luluShippingAddressForCost);
        } catch (luluError) {
            console.error(`[Checkout] Error fetching print costs from Lulu: ${luluError.message}. This might require a retry strategy or clearer user feedback.`);
            // CONSIDER: Implement retry logic here using a library like 'p-retry'
            return res.status(503).json({ message: 'Failed to get print costs from publishing partner. Please try again shortly.', error: luluError.message });
        }

        const luluPrintCostUSD = parseFloat(luluCostsResponse.print_costs.total_cost_incl_tax);
        if (isNaN(luluPrintCostUSD) || luluPrintCostUSD <= 0) {
            console.error("[Checkout] Failed to parse or received invalid print cost from Lulu:", luluCostsResponse);
            throw new Error("Failed to retrieve valid print costs from Lulu API or cost was non-positive.");
        }
        console.log(`[Checkout] Lulu Print Cost (USD): $${luluPrintCostUSD.toFixed(4)}`);

        // 2. Refactoring the flat shipping rate lookup to a helper function
        const flatShippingRateAUD = getFlatShippingRate(trimmedAddress.country_code);
        
        // Convert flat shipping rate from AUD to USD (assuming Stripe is in USD)
        // 5. Improving currency conversion precision
        const flatShippingRateUSD = parseFloat((flatShippingRateAUD * AUD_TO_USD_EXCHANGE_RATE).toFixed(4));
        console.log(`[Checkout] Flat Shipping Rate (USD) converted from AUD: $${flatShippingRateUSD.toFixed(4)}`);

        // Calculate total price for Stripe in USD
        const finalPriceDollars = parseFloat((luluPrintCostUSD + flatShippingRateUSD + PROFIT_MARGIN_USD).toFixed(4));
        const finalPriceInCents = Math.round(finalPriceDollars * 100);

        console.log(`[Checkout] Final Pricing Breakdown (Picture Book):`);
        console.log(`  - Lulu Print Cost: $${luluPrintCostUSD.toFixed(2)} USD`);
        console.log(`  - Flat Shipping Cost: $${flatShippingRateUSD.toFixed(2)} USD (from $${flatShippingRateAUD.toFixed(2)} AUD)`);
        console.log(`  - Profit Margin: $${PROFIT_MARGIN_USD.toFixed(2)} USD`);
        console.log(`  - Total Price for Stripe: $${finalPriceDollars.toFixed(2)} USD (${finalPriceInCents} cents)`);
        
        const orderId = randomUUID();
        // 7. Ensure that database inserts use parameterized queries with proper types for price fields
        const insertOrderSql = `
            INSERT INTO orders (
                id, user_id, book_id, book_type, book_title, lulu_product_id, status, 
                total_price_usd, interior_pdf_url, cover_pdf_url, order_date, actual_page_count, is_fallback, 
                lulu_print_cost_usd, flat_shipping_cost_usd, profit_usd
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12, $13, $14, $15)`;

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
            finalPageCount, 
            false, 
            luluPrintCostUSD, 
            flatShippingRateUSD, 
            PROFIT_MARGIN_USD
        ]);
        console.log(`[Checkout] Created pending order record ${orderId} with final price.`);

        const session = await createStripeCheckoutSession(
            { 
                name: book.title, 
                description: `Inkwell AI Custom Picture Book - ${selectedProductConfig.name} (incl. shipping)`, 
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
        console.error("Failed to create checkout session (Picture Book):", error.stack);
        res.status(500).json({ message: "Failed to create checkout session." });
    } finally {
        if (client) client.release();
        // 8. Cleaning up temporary PDF files with more robust error handling and logs.
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
        // Shift page numbers for subsequent events
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