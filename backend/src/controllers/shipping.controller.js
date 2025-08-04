// backend/src/controllers/shipping.controller.js

import { getDb } from '../db/database.js';
import { LULU_PRODUCT_CONFIGURATIONS, getLuluShippingOptionsAndCosts } from '../services/lulu.service.js';
import { generateAndSaveTextBookPdf, generateAndSavePictureBookPdf, finalizePdfPageCount } from '../services/pdf.service.js';
import jsonwebtoken from 'jsonwebtoken';
import fs from 'fs/promises';
import path from 'path'; // Needed for cleanup paths

// Import the exchange rate from lulu.service.js or define it here for consistency
const AUD_TO_USD_EXCHANGE_RATE = 0.66; // Ensure this matches lulu.service.js

// Secret for signing JWT quote tokens. IMPORTANT: Use a strong, unique secret in production via environment variable.
const JWT_QUOTE_SECRET = process.env.JWT_QUOTE_SECRET || 'your_super_secret_jwt_quote_key_please_change_this_in_production';
const QUOTE_TOKEN_EXPIRY_MINUTES = 10; // Token valid for 10 minutes

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

const VALID_ISO_COUNTRY_CODES = new Set([
    'AF', 'AX', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AU', 'AT', 'AZ', 'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BQ', 'BA', 'BW', 'BV', 'BR', 'IO', 'BN', 'BG', 'BF', 'BI', 'CV', 'KH', 'CM', 'CA', 'KY', 'CF', 'TD', 'CL', 'CN', 'CX', 'CC', 'CO', 'KM', 'CD', 'CG', 'CK', 'CR', 'CI', 'HR', 'CU', 'CW', 'CY', 'CZ', 'DK', 'DJ', 'DM', 'DO', 'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET', 'FK', 'FO', 'FJ', 'FI', 'FR', 'GF', 'PF', 'TF', 'GA', 'GM', 'GE', 'DE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY', 'HT', 'HM', 'VA', 'HN', 'HK', 'HU', 'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IM', 'IL', 'IT', 'JM', 'JP', 'JE', 'JO', 'KZ', 'KE', 'KI', 'KP', 'KR', 'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MO', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MS', 'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'NC', 'NZ', 'NI', 'NE', 'NG', 'NU', 'NF', 'MP', 'NO', 'OM', 'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PN', 'PL', 'PT', 'PR', 'QA', 'MK', 'RO', 'RU', 'RW', 'RE', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SX', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS', 'SS', 'ES', 'LK', 'SD', 'SR', 'SJ', 'SE', 'CH', 'SY', 'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TK', 'TO', 'TT', 'TN', 'TR', 'TM', 'TC', 'TV', 'UG', 'UA', 'AE', 'GB', 'US', 'UM', 'UY', 'UZ', 'VU', 'VE', 'VN', 'VG', 'VI', 'WF', 'EH', 'YE', 'ZM', 'ZW'
]);


export const getShippingQuotes = async (req, res) => {
    let client;
    let tempInteriorPdfPath = null;
    const { bookId, bookType, shippingAddress } = req.body;
    const userId = req.userId;

    // Validate incoming basic shipping address fields
    const trimmedAddress = {
        country_code: shippingAddress?.country_code?.trim().toUpperCase() || '',
        postcode: shippingAddress?.postcode?.trim() || '',
        street1: shippingAddress?.street1?.trim() || '' // Street1 can be useful for some Lulu validation
    };

    if (!bookId || !bookType || !trimmedAddress.country_code) {
        return res.status(400).json({ message: "Book ID, book type, and country code are required." });
    }
    if (!['textBook', 'pictureBook'].includes(bookType)) {
        return res.status(400).json({ message: "Invalid book type provided. Must be 'textBook' or 'pictureBook'." });
    }
    if (!VALID_ISO_COUNTRY_CODES.has(trimmedAddress.country_code)) {
        return res.status(400).json({ message: `Invalid country code: ${trimmedAddress.country_code}. Please use a valid ISO Alpha-2 code.` });
    }

    console.log(`[Shipping Quotes] Request for book ${bookId} (${bookType}) to country: ${trimmedAddress.country_code}, postcode: ${trimmedAddress.postcode || 'N/A'}`);

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

        // Generate interior PDF to get the exact page count required for Lulu cost calculation
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

        // Fetch shipping options and print cost from Lulu
        const { shippingOptions, printCost, currency } = await getLuluShippingOptionsAndCosts(
            selectedProductConfig.luluSku,
            actualFinalPageCount,
            trimmedAddress
        );

        // Convert print cost to USD
        const luluPrintCostUSD = parseFloat((printCost * AUD_TO_USD_EXCHANGE_RATE).toFixed(2));
        const baseProductPriceUSD = selectedProductConfig.basePrice; // Your retail price for the product

        // Prepare shipping options for frontend with USD costs
        const formattedShippingOptions = shippingOptions.map(option => ({
            level: option.level,
            name: option.name,
            costUsd: parseFloat((option.costUsd * AUD_TO_USD_EXCHANGE_RATE).toFixed(2)), // Convert individual shipping option cost to USD
            estimatedDeliveryDate: option.estimatedDeliveryDate
        }));

        if (formattedShippingOptions.length === 0) {
            console.warn(`[Shipping Quotes] No valid shipping options returned by Lulu for SKU ${selectedProductConfig.luluSku} to address ${JSON.stringify(trimmedAddress)}`);
            return res.status(404).json({ message: "No shipping options found for the provided destination." });
        }

        // Generate a signed quote token
        const payload = {
            bookId: bookId,
            bookType: bookType,
            luluSku: selectedProductConfig.luluSku,
            pageCount: actualFinalPageCount,
            shippingAddress: trimmedAddress, // Store the address used for quoting
            printCostAud: printCost, // Store original AUD print cost
            baseProductPriceUsd: baseProductPriceUSD, // Store the base product price
            // Do NOT store individual shipping costs here, as they are dynamic and vary by level.
            // The selectedShippingLevel from the frontend will be re-verified at final checkout.
        };
        const quoteToken = jsonwebtoken.sign(payload, JWT_QUOTE_SECRET, { expiresIn: `${QUOTE_TOKEN_EXPIRY_MINUTES}m` });
        const expiresAt = new Date(Date.now() + QUOTE_TOKEN_EXPIRY_MINUTES * 60 * 1000).toISOString();

        res.status(200).json({
            quote_token: quoteToken,
            expires_at: expiresAt,
            shipping_options: formattedShippingOptions,
            print_cost_usd: luluPrintCostUSD,
            base_product_price_usd: baseProductPriceUSD,
            currency: 'USD' // The currency we are now working with on the frontend
        });

    } catch (error) {
        console.error(`[Shipping Quotes ERROR] Failed to retrieve shipping quotes: ${error.message}`);
        console.error("Stack trace:", error.stack);
        // Distinguish between client errors and service errors
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