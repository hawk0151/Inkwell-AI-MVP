// backend/src/controllers/picturebook.controller.js
import { getDb } from '../db/database.js';
import { randomUUID } from 'crypto';
import * as pdfService from '../services/pdf.service.js';
import * as luluService from '../services/lulu.service.js';
import * as stripeService from '../services/stripe.service.js';
import * as imageService from '../services/image.service.js';
import * as fileHostService from '../services/fileHost.service.js';
import jsonwebtoken from 'jsonwebtoken';
import { JWT_QUOTE_SECRET } from '../config/jwt.config.js';
import fs from 'fs/promises';

const PROFIT_MARGIN_AUD = 15.00;
const REQUIRED_CONTENT_PAGES = 20;

async function getFullPictureBook(bookId, userId, client) {
    const bookResult = await client.query(`SELECT * FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
    const book = bookResult.rows[0];
    if (!book) return null;
    const eventsSql = `SELECT id, book_id, page_number, event_date, story_text, image_url, image_style, uploaded_image_url, image_url_preview, image_url_print, overlay_text, is_bold_story_text, last_modified FROM timeline_events WHERE book_id = $1 ORDER BY page_number ASC`;
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
            const defaultPictureBookConfig = luluService.findProductConfiguration('SQUARE_HC_8.75x8.75');
            if (defaultPictureBookConfig) {
                luluProductId = defaultPictureBookConfig.id;
            } else {
                return res.status(400).json({ message: "Lulu product ID is required, and no default could be found." });
            }
        }
        const countResult = await client.query(`SELECT COUNT(*) as count FROM picture_books WHERE user_id = $1`, [userId]);
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

        const booksWithType = books.map(book => {
            const productConfig = luluService.findProductConfiguration(book.lulu_product_id);
            return {
                ...book,
                productName: productConfig ? productConfig.name : 'Unknown Book',
                type: 'pictureBook'
            };
        });

        res.status(200).json(booksWithType);
    } catch (err) {
        console.error("Error fetching picture book projects:", err.message);
        res.status(500).json({ message: 'Failed to fetch projects.' });
    } finally {
        if (client) client.release();
    }
};

export const saveTimelineEvents = async (req, res) => {
    let client;
    const { bookId } = req.params;
    const { events } = req.body;
    const userId = req.userId;

    if (!Array.isArray(events)) {
        return res.status(400).json({ message: "Invalid request body. 'events' must be an array." });
    }

    try {
        const pool = await getDb();
        client = await pool.connect();
        await client.query('BEGIN');

        const bookResult = await client.query(`SELECT id FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        if (bookResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Project not found or you do not have permission.' });
        }
        
        await client.query(`DELETE FROM timeline_events WHERE book_id = $1`, [bookId]);

        if (events.length > 0) {
            const insertSql = `
                INSERT INTO timeline_events (
                    book_id, page_number, event_date, story_text, image_url, 
                    image_style, uploaded_image_url, overlay_text, is_bold_story_text,
                    image_url_preview, image_url_print
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `;
            for (let i = 0; i < events.length; i++) {
                const event = events[i];
                await client.query(insertSql, [
                    bookId, i + 1, event.event_date || null,
                    event.story_text || null, event.image_url || null, event.image_style || null,
                    event.uploaded_image_url || null, event.overlay_text || null, event.is_bold_story_text || false,
                    event.image_url_preview || null, event.image_url_print || null
                ]);
            }
        }

        await client.query(`UPDATE picture_books SET last_modified = $1 WHERE id = $2`, [new Date().toISOString(), bookId]);
        await client.query('COMMIT');
        res.status(200).json({ message: 'Timeline events saved successfully.' });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error(`Error in saveTimelineEvents controller:`, err.message);
        res.status(500).json({ message: 'Failed to save timeline events.' });
    } finally {
        if (client) client.release();
    }
};

export const generateEventImage = async (req, res) => {
    const { bookId, pageNumber } = req.params;
    const { prompt, style } = req.body;
    const userId = req.userId;
    let client;
    try {
        const { previewUrl, printUrl } = await imageService.processAndUploadImageVersions(prompt, style, userId, bookId, pageNumber);

        const pool = await getDb();
        client = await pool.connect();
        const updateSql = `
            UPDATE timeline_events 
            SET image_url_preview = $1, image_url_print = $2, 
                image_url = $1, uploaded_image_url = $1
            WHERE book_id = $3 AND page_number = $4
        `;
        const result = await client.query(updateSql, [previewUrl, printUrl, bookId, pageNumber]);

        if (result.rowCount === 0) {
            throw new Error(`Page number ${pageNumber} not found for book ${bookId}.`);
        }
        
        res.status(200).json({ previewUrl, printUrl });
    } catch(err) {
        console.error('Error generating event image:', err);
        res.status(500).json({ message: 'Failed to generate image.' });
    } finally {
        if (client) client.release();
    }
};

export const generatePreviewPdf = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;
    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();
        const book = await getFullPictureBook(bookId, userId, client);
        if (!book) return res.status(404).json({ message: "Project not found." });

        const productConfig = luluService.findProductConfiguration(book.lulu_product_id);
        if (!productConfig) throw new Error(`Product config not found for ${book.lulu_product_id}.`);

        const { path: tempPdfPath } = await pdfService.generateAndSavePictureBookPdf(book, productConfig);
        
        const publicId = `preview_${bookId}_${Date.now()}`;
        const previewUrl = await fileHostService.uploadPreviewFile(tempPdfPath, publicId);
        
        res.status(200).json({ previewUrl });
    } catch (error) {
        console.error(`[Controller] Error generating preview PDF for book ${bookId}:`, error);
        res.status(500).json({ message: 'Failed to generate preview PDF.' });
    } finally {
        if (client) client.release();
    }
};

export const createBookCheckoutSession = async (req, res) => {
    const { bookId } = req.params;
    const { shippingAddress, selectedShippingLevel, quoteToken } = req.body;
    let client;
    let tempInteriorPdfPath = null;
    let tempCoverPdfPath = null;

    if (!shippingAddress || !selectedShippingLevel || !quoteToken) {
        return res.status(400).json({ message: "Missing shipping address, selected shipping level, or quote token." });
    }

    try {
        const decodedQuote = jsonwebtoken.verify(quoteToken, JWT_QUOTE_SECRET);
        if (decodedQuote.bookId !== bookId || decodedQuote.bookType !== 'pictureBook') {
            return res.status(400).json({ message: 'Shipping quote details do not match the selected book.' });
        }

        const pool = await getDb();
        client = await pool.connect();
        const book = await getFullPictureBook(bookId, req.userId, client);
        if (!book) {
            return res.status(404).json({ message: "Project not found." });
        }

        if (book.timeline.length !== REQUIRED_CONTENT_PAGES) {
            const errorMessage = `This book must have exactly ${REQUIRED_CONTENT_PAGES} pages to be printed.`;
            return res.status(400).json({ message: "Book is incomplete.", detailedError: errorMessage });
        }

        const productConfig = luluService.findProductConfiguration(book.lulu_product_id);

        // --- GENERATE AND VALIDATE PRINT FILES ---
        
        // 1. Generate interior print PDF and finalize page count
        const { path: interiorPdfPath, pageCount: finalPageCount } = await pdfService.generateAndSavePictureBookPdf(book, productConfig);
        tempInteriorPdfPath = interiorPdfPath;
        
        // 2. Generate cover print PDF using the finalized page count
        const coverDimensions = await luluService.getCoverDimensions(productConfig.luluSku, finalPageCount, 'mm');
        const { path: coverPdfPath } = await pdfService.generateCoverPdf(book, productConfig, coverDimensions);
        tempCoverPdfPath = coverPdfPath;

        // 3. Upload both PDFs to a temporary host
        console.log('[Checkout PB] Uploading print files for validation...');
        const [interiorUrl, coverUrl] = await Promise.all([
            fileHostService.uploadPrintFile(interiorPdfPath, `interior_${bookId}_${Date.now()}`),
            fileHostService.uploadPrintFile(coverPdfPath, `cover_${bookId}_${Date.now()}`)
        ]);

        // 4. Validate both files with Lulu's API
        console.log('[Checkout PB] Submitting files for Lulu validation...');
        const [interiorValidation, coverValidation] = await Promise.all([
            luluService.validateInteriorFile(interiorUrl, productConfig.luluSku),
            luluService.validateCoverFile(coverUrl, productConfig.luluSku, finalPageCount)
        ]);

        // 5. Check validation results before proceeding
        if (interiorValidation.status !== 'VALIDATED' && interiorValidation.status !== 'NORMALIZED' || coverValidation.status !== 'VALIDATED' && coverValidation.status !== 'NORMALIZED') {
            const validationErrors = [
                ...(interiorValidation.errors || []),
                ...(coverValidation.errors || [])
            ];
            console.error('[Checkout PB ERROR] Lulu file validation failed:', validationErrors);
            return res.status(400).json({
                message: 'One or more of your files failed Lulu’s validation.',
                detailedError: 'Please check your book content for issues and try again.',
                validationErrors: validationErrors
            });
        }
        
        console.log('[Checkout PB] ✅ Both interior and cover files validated successfully!');
        
        // --- END OF VALIDATION LOGIC ---

        // FIX: The failing `getPrintJobCosts` function has been removed.
        // We will now get the cost from the `productConfig` and the `shippingOptions` API call,
        // both of which are working.
        const { shippingOptions } = await luluService.getLuluShippingOptionsAndCosts(
            productConfig.luluSku,
            finalPageCount,
            shippingAddress
        );

        const selectedOption = shippingOptions.find(option => option.level === selectedShippingLevel);
        if (!selectedOption) {
            return res.status(400).json({ message: "Selected shipping option not found." });
        }

        // Calculate the final price using the book's base price and the selected shipping cost.
        const luluTotalCostAUD = productConfig.basePrice + parseFloat(selectedOption.cost);
        const finalPriceAUD = luluTotalCostAUD + PROFIT_MARGIN_AUD;
        const finalPriceInCents = Math.round(finalPriceAUD * 100);
        
        console.log(`[Checkout PB] Final Pricing (AUD): Lulu Total=$${luluTotalCostAUD.toFixed(2)}, Profit=$${PROFIT_MARGIN_AUD} -> TOTAL=$${finalPriceAUD.toFixed(2)}`);
        
        const orderId = randomUUID();
        const insertOrderSql = `
            INSERT INTO orders (
                id, user_id, book_id, book_type, book_title, lulu_product_id, status,
                total_price_aud, currency, actual_page_count, shipping_level_selected,
                interior_pdf_url, cover_pdf_url, order_date, updated_at 
            ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, 'AUD', $8, $9, $10, $11, $12, $13)`;

        await client.query(insertOrderSql, [
            orderId, req.userId, bookId, 'pictureBook', book.title, productConfig.luluSku,
            parseFloat(finalPriceAUD.toFixed(2)), finalPageCount,
            selectedShippingLevel, interiorUrl, coverUrl, new Date(), new Date()
        ]);

        const session = await stripeService.createStripeCheckoutSession(
            {
                name: book.title,
                description: `Custom Picture Book - ${productConfig.name}`,
                priceInCents: finalPriceInCents
            },
            shippingAddress, req.userId, orderId, bookId, 'pictureBook'
        );

        await client.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, orderId]);

        res.status(200).json({ url: session.url, sessionId: session.id });

    } catch (error) {
        console.error("[Checkout PB ERROR]", error.stack);
        const detailedError = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ message: 'Failed to create checkout session.', detailedError });
    } finally {
        if (client) client.release();
        // Clean up temporary files regardless of success or failure
        if (tempInteriorPdfPath) {
            try { await fs.unlink(tempInteriorPdfPath); } catch (e) { console.error(`[Cleanup] Error deleting temp interior PDF: ${e.message}`); }
        }
        if (tempCoverPdfPath) {
            try { await fs.unlink(tempCoverPdfPath); } catch (e) { console.error(`[Cleanup] Error deleting temp cover PDF: ${e.message}`); }
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