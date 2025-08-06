// backend/src/controllers/textbook.controller.js

import { getDb } from '../db/database.js';
import { randomUUID } from 'crypto';
import { generateStoryFromApi } from '../services/gemini.service.js';
import { LULU_PRODUCT_CONFIGURATIONS, getCoverDimensionsFromApi, getPrintOptions, getPrintJobCosts, createLuluPrintJob } from '../services/lulu.service.js';
import { generateAndSaveTextBookPdf, generateCoverPdf, finalizePdfPageCount } from '../services/pdf.service.js';
import { uploadPdfFileToCloudinary } from '../services/image.service.js';
import { createStripeCheckoutSession } from '../services/stripe.service.js';
import jsonwebtoken from 'jsonwebtoken';
import path from 'path';
import fs from 'fs/promises';

const AUD_TO_USD_EXCHANGE_RATE = 0.66;
const JWT_QUOTE_SECRET = process.env.JWT_QUOTE_SECRET || 'your_super_secret_jwt_quote_key_please_change_this_in_production';

const FALLBACK_SHIPPING_OPTION = {
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

const VALID_ISO_COUNTRY_CODES = new Set([
    'AF', 'AX', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AU', 'AT', 'AZ', 'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BQ', 'BA', 'BW', 'BV', 'BR', 'IO', 'BN', 'BG', 'BF', 'BI', 'CV', 'KH', 'CM', 'CA', 'KY', 'CF', 'TD', 'CL', 'CN', 'CX', 'CC', 'CO', 'KM', 'CD', 'CG', 'CK', 'CR', 'CI', 'HR', 'CU', 'CW', 'CY', 'CZ', 'DK', 'DJ', 'DM', 'DO', 'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET', 'FK', 'FO', 'FJ', 'FI', 'FR', 'GF', 'PF', 'TF', 'GA', 'GM', 'GE', 'DE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY', 'HT', 'HM', 'VA', 'HN', 'HK', 'HU', 'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IM', 'IL', 'IT', 'JM', 'JP', 'JE', 'JO', 'KZ', 'KE', 'KI', 'KP', 'KR', 'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MO', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MS', 'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'NC', 'NZ', 'NI', 'NE', 'NG', 'NU', 'NF', 'MP', 'NO', 'OM', 'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PN', 'PL', 'PT', 'PR', 'QA', 'MK', 'RO', 'RU', 'RW', 'RE', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SX', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS', 'SS', 'ES', 'LK', 'SD', 'SR', 'SJ', 'SE', 'CH', 'SY', 'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TK', 'TO', 'TT', 'TN', 'TR', 'TM', 'TC', 'TV', 'UG', 'UA', 'AE', 'GB', 'US', 'UM', 'UY', 'UZ', 'VU', 'VE', 'VN', 'VG', 'VI', 'WF', 'EH', 'YE', 'ZM', 'ZW'
]);

let printOptionsCache = null;

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
    
    // --- NEW: Add validation to prevent server errors from missing data ---
    if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ message: 'Book title is required.' });
    }
    if (!luluProductId) {
        return res.status(400).json({ message: 'Lulu product ID is required.' });
    }
    if (!promptDetails || !promptDetails.wordsPerPage || !promptDetails.totalChapters || !promptDetails.maxPageCount) {
        return res.status(400).json({ message: 'wordsPerPage, totalChapters, and maxPageCount are required for story generation.' });
    }
    // --- END NEW VALIDATION ---
    
    try {
        const pool = await getDb();
        client = await pool.connect();
        const selectedProductConfig = LULU_PRODUCT_CONFIGURATIONS.find(p => p.id === luluProductId);
        if (!selectedProductConfig) {
            return res.status(400).json({ message: `Product configuration with ID ${luluProductId} not found.` });
        }
        const totalChaptersForBook = selectedProductConfig.totalChapters;

        const effectiveMaxPageCount = Math.min(
            selectedProductConfig.maxPageCount,
            Math.max(
                selectedProductConfig.defaultPageCount,
                Math.ceil(selectedProductConfig.defaultPageCount * 1.5)
            )
        );
        console.log(`[Textbook Controller] Using effectiveMaxPageCount for AI prompt: ${effectiveMaxPageCount}`);

        const bookId = randomUUID();
        const currentDate = new Date().toISOString();
        const bookSql = `INSERT INTO text_books (id, user_id, title, prompt_details, lulu_product_id, date_created, last_modified, total_chapters) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
        await client.query(bookSql, [bookId, userId, title, JSON.stringify(promptDetails), luluProductId, currentDate, currentDate, totalChaptersForBook]);

        const firstChapterText = await generateStoryFromApi({
            ...promptDetails,
            wordsPerPage: selectedProductConfig.wordsPerPage,
            totalChapters: selectedProductConfig.totalChapters,
            maxPageCount: effectiveMaxPageCount,
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

        let parsedPromptDetails;
        try {
            parsedPromptDetails = JSON.parse(book.prompt_details);
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
        const nextChapterNumber = chapters.length + 1;
        const isFinalChapter = nextChapterNumber >= book.total_chapters;

        const effectiveMaxPageCount = Math.min(
            selectedProductConfig.maxPageCount,
            Math.max(
                selectedProductConfig.defaultPageCount,
                Math.ceil(selectedProductConfig.defaultPageCount * 1.5)
            )
        );
        console.log(`[Textbook Controller] Using effectiveMaxPageCount for AI prompt: ${effectiveMaxPageCount}`);

        const finalPromptDetails = {
            ...parsedPromptDetails,
            wordsPerPage: selectedProductConfig.wordsPerPage,
            totalChapters: selectedProductConfig.totalChapters,
            maxPageCount: effectiveMaxPageCount
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
        const book = await getFullTextBook(bookId, req.userId, client);
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
    const { shippingAddress, selectedShippingLevel, quoteToken } = req.body;
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

    console.log(`[Checkout] Initiating checkout for book ${bookId} to country: ${trimmedAddress.country_code} with shipping level: ${selectedShippingLevel}`);

    try {
        let decodedQuote;
        try {
            decodedQuote = jsonwebtoken.verify(quoteToken, JWT_QUOTE_SECRET);
            console.log('[Checkout] Quote token verified successfully.');
        } catch (tokenError) {
            console.error('[Checkout ERROR] Quote token verification failed:', tokenError.message);
            return res.status(403).json({ message: 'Invalid or expired shipping quote. Please get a new quote.' });
        }

        if (decodedQuote.bookId !== bookId || decodedQuote.bookType !== 'textBook' || decodedQuote.pageCount === undefined || decodedQuote.luluSku === undefined) {
            console.error('[Checkout ERROR] Quote token content mismatch:', { requestBookId: bookId, decoded: decodedQuote });
            return res.status(400).json({ message: 'Shipping quote details do not match the selected book.' });
        }
        if (decodedQuote.shippingAddress.country_code !== trimmedAddress.country_code ||
            decodedQuote.shippingAddress.postcode !== trimmedAddress.postcode) {
            console.warn('[Checkout WARNING] Quote token address mismatch (country/postcode). Proceeding but noted:', { decodedAddress: decodedQuote.shippingAddress, currentAddress: trimmedAddress });
        }

        const pool = await getDb();
        client = await pool.connect();

        const book = await getFullTextBook(bookId, req.userId, client);
        if (!book) return res.status(404).json({ message: 'Text book not found.' });

        const selectedProductConfig = LULU_PRODUCT_CONFIGURATIONS.find(p => p.id === book.lulu_product_id);
        if (!selectedProductConfig) return res.status(400).json({ message: 'Invalid product ID.' });

        console.log(`[Checkout] Re-generating PDFs for book ${bookId} for final order...`);
        const { path: interiorPath, pageCount: trueContentPageCount } = await generateAndSaveTextBookPdf(book, selectedProductConfig);
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
            const errorMessage = `This book has ${actualFinalPageCount} pages, which exceeds the maximum allowed for this format (${selectedProductConfig.maxPageCount} pages).`;
            console.error("[Checkout] Failed: Page count exceeded max limit.", { bookId, finalPageCount: actualFinalPageCount, product: selectedProductConfig.id });
            return res.status(400).json({ message: errorMessage });
        }
        if (actualFinalPageCount < selectedProductConfig.minPageCount) {
            const errorMessage = `Generated book page count (${actualFinalPageCount}) is below the minimum required for this format (${selectedProductConfig.minPageCount}).`;
            console.error("[Checkout] ERROR: Page count still below minimum.", { bookId, finalPageCount: actualFinalPageCount, product: selectedProductConfig.id });
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
            page_count: actualFinalFinalPageCount,
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
            email: trimmedAddress.email,
        };

        let luluCostsResponse;
        let luluShippingCostUSD;
        const isFallback = selectedShippingLevel === FALLBACK_SHIPPING_OPTION.level;
        const PROFIT_MARGIN_USD = selectedProductConfig.basePrice * 0.5;

        if (isFallback) {
            console.log(`[Checkout] Using fallback shipping rate. Probing Lulu for print and fulfillment costs with a valid shipping level.`);
            const validLuluLevelForProbe = 'MAIL';
            try {
                luluCostsResponse = await getPrintJobCosts(printCostLineItems, luluShippingAddressForCost, validLuluLevelForProbe);
                luluShippingCostUSD = FALLBACK_SHIPPING_OPTION.costUsd;
            } catch (luluError) {
                console.error(`[Checkout] Error getting Lulu print/fulfillment cost during fallback: ${luluError.message}. Using dummy print/fulfillment costs.`);
                luluCostsResponse = {
                    lineItemCosts: [{ total_cost_incl_tax: (selectedProductConfig.basePrice / AUD_TO_USD_EXCHANGE_RATE) * 0.7 }],
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
                        const fallbackLuluCostsResponse = await getPrintJobCosts(printCostLineItems, luluShippingAddressForCost, 'MAIL');
                        luluCostsResponse.lineItemCosts = fallbackLuluCostsResponse.lineItemCosts;
                        luluCostsResponse.fulfillmentCost = fallbackLuluCostsResponse.fulfillmentCost;
                        luluShippingCostUSD = 0;
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

        console.log(`[Checkout] Final Pricing Breakdown (Textbook):`);
        console.log(`    - Product Retail Price: $${selectedProductConfig.basePrice.toFixed(2)} USD`);
        console.log(`    - Lulu Print Cost: $${luluPrintCostUSD.toFixed(2)} USD (from $${luluPrintCostAUD.toFixed(2)} AUD)`);
        console.log(`    - Dynamic Shipping Cost (${selectedShippingLevel}): $${luluShippingCostUSD.toFixed(2)} USD`);
        console.log(`    - Fulfillment Cost: $${luluFulfillmentCostUSD.toFixed(2)} USD (from $${luluFulfillmentCostAUD.toFixed(2)} AUD)`);
        console.log(`    -----------------------------------------`);
        console.log(`    - Total Price for Stripe: $${finalPriceDollars.toFixed(2)} USD (${finalPriceInCents} cents)`);

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
            'textBook',
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
                description: `Inkwell AI Custom Book - ${selectedProductConfig.name} (${selectedShippingLevel} shipping)`,
                priceInCents: finalPriceInCentsForStripe
            },
            trimmedAddress,
            req.userId, orderId, bookId, 'textBook'
        );

        await client.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, orderId]);

        res.status(200).json({ url: session.url });

    } catch (error) {
        console.error(`[Checkout] Failed to create checkout session for textbook: ${error.stack}`);
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