// backend/src/controllers/shipping.controller.js

import { getDb } from '../db/database.js';
import { LULU_PRODUCT_CONFIGURATIONS, getLuluShippingOptionsAndCosts } from '../services/lulu.service.js';
import { generateAndSaveTextBookPdf, generateAndSavePictureBookPdf, finalizePdfPageCount } from '../services/pdf.service.js';
import jsonwebtoken from 'jsonwebtoken';
import fs from 'fs/promises';
import path from 'path';

const AUD_TO_USD_EXCHANGE_RATE = 0.66;
const JWT_QUOTE_SECRET = process.env.JWT_QUOTE_SECRET || 'your_super_secret_jwt_quote_key_please_change_this_in_production';
const QUOTE_TOKEN_EXPIRY_MINUTES = 10;

const FALLBACK_SHIPPING_OPTION = {
    level: 'FALLBACK_STANDARD',
    name: 'Standard Shipping (Fallback)',
    costUsd: 15.00, // Example fixed cost in USD
    estimatedDeliveryDate: '7-21 business days',
    isFallback: true // Flag to indicate this is a fallback option
};

const VALID_ISO_COUNTRY_CODES = new Set([
    'AF', 'AX', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AU', 'AT', 'AZ', 'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BQ', 'BA', 'BW', 'BV', 'BR', 'IO', 'BN', 'BG', 'BF', 'BI', 'CV', 'KH', 'CM', 'CA', 'KY', 'CF', 'TD', 'CL', 'CN', 'CX', 'CC', 'CO', 'KM', 'CD', 'CG', 'CK', 'CR', 'CI', 'HR', 'CU', 'CW', 'CY', 'CZ', 'DK', 'DJ', 'DM', 'DO', 'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET', 'FK', 'FO', 'FJ', 'FI', 'FR', 'GF', 'PF', 'TF', 'GA', 'GM', 'GE', 'DE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY', 'HT', 'HM', 'VA', 'HN', 'HK', 'HU', 'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IM', 'IL', 'IT', 'JM', 'JP', 'JE', 'JO', 'KZ', 'KE', 'KI', 'KP', 'KR', 'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MO', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MS', 'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'NC', 'NZ', 'NI', 'NE', 'NG', 'NU', 'NF', 'MP', 'NO', 'OM', 'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PN', 'PL', 'PT', 'PR', 'QA', 'MK', 'RO', 'RU', 'RW', 'RE', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SX', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS', 'SS', 'ES', 'LK', 'SD', 'SR', 'SJ', 'SE', 'CH', 'SY', 'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TK', 'TO', 'TT', 'TN', 'TR', 'TM', 'TC', 'TV', 'UG', 'UA', 'AE', 'GB', 'US', 'UM', 'UY', 'UZ', 'VU', 'VE', 'VN', 'VG', 'VI', 'WF', 'EH', 'YE', 'ZM', 'ZW'
]);

// Helper function to fetch full text book details (copied to avoid circular dependencies for now)
async function getFullTextBook(bookId, userId, client) {
    const bookResult = await client.query(`SELECT * FROM text_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
    const book = bookResult.rows[0];
    if (!book) return null;

    const chaptersResult = await client.query(`SELECT * FROM chapters WHERE book_id = $1 ORDER BY chapter_number ASC`, [bookId]);
    book.chapters = chaptersResult.rows;
    return book;
}

// Helper function to fetch full picture book details (copied to avoid circular dependencies for now)
async function getFullPictureBook(bookId, userId, client) {
    const bookResult = await client.query(`SELECT * FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
    const book = bookResult.rows[0];
    if (!book) return null;

    const eventsSql = `SELECT *, uploaded_image_url, overlay_text, story_text, is_bold_story_text FROM timeline_events WHERE book_id = $1 ORDER BY page_number ASC`;
    const timelineResult = await client.query(eventsSql, [bookId]);
    book.timeline = timelineResult.rows;
    return book;
}

export const getShippingQuotes = async (req, res) => {
    let client;
    let tempInteriorPdfPath = null;
    const { bookId, bookType, shippingAddress } = req.body;
    const userId = req.userId;

    const trimmedAddress = {
        name: shippingAddress?.name?.trim() || '',
        street1: shippingAddress?.street1?.trim() || '',
        street2: shippingAddress?.street2?.trim() || '',
        city: shippingAddress?.city?.trim() || '',
        state_code: shippingAddress?.state_code?.trim() || '',
        postcode: shippingAddress?.postcode?.trim() || '',
        country_code: shippingAddress?.country_code?.trim().toUpperCase() || '',
        phone_number: shippingAddress?.phone_number?.trim() || '',
        email: shippingAddress?.email?.trim() || ''
    };

    if (!bookId || !bookType || !trimmedAddress.country_code || !trimmedAddress.name || !trimmedAddress.street1 || !trimmedAddress.city || !trimmedAddress.postcode) {
        return res.status(400).json({ message: "Book ID, book type, and a full shipping address (name, street1, city, postcode, country_code) are required." });
    }
    if (!['textBook', 'pictureBook'].includes(bookType)) {
        return res.status(400).json({ message: "Invalid book type provided. Must be 'textBook' or 'pictureBook'." });
    }
    if (!VALID_ISO_COUNTRY_CODES.has(trimmedAddress.country_code)) {
        return res.status(400).json({ message: `Invalid country code: ${trimmedAddress.country_code}. Please use a valid ISO Alpha-2 code.` });
    }

    console.log(`[Shipping Quotes] Request for book ${bookId} (${bookType}) to address:`, trimmedAddress);

    try {
        const pool = await getDb();
        client = await pool.connect();

        let book;
        if (bookType === 'textBook') {
            book = await getFullTextBook(bookId, userId, client);
        } else { // pictureBook
            book = await getFullPictureBook(bookId, userId, client);
        }

        if (!book) {
            console.error(`[Shipping Quotes ERROR] Book not found for ID: ${bookId}, User: ${userId}, Type: ${bookType}`);
            return res.status(404).json({ message: `Book project not found or not authorized.` });
        }

        const selectedProductConfig = LULU_PRODUCT_CONFIGURATIONS.find(p => p.id === book.lulu_product_id);
        if (!selectedProductConfig) {
            console.error(`[Shipping Quotes ERROR] Product configuration not found for luluProductId: ${book.lulu_product_id}`);
            return res.status(500).json({ message: "Book product configuration not found." });
        }

        console.log(`[Shipping Quotes] Generating temporary PDFs for page count determination...`);
        let actualFinalPageCount;
        if (bookType === 'textBook') {
            const { path: interiorPath, pageCount: trueContentPageCount } = await generateAndSaveTextBookPdf(book, selectedProductConfig);
            tempInteriorPdfPath = interiorPath;
            actualFinalPageCount = trueContentPageCount;
        } else { // pictureBook
            const { path: interiorPath, pageCount: trueContentPageCount } = await generateAndSavePictureBookPdf(book, book.timeline, selectedProductConfig);
            tempInteriorPdfPath = interiorPath;
            actualFinalPageCount = trueContentPageCount;
        }

        if (actualFinalPageCount === null) {
            console.warn(`[Shipping Quotes] True content page count was null. Falling back to product's defaultPageCount: ${selectedProductConfig.defaultPageCount}`);
            actualFinalPageCount = selectedProductConfig.defaultPageCount;
        }

        actualFinalPageCount = await finalizePdfPageCount(tempInteriorPdfPath, selectedProductConfig, actualFinalPageCount);
        if (actualFinalPageCount === null) {
            console.error(`[Shipping Quotes] Failed to finalize PDF page count for shipping quotes.`);
            return res.status(500).json({ message: 'Failed to prepare book for shipping cost calculation.' });
        }
        console.log(`[Shipping Quotes] Final padded page count for cost calc: ${actualFinalPageCount}.`);

        let dynamicShippingResult;
        try {
            // MODIFIED: Pass the full, real address directly to the refactored getLuluShippingOptionsAndCosts
            dynamicShippingResult = await getLuluShippingOptionsAndCosts(
                selectedProductConfig.luluSku,
                actualFinalPageCount,
                trimmedAddress, // Use the full, real address
                'USD' // Request options in USD
            );
        } catch (luluServiceError) {
            console.warn(`[Shipping Quotes WARNING] Direct Lulu service call to /shipping-options/ failed. Falling back to fixed rate. Error: ${luluServiceError.message}`);
            dynamicShippingResult = { shippingOptions: [], printCost: 0, currency: 'USD' }; // Provide empty results to trigger fallback
        }

        let finalShippingOptions = [];
        let luluPrintCostUSD = 0;
        let isFallbackApplied = false;

        if (dynamicShippingResult.shippingOptions.length > 0) {
            finalShippingOptions = dynamicShippingResult.shippingOptions;
            luluPrintCostUSD = selectedProductConfig.basePrice * 0.5; // Estimate print cost as 50% of base price for quote
            console.log(`[Shipping Quotes] Dynamic options found. Estimating print cost for quote: $${luluPrintCostUSD.toFixed(2)} USD`);
        } else {
            console.warn(`[Shipping Quotes] No dynamic shipping options found for ${selectedProductConfig.luluSku} to ${trimmedAddress.country_code}. Applying fallback shipping rate.`);
            finalShippingOptions.push(FALLBACK_SHIPPING_OPTION);
            luluPrintCostUSD = selectedProductConfig.basePrice * 0.5;
            isFallbackApplied = true;
        }

        const baseProductPriceUSD = selectedProductConfig.basePrice;

        const formattedShippingOptions = finalShippingOptions.map(option => ({
            level: option.level,
            name: option.name,
            costUsd: option.isFallback ? option.costUsd : option.costUsd, // Use costs directly from the service, which are already in USD
            estimatedDeliveryDate: option.estimatedDeliveryDate,
            isFallback: option.isFallback || false
        }));
        
        if (formattedShippingOptions.length === 0) {
            console.error(`[Shipping Quotes ERROR] No shipping options generated, even after fallback. This indicates a logic error.`);
            return res.status(500).json({ message: "Failed to generate any shipping options." });
        }

        const payload = {
            bookId: bookId,
            bookType: bookType,
            luluSku: selectedProductConfig.luluSku,
            pageCount: actualFinalPageCount,
            shippingAddress: trimmedAddress, // Store the full, real address used for quoting
            printCostAud: (luluPrintCostUSD / AUD_TO_USD_EXCHANGE_RATE),
            baseProductPriceUsd: baseProductPriceUSD,
            isFallback: isFallbackApplied,
        };
        const quoteToken = jsonwebtoken.sign(payload, JWT_QUOTE_SECRET, { expiresIn: `${QUOTE_TOKEN_EXPIRY_MINUTES}m` });
        const expiresAt = new Date(Date.now() + QUOTE_TOKEN_EXPIRY_MINUTES * 60 * 1000).toISOString();

        res.status(200).json({
            quote_token: quoteToken,
            expires_at: expiresAt,
            shipping_options: formattedShippingOptions,
            print_cost_usd: luluPrintCostUSD,
            base_product_price_usd: baseProductPriceUSD,
            currency: 'USD'
        });

    } catch (error) {
        console.error(`[Shipping Quotes ERROR] Failed to retrieve shipping quotes: ${error.message}`);
        console.error("Stack trace:", error.stack);
        if (error.message.includes('Lulu API') || error.message.includes('DNS resolution failed')) {
            return res.status(503).json({ message: `Failed to retrieve shipping options from publishing partner. Please try again later. (Detail: ${error.message})` });
        }
        return res.status(500).json({ message: "Failed to retrieve shipping quotes." });
    } finally {
        if (client) client.release();
        if (tempInteriorPdfPath) {
            try { await fs.unlink(tempInteriorPdfPath); } catch (e) { console.error(`[Cleanup] Error deleting temp interior PDF in shipping controller: ${tempInteriorPdfPath} Error: ${e.message}`); }
        }
    }
};