import { getDb } from '../db/database.js';
import { randomUUID } from 'crypto';
import { generateAndSavePictureBookPdf, generateCoverPdf } from '../services/pdf.service.js';
import { LULU_PRODUCT_CONFIGURATIONS, getPrintOptions, getCoverDimensionsFromApi, getPrintJobCosts } from '../services/lulu.service.js';
import { createStripeCheckoutSession } from '../services/stripe.service.js';
import { uploadPdfFileToCloudinary } from '../services/image.service.js';
import path from 'path';
import fs from 'fs/promises';

const PROFIT_MARGIN_USD = 10.00; // You can have a different profit margin for picture books if you want

async function getFullPictureBook(bookId, userId, client) {
    const bookResult = await client.query(`SELECT * FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
    const book = bookResult.rows[0];
    if (!book) return null;

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
    const { shippingAddress } = req.body;
    let client;
    let tempInteriorPdfPath = null;
    let tempCoverPdfPath = null;

    if (!shippingAddress) {
        return res.status(400).json({ message: "Shipping address is required." });
    }

    try {
        const pool = await getDb();
        client = await pool.connect();

        const book = await getFullPictureBook(bookId, req.userId, client);
        if (!book) return res.status(404).json({ message: "Project not found." });

        const selectedProductConfig = LULU_PRODUCT_CONFIGURATIONS.find(p => p.id === book.lulu_product_id);
        if (!selectedProductConfig) return res.status(500).json({ message: "Picture book product configuration not found." });
        
        const { path: interiorPath, pageCount: finalPageCount } = await generateAndSavePictureBookPdf(book, book.timeline, selectedProductConfig);
        tempInteriorPdfPath = interiorPath;
        
        if (finalPageCount < selectedProductConfig.minPageCount || finalPageCount > selectedProductConfig.maxPageCount) {
            const errorMessage = `This picture book has ${finalPageCount} pages, but the selected product format only supports ${selectedProductConfig.minPageCount}-${selectedProductConfig.maxPageCount} pages.`;
            return res.status(400).json({ message: errorMessage });
        }

        const interiorPdfUrl = await uploadPdfFileToCloudinary(tempInteriorPdfPath, `inkwell-ai/user_${req.userId}/books`, `book_${bookId}_interior`);
        const luluSku = selectedProductConfig.luluSku;
        const coverDimensions = await getCoverDimensionsFromApi(luluSku, finalPageCount);
        tempCoverPdfPath = await generateCoverPdf(book, selectedProductConfig, coverDimensions);
        const coverPdfUrl = await uploadPdfFileToCloudinary(tempCoverPdfPath, `inkwell-ai/user_${req.userId}/covers`, `book_${bookId}_cover`);

        const lineItems = [{ pod_package_id: luluSku, page_count: finalPageCount, quantity: 1 }];
        const luluShippingAddress = { ...shippingAddress, state_code: shippingAddress.state_code || '' };
        const luluCosts = await getPrintJobCosts(lineItems, luluShippingAddress);

        const totalProductionCost = parseFloat(luluCosts.total_cost_incl_tax);
        if (isNaN(totalProductionCost)) {
            throw new Error("Failed to parse production cost from Lulu.");
        }
        const finalPriceDollars = totalProductionCost + PROFIT_MARGIN_USD;
        const finalPriceInCents = Math.round(finalPriceDollars * 100);

        const orderId = randomUUID();
        await client.query(
            `INSERT INTO orders (id, user_id, book_id, book_type, book_title, lulu_product_id, status, total_price, interior_pdf_url, cover_pdf_url, order_date, actual_page_count, is_fallback) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12)`,
            [orderId, req.userId, bookId, 'pictureBook', book.title, luluSku, 'pending', finalPriceDollars.toFixed(2), interiorPdfUrl, coverPdfUrl, finalPageCount, false]
        );

        const session = await createStripeCheckoutSession(
            { name: book.title, description: `Inkwell AI Custom Book`, priceInCents: finalPriceInCents },
            req.userId, orderId, bookId, 'pictureBook'
        );
        
        await client.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, orderId]);

        res.status(200).json({ url: session.url });
    } catch (error) {
        console.error("Failed to create checkout session:", error);
        res.status(500).json({ message: "Failed to create checkout session." });
    } finally {
        if (client) client.release();
        if (tempInteriorPdfPath) await fs.unlink(tempInteriorPdfPath).catch(console.error);
        if (tempCoverPdfPath) await fs.unlink(tempCoverPdfPath).catch(console.error);
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