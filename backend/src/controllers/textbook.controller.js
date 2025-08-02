// backend/src/controllers/textbook.controller.js

// CHANGES:
// - B. Clamped maxPageCount passed into story generation for more realistic budgeting.
// - B. Improved validation of generated PDF page count: Handles null pageCount, checks against maxPageCount.
// - Corrected typo in getFlatShippingRate for FLAT_SHIPPING_RATES_AUD lookup.
// - FIX: Added JSON.parse for book.prompt_details in generateNextChapter to correctly retrieve saved prompt parameters.
// - FIX: Integrated new finalizePdfPageCount helper to handle PDF padding and even-page count using pdf-lib after initial content generation.
// - FIX: Added robust logging for full Lulu print cost response and a more defensive check for print_costs structure.
// - ADDED phone_number field to shipping address for Lulu API.
// - CRITICAL FIX: Corrected currency mismatch: Lulu print cost is now explicitly converted from AUD to USD before summing with other USD costs.
// - REFINEMENT: Clarified `isPageCountFallback` variable naming for order record persistence.
// - REFINEMENT: Refined error messages for page count validation to be more specific.
// - REFINEMENT: Added comment about prompt injection risk mitigation for previousChaptersText (already done in gemini.service.js).
// - REFINEMENT: Added comment about phone_number field validation best practices.

import { getDb } from '../db/database.js';
import { randomUUID } from 'crypto';
import { generateStoryFromApi } from '../services/gemini.service.js';
import { LULU_PRODUCT_CONFIGURATIONS, getCoverDimensionsFromApi, getPrintOptions, getPrintJobCosts, createLuluPrintJob } from '../services/lulu.service.js'; 
import { generateAndSaveTextBookPdf, generateCoverPdf, finalizePdfPageCount } from '../services/pdf.service.js'; // Import new helper
import { uploadPdfFileToCloudinary } from '../services/image.service.js';
import { createStripeCheckoutSession } from '../services/stripe.service.js';
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


let printOptionsCache = null;
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
const AUD_TO_USD_EXCHANGE_RATE = 0.66; // Current approximate rate at 2025-08-02

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
        // Corrected typo: should be FLAT_SHIPPING_RATES_AUD, not FLAT_SHIPPING_RATES_ATUD
        flatShippingRateAUD = FLAT_SHIPPING_RATES_AUD['DEFAULT']; 
        isDefault = true;
    }

    if (isDefault) {
        console.warn(`[Shipping Calculation] No specific flat shipping rate found for country code: ${upperCaseCountryCode}. Using default rate: $${flatShippingRateAUD.toFixed(2)} AUD.`);
    } else {
        console.log(`[Shipping Calculation] Flat Shipping Rate (AUD) for ${upperCaseCountryCode}: $${flatShippingRateAUD.toFixed(2)}`);
    }
    return flatShippingRateAUD;
}


async function getFullTextBook(bookId, userId, client) {
    const bookResult = await client.query(`SELECT * FROM text_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
    const book = bookResult.rows[0];
    if (!book) return null;

    const chaptersResult = await client.query(`SELECT * FROM chapters WHERE book_id = $1 ORDER BY chapter_number ASC`, [bookId]);
    book.chapters = chaptersResult.rows;
    return book;
}

export const createTextBook = async (req, res) => {
    let client;
    const { title, promptDetails, luluProductId } = req.body;
    const userId = req.userId;
    try {
        const pool = await getDb();
        client = await pool.connect();
        const selectedProductConfig = LULU_PRODUCT_CONFIGURATIONS.find(p => p.id === luluProductId);
        if (!selectedProductConfig) {
            return res.status(400).json({ message: `Product configuration with ID ${luluProductId} not found.` });
        }
        const totalChaptersForBook = selectedProductConfig.totalChapters;
        
        // B. Clamp or derive a sane maxPageCount before passing into story generation
        // Ensures maxPageCount passed to AI is not absurdly high, preferring defaultPageCount + slack
        const effectiveMaxPageCount = Math.min(
            selectedProductConfig.maxPageCount, // Cap at product's absolute max
            Math.max(
                selectedProductConfig.defaultPageCount, // At least default
                Math.ceil(selectedProductConfig.defaultPageCount * 1.5) // Allow 50% slack above default
            )
        );
        console.log(`[Textbook Controller] Using effectiveMaxPageCount for AI prompt: ${effectiveMaxPageCount} (from product max: ${selectedProductConfig.maxPageCount}, default: ${selectedProductConfig.defaultPageCount})`);

        const bookId = randomUUID();
        const currentDate = new Date().toISOString();
        const finalPromptDetails = {
            ...promptDetails, // This should already contain recipientName and characterName from frontend
            wordsPerPage: selectedProductConfig.wordsPerPage,
            totalChapters: totalChaptersForBook,
            maxPageCount: effectiveMaxPageCount // Use the clamped value here
        };
        const bookSql = `INSERT INTO text_books (id, user_id, title, prompt_details, lulu_product_id, date_created, last_modified, total_chapters) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
        await client.query(bookSql, [bookId, userId, title, JSON.stringify(finalPromptDetails), luluProductId, currentDate, currentDate, totalChaptersForBook]);
        const firstChapterText = await generateStoryFromApi({
            ...finalPromptDetails,
            chapterNumber: 1,
            isFinalChapter: totalChaptersForBook === 1
        });
        const chapterSql = `INSERT INTO chapters (book_id, chapter_number, content, date_created) VALUES ($1, 1, $2, $3)`;
        await client.query(chapterSql, [bookId, firstChapterText, currentDate]);
        res.status(201).json({
            message: 'Project created and first chapter generated.',
            bookId: bookId,
            firstChapter: firstChapterText,
            totalChapters: totalChaptersForBook,
        });
    } catch (error) {
        console.error('Error creating text book:', error);
        res.status(500).json({ message: 'Failed to create text book project.' });
    } finally {
        if (client) client.release();
    }
};

export const generateNextChapter = async (req, res) => {
    let client;
    const { bookId } = req.params;
    const userId = req.userId;
    try {
        const pool = await getDb();
        client = await pool.connect();
        const book = await getFullTextBook(bookId, userId, client);
        if (!book) return res.status(404).json({ message: 'Book project not found.' });

        // FIX: Parse prompt_details from JSON string to object
        let parsedPromptDetails;
        try {
            parsedPromptDetails = JSON.parse(book.prompt_details);
            // Debugging line to confirm parsed content (remove in production)
            console.log('[DEBUG generateNextChapter] Parsed prompt_details:', parsedPromptDetails); 
        } catch (parseError) {
            console.error(`[Textbook Controller] Error parsing prompt_details for book ${book.id}:`, parseError);
            return res.status(500).json({ message: 'Failed to parse book prompt details.' });
        }

        const selectedProductConfig = LULU_PRODUCT_CONFIGURATIONS.find(p => p.id === book.lulu_product_id);
        if (!selectedProductConfig) {
            return res.status(400).json({ message: 'Could not find product configuration for this book.' });
        }
        const chapters = book.chapters;
        const previousChaptersText = chapters.map(c => c.content).join('\n\n---\n\n');
        // REFINEMENT: previousChaptersText is sanitized in gemini.service.js, so no need to repeat here.
        const nextChapterNumber = chapters.length + 1;
        const isFinalChapter = nextChapterNumber >= book.total_chapters;

        // B. Clamp or derive a sane maxPageCount before passing into story generation
        const effectiveMaxPageCount = Math.min(
            selectedProductConfig.maxPageCount,
            Math.max(
                selectedProductConfig.defaultPageCount,
                Math.ceil(selectedProductConfig.defaultPageCount * 1.5)
            )
        );
        console.log(`[Textbook Controller] Using effectiveMaxPageCount for AI prompt: ${effectiveMaxPageCount} (from product max: ${selectedProductConfig.maxPageCount}, default: ${selectedProductConfig.defaultPageCount})`);

        const finalPromptDetails = {
            ...parsedPromptDetails, // <-- Use the parsed object here
            wordsPerPage: selectedProductConfig.wordsPerPage,
            totalChapters: selectedProductConfig.totalChapters,
            maxPageCount: effectiveMaxPageCount // Use the clamped value here
        };
        const newChapterText = await generateStoryFromApi({
            ...finalPromptDetails,
            previousChaptersText: previousChaptersText,
            chapterNumber: nextChapterNumber,
            isFinalChapter: isFinalChapter,
        });
        const currentDate = new Date().toISOString();
        const chapterSql = `INSERT INTO chapters (book_id, chapter_number, content, date_created) VALUES ($1, $2, $3, $4)`;
        await client.query(chapterSql, [bookId, nextChapterNumber, newChapterText, currentDate]);
        await client.query(`UPDATE text_books SET last_modified = $1 WHERE id = $2`, [currentDate, bookId]);
        res.status(201).json({
            message: `Chapter ${nextChapterNumber} generated.`,
            newChapter: newChapterText,
            chapterNumber: nextChapterNumber,
            isStoryComplete: isFinalChapter,
        });
    } catch (error) {
        console.error(`Error generating chapter for book ${bookId}:`, error);
        res.status(500).json({ message: 'Failed to generate next chapter.' });
    } finally {
        if (client) client.release();
    }
};

export const getTextBooks = async (req, res) => {
    let client;
    const userId = req.userId;
    try {
        const pool = await getDb();
        client = await pool.connect();
        const booksResult = await client.query(`
            SELECT tb.id, tb.title, tb.last_modified, tb.lulu_product_id, tb.is_public, tb.cover_image_url, tb.total_chapters, tb.prompt_details
            FROM text_books tb
            WHERE tb.user_id = $1
            ORDER BY tb.last_modified DESC`, [userId]);
        const books = booksResult.rows;
        if (!printOptionsCache) {
            printOptionsCache = await getPrintOptions();
        }
        const booksWithData = books.map(book => {
            const productConfig = printOptionsCache.find(p => p.id === book.lulu_product_id);
            return { 
                ...book, 
                productName: productConfig ? productConfig.name : 'Unknown Book', 
                type: productConfig ? productConfig.type : 'textBook'
            };
        });
        res.status(200).json(booksWithData);
    } catch (error) {
        console.error('Error fetching text books:', error);
        res.status(500).json({ message: 'Failed to fetch text book project.' });
    } finally {
        if (client) client.release();
    }
};

export const getTextBookDetails = async (req, res) => {
    let client;
    const { bookId } = req.params;
    const userId = req.userId;
    try {
        const pool = await getDb();
        client = await pool.connect();
        const book = await getFullTextBook(bookId, userId, client);
        if (!book) return res.status(404).json({ message: 'Book project not found.' });
        res.status(200).json({ book, chapters: book.chapters });
    }
    catch (error) {
        console.error(`Error fetching details for book ${bookId}:`, error);
        res.status(500).json({ message: 'Failed to fetch book details.' });
    } finally {
        if (client) client.release();
    }
};

export const createCheckoutSessionForTextBook = async (req, res) => {
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
    console.log(`[Checkout] Initiating checkout for book ${bookId} to country: ${trimmedAddress.country_code}`);


    try {
        const pool = await getDb();
        client = await pool.connect();
        
        const book = await getFullTextBook(bookId, req.userId, client);
        if (!book) return res.status(404).json({ message: 'Text book not found.' });
        
        const selectedProductConfig = LULU_PRODUCT_CONFIGURATIONS.find(p => p.id === book.lulu_product_id);
        if (!selectedProductConfig) return res.status(400).json({ message: 'Invalid product ID.' });
        
        console.log(`[Checkout] Generating PDFs for book ${bookId}...`);
        
        // First Pass: Generate content PDF and get its true page count
        const { path: interiorPath, pageCount: trueContentPageCount } = await generateAndSaveTextBookPdf(book, selectedProductConfig);
        tempInteriorPdfPath = interiorPath;
        console.log(`[Checkout] Content PDF generation complete. True content page count is ${trueContentPageCount}.`);
        
        let actualFinalPageCount = trueContentPageCount; // Start with the content page count
        let isPageCountFallback = false;

        // Handle case where trueContentPageCount from pdf-lib failed
        if (trueContentPageCount === null) {
            console.warn(`[Checkout] True content page count was null. Falling back to product's defaultPageCount: ${selectedProductConfig.defaultPageCount}`);
            actualFinalPageCount = selectedProductConfig.defaultPageCount;
            isPageCountFallback = true;
        }

        // Second Pass: Pad and finalize the PDF using pdf-lib
        const finalPaddedPageCount = await finalizePdfPageCount(tempInteriorPdfPath, selectedProductConfig, actualFinalPageCount);
        if (finalPaddedPageCount === null) {
            console.error(`[Checkout] Failed to finalize PDF page count (padding/evenness).`);
            return res.status(500).json({ message: 'Failed to finalize book PDF for printing.' });
        }
        actualFinalPageCount = finalPaddedPageCount; // Use the count after padding and evenness
        console.log(`[Checkout] PDF finalization complete. Final padded page count is ${actualFinalPageCount}.`);


        // B. Improved validation of generated PDF page count
        // The PDF is now guaranteed to meet minPageCount due to finalizePdfPageCount.
        // So, we primarily check against maxPageCount.
        if (actualFinalPageCount > selectedProductConfig.maxPageCount) {
            const errorMessage = `This book has ${actualFinalPageCount} pages, which exceeds the maximum allowed for this format (${selectedProductConfig.maxPageCount} pages). Please consider a different product or reducing content length.`;
            console.error("[Checkout] Failed: Page count exceeded max limit.", { bookId, finalPageCount: actualFinalPageCount, product: selectedProductConfig.id });
            return res.status(400).json({ message: errorMessage });
        }
        if (actualFinalPageCount < selectedProductConfig.minPageCount) {
            // This should ideally only be hit if padding logic in PDF service failed, or if finalPageCount was null AND default/min is also insufficient.
            const errorMessage = `Generated book page count (${actualFinalPageCount}) is below the minimum required for this format (${selectedProductConfig.minPageCount}). This indicates an issue with PDF generation or unexpected content. Please generate more content or try a different product.`;
            console.error("[Checkout] ERROR: Page count still below minimum after PDF generation/fallback.", { bookId, finalPageCount: actualFinalPageCount, product: selectedProductConfig.id });
            return res.status(400).json({ message: errorMessage });
        }


        const interiorPdfUrl = await uploadPdfFileToCloudinary(tempInteriorPdfPath, `inkwell-ai/user_${req.userId}/books`, `book_${bookId}_interior`);
        
        const luluSku = selectedProductConfig.luluSku;
        const coverDimensions = await getCoverDimensionsFromApi(luluSku, actualFinalPageCount); // Use actualFinalPageCount
        tempCoverPdfPath = await generateCoverPdf(book, selectedProductConfig, coverDimensions);
        const coverPdfUrl = await uploadPdfFileToCloudinary(tempCoverPdfPath, `inkwell-ai/user_${req.userId}/covers`, `book_${bookId}_cover`);
        console.log(`[Checkout] PDFs uploaded to Cloudinary.`);

        console.log("[Checkout] Fetching print costs from Lulu (shipping excluded from Lulu cost calculation)...");
        // We still call getPrintJobCosts as it gives us the base print cost for the product
        // based on page count, even if we use a flat rate for shipping.
        const printCostLineItems = [{ 
            pod_package_id: luluSku, 
            page_count: actualFinalPageCount, // Use actualFinalPageCount
            quantity: 1 
        }];
        
        // Lulu's API for print job cost calculation generally requires a full shipping address.
        // We pass the actual shipping address provided by the user.
        // We will then extract only the print cost and add our flat shipping rate.
        const luluShippingAddressForCost = { 
            name: trimmedAddress.name,
            street1: trimmedAddress.street1,
            street2: trimmedAddress.street2,
            city: trimmedAddress.city,
            state_code: trimmedAddress.state_code || '', // State code might be optional for some countries
            postcode: trimmedAddress.postcode,
            country_code: trimmedAddress.country_code,
            phone_number: shippingAddress.phone_number ? shippingAddress.phone_number.trim() : '000-000-0000', // ADDED phone_number field
        };

        let luluCostsResponse;
        try {
            // 4. Error handling for Lulu’s getPrintJobCosts
            luluCostsResponse = await getPrintJobCosts(printCostLineItems, luluShippingAddressForCost);
            // DEBUG: Log the full Lulu response here to inspect its structure
            console.log('[DEBUG Checkout] Full Lulu costs response for inspection:', JSON.stringify(luluCostsResponse, null, 2));
        } catch (luluError) {
            console.error(`[Checkout] Error fetching print costs from Lulu: ${luluError.message}. This might require a retry strategy or clearer user feedback.`);
            // CONSIDER: Implement retry logic here using a library like 'p-retry'
            return res.status(503).json({ message: 'Failed to get print costs from publishing partner. Please try again shortly.', error: luluError.message });
        }

        // Defensive check before parsing Lulu's response for print costs
        if (!luluCostsResponse || !Array.isArray(luluCostsResponse.line_item_costs) || luluCostsResponse.line_item_costs.length === 0 || luluCostsResponse.line_item_costs[0].total_cost_incl_tax === undefined || typeof parseFloat(luluCostsResponse.line_item_costs[0].total_cost_incl_tax) !== 'number') {
            console.error("[Checkout] Lulu API response missing expected 'line_item_costs[0].total_cost_incl_tax' structure or is empty/invalid type:", luluCostsResponse);
            throw new Error("Failed to retrieve valid item print cost from Lulu API: Unexpected response structure or missing cost.");
        }
        // Corrected access path for Lulu Print Cost
        const luluPrintCostAUD = parseFloat(luluCostsResponse.line_item_costs[0].total_cost_incl_tax); // Lulu returns AUD
        if (isNaN(luluPrintCostAUD) || luluPrintCostAUD <= 0) { // Also check for non-positive cost
            console.error("[Checkout] Failed to parse or received invalid (non-positive) item print cost from Lulu:", luluCostsResponse);
            throw new Error("Failed to retrieve valid item print cost from Lulu API or cost was non-positive.");
        }
        console.log(`[Checkout] Lulu Print Cost (AUD): $${luluPrintCostAUD.toFixed(4)}`); // More precision

        // CONVERSION: Convert Lulu Print Cost from AUD to USD
        const luluPrintCostUSD = parseFloat((luluPrintCostAUD * AUD_TO_USD_EXCHANGE_RATE).toFixed(4));
        console.log(`[Checkout] Converted Lulu Print Cost (USD): $${luluPrintCostUSD.toFixed(4)}`);


        // 2. Refactoring the flat shipping rate lookup to a helper function
        const flatShippingRateAUD = getFlatShippingRate(trimmedAddress.country_code);
        
        // Convert flat shipping rate from AUD to USD (assuming Stripe is in USD)
        // 5. Improving currency conversion precision
        const flatShippingRateUSD = parseFloat((flatShippingRateAUD * AUD_TO_USD_EXCHANGE_RATE).toFixed(4));
        console.log(`[Checkout] Flat Shipping Rate (USD) converted from AUD: $${flatShippingRateUSD.toFixed(4)}`);

        // Calculate total price for Stripe in USD
        // total = Lulu Print Cost (USD) + Flat Shipping Rate (USD) + Your Profit Margin (USD)
        const finalPriceDollars = parseFloat((luluPrintCostUSD + flatShippingRateUSD + PROFIT_MARGIN_USD).toFixed(4));
        const finalPriceInCents = Math.round(finalPriceDollars * 100);

        console.log(`[Checkout] Final Pricing Breakdown:`);
        console.log(`  - Lulu Print Cost: $${luluPrintCostUSD.toFixed(2)} USD (from $${luluPrintCostAUD.toFixed(2)} AUD)`); // Log both AUD & USD
        console.log(`  - Flat Shipping Cost: $${flatShippingRateUSD.toFixed(2)} USD (from $${flatShippingRateAUD.toFixed(2)} AUD)`);
        console.log(`  - Profit Margin: $${PROFIT_MARGIN_USD.toFixed(2)} USD`);
        console.log(`  - Total Price for Stripe: $${finalPriceDollars.toFixed(2)} USD (${finalPriceInCents} cents)`);
        
        const orderId = randomUUID();
        // 7. Ensure that database inserts use parameterized queries with proper types for price fields
        // Store decimals as numbers (numeric/decimal in PG), not strings.
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
            'textBook', 
            book.title, 
            luluSku, 
            'pending', 
            finalPriceDollars, // Store as number
            interiorPdfUrl, 
            coverPdfUrl, 
            actualFinalPageCount, // Use actualFinalPageCount
            isPageCountFallback, // Store if fallback was used
            luluPrintCostUSD, // Store as number
            flatShippingRateUSD, // Store as number
            PROFIT_MARGIN_USD // Store as number
        ]);
        console.log(`[Checkout] Created pending order record ${orderId} with final price.`);

        const session = await createStripeCheckoutSession(
            { 
                name: book.title, 
                description: `Inkwell AI Custom Book - ${selectedProductConfig.name} (incl. shipping)`, 
                priceInCents: finalPriceInCents
            },
            req.userId,
            orderId,
            bookId,
            'textBook'
        );
        
        await client.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, orderId]);
        
        res.status(200).json({ url: session.url });

    } catch (error) {
        console.error(`[Checkout] Failed to create checkout session for textbook: ${error.stack}`);
        res.status(500).json({ message: 'Failed to create checkout session.', error: error.message });
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

export const deleteTextBook = async (req, res) => {
    let client;
    const { bookId } = req.params;
    const userId = req.userId;
    try {
        const pool = await getDb();
        client = await pool.connect();
        await client.query('BEGIN');
        const bookResult = await client.query(`SELECT id FROM text_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        const book = bookResult.rows[0];
        if (!book) {
            return res.status(404).json({ message: 'Project not found or you are not authorized to delete it.' });
        }
        await client.query(`DELETE FROM chapters WHERE book_id = $1`, [bookId]);
        await client.query(`DELETE FROM text_books WHERE id = $1`, [bookId]);
        await client.query('COMMIT');
        res.status(200).json({ message: 'Text book project and all its chapters have been deleted.' });
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error(`Error deleting text book ${bookId}:`, error);
        res.status(500).json({ message: 'Failed to delete project.' });
    } finally {
        if (client) client.release();
    }
};

export const toggleTextBookPrivacy = async (req, res) => {
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
        const bookResult = await client.query(`SELECT id, user_id FROM text_books WHERE id = $1`, [bookId]);
        const book = bookResult.rows[0];
        if (!book) {
            return res.status(404).json({ message: 'Project not found.' });
        }
        if (book.user_id !== userId) {
            return res.status(403).json({ message: 'You are not authorized to edit this project.' });
        }
        await client.query(`UPDATE text_books SET is_public = $1 WHERE id = $2`, [is_public, bookId]);
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