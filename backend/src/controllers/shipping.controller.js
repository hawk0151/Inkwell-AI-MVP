// backend/src/controllers/shipping.controller.js
import { getDb } from '../db/database.js';
import { findProductConfiguration, getLuluShippingOptionsAndCosts } from '../services/lulu.service.js';
// FIX: The import itself is correct. The problem is how the functions are used.
import { generateAndSaveTextBookPdf, finalizePdfPageCount, calculatePictureBookPageCount } from '../services/pdf.service.js';
import jsonwebtoken from 'jsonwebtoken';
import fs from 'fs/promises';

const JWT_QUOTE_SECRET = process.env.JWT_QUOTE_SECRET || 'your_super_secret_jwt_quote_key_please_change_this_in_production';
const QUOTE_TOKEN_EXPIRY_MINUTES = 10;

const FALLBACK_SHIPPING_OPTION = {
    level: 'FALLBACK_STANDARD',
    name: 'Standard Shipping (Fallback)',
    cost: 20.00,
    estimatedDeliveryDate: '7-21 business days',
    isFallback: true
};

const VALID_ISO_COUNTRY_CODES = new Set(['AF', 'AX', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AU', 'AT', 'AZ', 'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BQ', 'BA', 'BW', 'BV', 'BR', 'IO', 'BN', 'BG', 'BF', 'BI', 'CV', 'KH', 'CM', 'CA', 'KY', 'CF', 'TD', 'CL', 'CN', 'CX', 'CC', 'CO', 'KM', 'CD', 'CG', 'CK', 'CR', 'CI', 'HR', 'CU', 'CW', 'CY', 'CZ', 'DK', 'DJ', 'DM', 'DO', 'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET', 'FK', 'FO', 'FJ', 'FI', 'FR', 'GF', 'PF', 'TF', 'GA', 'GM', 'GE', 'DE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY', 'HT', 'HM', 'VA', 'HN', 'HK', 'HU', 'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IM', 'IL', 'IT', 'JM', 'JP', 'JE', 'JO', 'KZ', 'KE', 'KI', 'KP', 'KR', 'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MO', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MS', 'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'NC', 'NZ', 'NI', 'NE', 'NG', 'NU', 'NF', 'MP', 'NO', 'OM', 'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PN', 'PL', 'PT', 'PR', 'QA', 'MK', 'RO', 'RU', 'RW', 'RE', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SX', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS', 'SS', 'ES', 'LK', 'SD', 'SR', 'SJ', 'SE', 'CH', 'SY', 'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TK', 'TO', 'TT', 'TN', 'TR', 'TM', 'TC', 'TV', 'UG', 'UA', 'AE', 'GB', 'US', 'UM', 'UY', 'UZ', 'VU', 'VE', 'VN', 'VG', 'VI', 'WF', 'EH', 'YE', 'ZM', 'ZW']);

// FIX: Create a shared page count estimator to avoid duplicate code
const calculateEstimatedTextBookPages = (book, productConfig) => {
    if (!book.chapters || book.chapters.length === 0) {
        return productConfig.minPageCount;
    }
    const totalWords = book.chapters.reduce((sum, chap) => sum + (chap.content ? chap.content.split(' ').length : 0), 0);
    const contentPages = Math.ceil(totalWords / (productConfig.wordsPerPage || 250));
    return 1 + contentPages; // Add 1 for the title page
};


async function getFullTextBook(bookId, userId, client) {
    const bookResult = await client.query(`SELECT * FROM text_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
    const book = bookResult.rows[0];
    if (!book) return null;
    const chaptersResult = await client.query(`SELECT * FROM chapters WHERE book_id = $1 ORDER BY chapter_number ASC`, [bookId]);
    book.chapters = chaptersResult.rows;
    return book;
}

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
        return res.status(400).json({ message: "Book ID, book type, and a full shipping address are required." });
    }
    if (!['textBook', 'pictureBook'].includes(bookType)) {
        return res.status(400).json({ message: "Invalid book type provided." });
    }
    if (!VALID_ISO_COUNTRY_CODES.has(trimmedAddress.country_code)) {
        return res.status(400).json({ message: `Invalid country code: ${trimmedAddress.country_code}.` });
    }

    console.log(`[Shipping Quotes] Request for book ${bookId} (${bookType}) to ${trimmedAddress.country_code}`);

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
            return res.status(404).json({ message: `Book project not found or not authorized.` });
        }

        const selectedProductConfig = findProductConfiguration(book.lulu_product_id);
        if (!selectedProductConfig) {
            console.error(`[Shipping Quotes ERROR] Product configuration not found for luluProductId: ${book.lulu_product_id}`);
            return res.status(500).json({ message: "Book product configuration not found." });
        }

        let actualFinalPageCount;
        if (bookType === 'pictureBook') {
            actualFinalPageCount = calculatePictureBookPageCount(book.timeline, selectedProductConfig);
        } else { // bookType === 'textBook'
            // =======================================================================
            // == FIX: IMPLEMENTED CORRECT ESTIMATE -> VALIDATE -> GENERATE WORKFLOW ==
            // =======================================================================

            // 1. ESTIMATE page count before generation
            const estimatedPages = calculateEstimatedTextBookPages(book, selectedProductConfig);

            // 2. VALIDATE the estimate (optional for quotes, but good practice)
            if (estimatedPages < selectedProductConfig.minPageCount || estimatedPages > selectedProductConfig.maxPageCount) {
                return res.status(400).json({ 
                    message: `This book's estimated length (${estimatedPages} pages) is outside the printable range of ${selectedProductConfig.minPageCount}-${selectedProductConfig.maxPageCount} pages for this format.`
                });
            }

            // 3. GENERATE the PDF using the required 3 arguments
            const { path: interiorPath, pageCount } = await generateAndSaveTextBookPdf(book, selectedProductConfig, estimatedPages);
            tempInteriorPdfPath = interiorPath;
            actualFinalPageCount = pageCount; // The true page count is returned directly
        }
        
        console.log(`[Shipping Quotes] Using final page count for cost calc: ${actualFinalPageCount}.`);

        let dynamicShippingResult;
        try {
            dynamicShippingResult = await getLuluShippingOptionsAndCosts(
                selectedProductConfig.luluSku,
                actualFinalPageCount,
                trimmedAddress,
                'AUD'
            );
        } catch (luluServiceError) {
            console.warn(`[Shipping Quotes WARNING] Dynamic shipping options failed. Error: ${luluServiceError.message}`);
            dynamicShippingResult = { shippingOptions: [] };
        }

        let finalShippingOptions = dynamicShippingResult.shippingOptions.length > 0
            ? dynamicShippingResult.shippingOptions
            : [FALLBACK_SHIPPING_OPTION];
        
        const baseProductPriceAUD = selectedProductConfig.basePrice;

        const payload = {
            bookId,
            bookType,
            luluSku: selectedProductConfig.luluSku,
            pageCount: actualFinalPageCount,
            shippingAddress: trimmedAddress,
            shippingOptions: finalShippingOptions,
            basePrice: baseProductPriceAUD,
            isFallback: finalShippingOptions[0].isFallback || false,
        };
        const quoteToken = jsonwebtoken.sign(payload, JWT_QUOTE_SECRET, { expiresIn: `${QUOTE_TOKEN_EXPIRY_MINUTES}m` });
        const expiresAt = new Date(Date.now() + QUOTE_TOKEN_EXPIRY_MINUTES * 60 * 1000);

        res.status(200).json({
            quote_token: quoteToken,
            expires_at: expiresAt.toISOString(),
            shipping_options: finalShippingOptions,
            base_product_price_aud: baseProductPriceAUD,
            currency: 'AUD'
        });

    } catch (error) {
        console.error(`[Shipping Quotes FATAL] ${error.message}`, { stack: error.stack });
        return res.status(500).json({ message: "An internal error occurred while retrieving shipping quotes." });
    } finally {
        if (client) client.release();
        if (tempInteriorPdfPath) {
            try { await fs.unlink(tempInteriorPdfPath); } catch (e) { console.error(`[Cleanup] Error deleting temp PDF: ${e.message}`); }
        }
    }
};