// backend/src/controllers/picturebook.controller.js

import { getDb } from '../db/database.js';
import { randomUUID } from 'crypto';
import { generateAndSavePictureBookPdf, generateCoverPdf } from '../services/pdf.service.js';
import { findProductConfiguration, getCoverDimensionsFromApi, getPrintJobCosts } from '../services/lulu.service.js';
import { createStripeCheckoutSession } from '../services/stripe.service.js';
import { uploadPdfFileToCloudinary } from '../services/image.service.js';
import jsonwebtoken from 'jsonwebtoken';
import fs from 'fs/promises';

const AUD_TO_USD_EXCHANGE_RATE = 0.66;
const JWT_QUOTE_SECRET = process.env.JWT_QUOTE_SECRET || 'your_super_secret_jwt_quote_key';
const PROFIT_MARGIN_USD = 10.00;

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
            const defaultPictureBookConfig = findProductConfiguration('A4PREMIUM_FC_8.27x11.69');
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

// THIS FUNCTION IS NOW PATCHED
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
            const productConfig = findProductConfiguration(book.lulu_product_id);
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

// THIS IS OUR REWRITTEN AND UNIFIED CHECKOUT FUNCTION
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
        console.log(`[Checkout PB] Quote token verified for book ${bookId}.`);
        
        const pool = await getDb();
        client = await pool.connect();
        const book = await getFullPictureBook(bookId, req.userId, client);
        if (!book) {
            return res.status(404).json({ message: "Project not found." });
        }
        const productConfig = findProductConfiguration(book.lulu_product_id);
        if (!productConfig) {
            return res.status(500).json({ message: `Internal Error: Product configuration not found for ID ${book.lulu_product_id}.` });
        }
        console.log(`[Checkout PB] Found product config: ${productConfig.id}`);
        
        console.log(`[Checkout PB] Generating final PDFs for order...`);
        const { path: interiorPath, pageCount: finalPageCount } = await generateAndSavePictureBookPdf(book, book.timeline, productConfig);
        tempInteriorPdfPath = interiorPath;
        const interiorPdfUrl = await uploadPdfFileToCloudinary(tempInteriorPdfPath, `inkwell-ai/user_${req.userId}/books`, `book_${bookId}_interior`);
        
        const coverDimensions = await getCoverDimensionsFromApi(productConfig.luluSku, finalPageCount);
        tempCoverPdfPath = await generateCoverPdf(book, productConfig, coverDimensions);
        const coverPdfUrl = await uploadPdfFileToCloudinary(tempCoverPdfPath, `inkwell-ai/user_${req.userId}/covers`, `book_${bookId}_cover`);
        console.log(`[Checkout PB] PDFs generated and uploaded successfully.`);

        const lineItems = [{ pod_package_id: productConfig.luluSku, page_count: finalPageCount, quantity: 1 }];
        const luluCosts = await getPrintJobCosts(lineItems, shippingAddress, selectedShippingLevel);
        
        if (!luluCosts?.lineItemCosts?.[0]?.total_cost_incl_tax) {
            throw new Error("Lulu cost response was missing expected print cost data.");
        }
        
        const luluPrintCostAUD = parseFloat(luluCosts.lineItemCosts[0].total_cost_incl_tax);
        const luluFulfillmentCostAUD = parseFloat(luluCosts.fulfillmentCost?.total_cost_incl_tax || 0);
        const selectedShippingOption = luluCosts.shippingOptions.find(opt => opt.level === selectedShippingLevel);
        if (!selectedShippingOption) {
            throw new Error(`The selected shipping level '${selectedShippingLevel}' was not available in the final cost calculation from Lulu.`);
        }
        const luluShippingCostAUD = parseFloat(selectedShippingOption.total_cost_incl_tax);
        const luluPrintCostUSD = parseFloat((luluPrintCostAUD * AUD_TO_USD_EXCHANGE_RATE).toFixed(2));
        const luluFulfillmentCostUSD = parseFloat((luluFulfillmentCostAUD * AUD_TO_USD_EXCHANGE_RATE).toFixed(2));
        const luluShippingCostUSD = parseFloat((luluShippingCostAUD * AUD_TO_USD_EXCHANGE_RATE).toFixed(2));
        
        const finalPriceDollars = luluPrintCostUSD + luluShippingCostUSD + luluFulfillmentCostUSD + PROFIT_MARGIN_USD;
        const finalPriceInCents = Math.round(finalPriceDollars * 100);

        console.log(`[Checkout PB] Final Pricing (USD): Print=$${luluPrintCostUSD}, Ship=$${luluShippingCostUSD}, Fulfill=$${luluFulfillmentCostUSD}, Profit=$${PROFIT_MARGIN_USD} -> TOTAL=$${finalPriceDollars.toFixed(2)}`);

        const orderId = randomUUID();
        const insertOrderSql = `
            INSERT INTO orders (
                id, user_id, book_id, book_type, book_title, lulu_product_id, status,
                total_price_usd, currency, interior_pdf_url, cover_pdf_url, actual_page_count,
                lulu_print_cost_usd, lulu_shipping_cost_usd, profit_usd,
                shipping_level_selected, lulu_fulfillment_cost_usd, order_date, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`;
        
        await client.query(insertOrderSql, [
            orderId, req.userId, bookId, 'pictureBook', book.title, productConfig.luluSku,
            'pending', parseFloat(finalPriceDollars.toFixed(2)), 'USD', interiorPdfUrl, coverPdfUrl, finalPageCount,
            luluPrintCostUSD, luluShippingCostUSD, PROFIT_MARGIN_USD,
            selectedShippingLevel, luluFulfillmentCostUSD, new Date(), new Date()
        ]);
        console.log(`[Checkout PB] Created pending order record ${orderId}.`);

        const session = await createStripeCheckoutSession(
            {
                name: book.title,
                description: `Custom Picture Book - ${productConfig.name}`,
                priceInCents: finalPriceInCents
            },
            shippingAddress,
            req.userId, orderId, bookId, 'pictureBook'
        );

        await client.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, orderId]);
        console.log(`[Checkout PB] Stripe session ${session.id} created.`);
        
        res.status(200).json({ url: session.url, sessionId: session.id });

    } catch (error) {
        console.error("[Checkout PB ERROR]", error.stack);
        const detailedError = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ message: 'Failed to create checkout session.', detailedError });
    } finally {
        if (client) client.release();
        if (tempInteriorPdfPath) { try { await fs.unlink(tempInteriorPdfPath); } catch (e) { console.error(`[Cleanup] Error deleting temp file: ${e.message}`); } }
        if (tempCoverPdfPath) { try { await fs.unlink(tempCoverPdfPath); } catch (e) { console.error(`[Cleanup] Error deleting temp file: ${e.message}`); } }
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