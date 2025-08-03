import { getDb } from '../db/database.js';
import { randomUUID } from 'crypto';
import { generateStoryFromApi } from '../services/gemini.service.js';
import { LULU_PRODUCT_CONFIGURATIONS, getCoverDimensionsFromApi, getPrintOptions, getPrintJobCosts, createLuluPrintJob } from '../services/lulu.service.js';
import { generateAndSaveTextBookPdf, generateCoverPdf, finalizePdfPageCount } from '../services/pdf.service.js';
import { uploadPdfFileToCloudinary } from '../services/image.service.js';
import { createStripeCheckoutSession } from '../services/stripe.service.js';
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
    'AF', 'AX', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AU', 'AT', 'AZ', 'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BQ', 'BA', 'BW', 'BV', 'BR', 'IO', 'BN', 'BG', 'BF', 'BI', 'CV', 'KH', 'CM', 'CA', 'KY', 'CF', 'TD', 'CL', 'CN', 'CX', 'CC', 'CO', 'KM', 'CD', 'CG', 'CK', 'CR', 'CI', 'HR', 'CU', 'CW', 'CY', 'CZ', 'DK', 'DJ', 'DM', 'DO', 'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET', 'FK', 'FO', 'FJ', 'FI', 'FR', 'GF', 'PF', 'TF', 'GA', 'GM', 'GE', 'DE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY', 'HT', 'HM', 'VA', 'HN', 'HK', 'HU', 'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IM', 'IL', 'IT', 'JM', 'JP', 'JE', 'JO', 'KZ', 'KE', 'KI', 'KP', 'KR', 'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MO', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MS', 'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'NC', 'NZ', 'NI', 'NE', 'NG', 'NU', 'NF', 'MP', 'NO', 'OM', 'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PN', 'PL', 'PT', 'PR', 'QA', 'MK', 'RO', 'RU', 'RW', 'RE', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SX', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS', 'SS', 'ES', 'LK', 'SD', 'SR', 'SJ', 'SE', 'CH', 'SY', 'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TK', 'TO', 'TT', 'TN', 'TR', 'TM', 'TC', 'TV', 'UG', 'UA', 'AE', 'GB', 'US', 'UM', 'UY', 'UZ', 'VU', 'VE', 'VN', 'VG', 'VI', 'WF', 'EH', 'YE', 'ZM', 'ZW'
]);

let printOptionsCache = null;

const FLAT_SHIPPING_RATES_AUD = {
    'US': 25.00,
    'CA': 25.00,
    'MX': 25.00,
    'AU': 15.00,
    'GB': 15.00,
    'DEFAULT': 35.00
};

const AUD_TO_USD_EXCHANGE_RATE = 0.66;

function getFlatShippingRate(countryCode) {
    const upperCaseCountryCode = countryCode.toUpperCase();
    let flatShippingRateAUD = FLAT_SHIPPING_RATES_AUD[upperCaseCountryCode];
    let isDefault = false;

    if (flatShippingRateAUD === undefined) {
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
        const finalPromptDetails = {
            ...promptDetails,
            wordsPerPage: selectedProductConfig.wordsPerPage,
            totalChapters: totalChaptersForBook,
            maxPageCount: effectiveMaxPageCount
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
    // Ensure shippingAddress is always an object, even if empty from frontend
    const shippingAddress = req.body.shippingAddress || {};
    let client;
    let tempInteriorPdfPath = null;
    let tempCoverPdfPath = null;

    const trimmedAddress = {
        name: shippingAddress.name ? shippingAddress.name.trim() : '',
        street1: shippingAddress.street1 ? shippingAddress.street1.trim() : '',
        street2: shippingAddress.street2 ? shippingAddress.street2.trim() : '', // Allow empty
        city: shippingAddress.city ? shippingAddress.city.trim() : '',
        state_code: shippingAddress.state_code ? shippingAddress.state_code.trim() : '', // Allow empty
        postcode: shippingAddress.postcode ? shippingAddress.postcode.trim() : '',
        country_code: shippingAddress.country_code ? shippingAddress.country_code.trim().toUpperCase() : '',
        // ADDED: Trim and include phone_number and email
        phone_number: shippingAddress.phone_number ? shippingAddress.phone_number.trim() : '',
        email: shippingAddress.email ? shippingAddress.email.trim() : '',
    };

    // Updated validation to include phone_number and email
    if (!trimmedAddress.name || !trimmedAddress.street1 || !trimmedAddress.city ||
        !trimmedAddress.postcode || !trimmedAddress.country_code ||
        !trimmedAddress.phone_number || !trimmedAddress.email) {
        console.error("Missing required shipping address fields:", trimmedAddress);
        // Provide specific error message for missing fields
        const missingFields = [];
        if (!trimmedAddress.name) missingFields.push('name');
        if (!trimmedAddress.street1) missingFields.push('street1');
        if (!trimmedAddress.city) missingFields.push('city');
        if (!trimmedAddress.postcode) missingFields.push('postcode');
        if (!trimmedAddress.country_code) missingFields.push('country_code');
        if (!trimmedAddress.phone_number) missingFields.push('phone_number');
        if (!trimmedAddress.email) missingFields.push('email');

        return res.status(400).json({
            message: `Shipping address is incomplete. Missing: ${missingFields.join(', ')}.`,
            detailedError: 'Please provide full name, street, city, postal code, country, phone number, and email for shipping.'
        });
    }

    if (!VALID_ISO_COUNTRY_CODES.has(trimmedAddress.country_code)) {
        return res.status(400).json({ message: `Invalid country code: ${trimmedAddress.country_code}. Please use a valid ISO Alpha-2 code.` });
    }

    console.log(`[Checkout] Initiating checkout for book ${bookId} to country: ${trimmedAddress.country_code}`);

    try {
        const pool = await getDb();
        client = await pool.connect();

        const book = await getFullTextBook(bookId, req.userId, client);
        if (!book) return res.status(404).json({ message: 'Text book not found.' });

        const selectedProductConfig = LULU_PRODUCT_CONFIGURATIONS.find(p => p.id === book.lulu_product_id);
        if (!selectedProductConfig) return res.status(400).json({ message: 'Invalid product ID.' });

        // --- Get the fixed base price from the configuration ---
        const productBasePriceUSD = selectedProductConfig.basePrice;

        console.log(`[Checkout] Generating PDFs for book ${bookId}...`);

        const { path: interiorPath, pageCount: trueContentPageCount } = await generateAndSaveTextBookPdf(book, selectedProductConfig);
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

        console.log("[Checkout] Fetching print costs from Lulu...");
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
            // Ensure phone_number and email are passed for Lulu cost calculation
            phone_number: trimmedAddress.phone_number,
            email: trimmedAddress.email,
        };

        let luluCostsResponse;
        try {
            luluCostsResponse = await getPrintJobCosts(printCostLineItems, luluShippingAddressForCost);
        } catch (luluError) {
            console.error(`[Checkout] Error fetching print costs from Lulu: ${luluError.message}. Error details:`, luluError.response?.data);
            // Enhanced error message for frontend
            let detailedLuluError = 'Failed to get print costs from publishing partner.';
            if (luluError.response && luluError.response.data && luluError.response.data.shipping_address?.detail?.errors) {
                const errorDetails = luluError.response.data.shipping_address.detail.errors.map(err => err.message || err.field).join('; ');
                detailedLuluError = `Shipping address validation failed with publishing partner: ${errorDetails}.`;
            } else if (luluError.message) {
                detailedLuluError += ` (Detail: ${luluError.message})`;
            }
            return res.status(503).json({ message: detailedLuluError, error: luluError.message });
        }

        if (!luluCostsResponse?.line_item_costs?.[0]?.total_cost_incl_tax) {
            console.error("[Checkout] Lulu API response missing expected structure:", luluCostsResponse);
            throw new Error("Failed to retrieve valid item print cost from Lulu API.");
        }
        const luluPrintCostAUD = parseFloat(luluCostsResponse.line_item_costs[0].total_cost_incl_tax);
        if (isNaN(luluPrintCostAUD) || luluPrintCostAUD <= 0) {
            console.error("[Checkout] Failed to parse or received invalid item print cost from Lulu:", luluCostsResponse);
            throw new Error("Failed to retrieve valid item print cost from Lulu API.");
        }

        const luluPrintCostUSD = luluPrintCostAUD * AUD_TO_USD_EXCHANGE_RATE;
        const flatShippingRateAUD = getFlatShippingRate(trimmedAddress.country_code);
        const flatShippingRateUSD = flatShippingRateAUD * AUD_TO_USD_EXCHANGE_RATE;

        // --- NEW PRICING LOGIC ---
        const finalPriceDollars = productBasePriceUSD + flatShippingRateUSD;
        // The `calculatedProfitUSD` variable must be defined before it's used
        const calculatedProfitUSD = productBasePriceUSD - luluPrintCostUSD; // Dynamic profit


        console.log(`[Checkout] Final Pricing Breakdown (Textbook):`);
        console.log(`  - Product Base Price: $${productBasePriceUSD.toFixed(2)} USD`);
        console.log(`  - Lulu Print Cost: -$${luluPrintCostUSD.toFixed(2)} USD`);
        console.log(`  - Calculated Profit: $${calculatedProfitUSD.toFixed(2)} USD`);
        console.log(`  - Flat Shipping Cost: +$${flatShippingRateUSD.toFixed(2)} USD`);
        console.log(`  -----------------------------------------`);
        // Log the actual dollar value, and cents for clarity in logs
        console.log(`  - Total Price for Stripe: $${finalPriceDollars.toFixed(2)} USD (${Math.round(finalPriceDollars * 100)} cents)`);

        const orderId = randomUUID();
        const insertOrderSql = `
            INSERT INTO orders (
                id, user_id, book_id, book_type, book_title, lulu_product_id, status,
                total_price, currency, interior_pdf_url, cover_pdf_url, created_at, actual_page_count, is_fallback,
                lulu_print_cost_usd, flat_shipping_cost_usd, profit_usd
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'USD', $9, $10, NOW(), $11, $12, $13, $14, $15)`;

        await client.query(insertOrderSql, [
            orderId, req.userId, bookId, 'textBook', book.title, luluSku, 'pending',
            parseFloat(finalPriceDollars.toFixed(2)), // CHANGED: Pass the dollar value, formatted to 2 decimal places to match NUMERIC(10, 2)
            interiorPdfUrl, coverPdfUrl, actualFinalPageCount, isPageCountFallback,
            luluPrintCostUSD, flatShippingRateUSD,
            calculatedProfitUSD
        ]);
        console.log(`[Checkout] Created pending order record ${orderId}.`);

        // For Stripe, we still need cents, so calculate it for the Stripe session
        const finalPriceInCentsForStripe = Math.round(finalPriceDollars * 100);

        const session = await createStripeCheckoutSession(
            {
                name: book.title,
                description: `Inkwell AI Custom Book - ${selectedProductConfig.name} (incl. shipping)`,
                priceInCents: finalPriceInCentsForStripe, // Use cents for Stripe
                currency: 'usd'
            },
            req.userId, orderId, bookId, 'textBook'
        );

        await client.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, orderId]);

        res.status(200).json({ url: session.url });

    } catch (error) {
        console.error(`[Checkout] Failed to create checkout session for textbook: ${error.stack}`);
        let detailedError = 'An unexpected error occurred during checkout.';
        // Attempt to extract more specific Lulu error messages
        if (error.response && error.response.data && error.response.data.shipping_address?.detail?.errors) {
             const errorDetails = error.response.data.shipping_address.detail.errors.map(err => err.message || err.field).join('; ');
             detailedError = `Shipping address validation failed with publishing partner: ${errorDetails}.`;
        } else if (error.message.includes('Lulu')) {
            detailedError = error.message;
            if (error.response && error.response.data) {
                detailedError += ` (Lulu response: ${JSON.stringify(error.response.data)})`;
            }
        } else if (error.message.includes('shipping_address')) {
            detailedError = 'The shipping address provided is invalid. Please check all fields and ensure they are correct.';
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