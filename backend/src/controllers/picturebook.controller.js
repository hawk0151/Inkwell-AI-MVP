// backend/src/controllers/picturebook.controller.js

import { getDb } from '../db/database.js';
import { randomUUID } from 'crypto';
import { generateAndSavePictureBookPdf, generateCoverPdf, getPdfPageCount } from '../services/pdf.service.js';
import { getPrintOptions, getLuluSkuByConfigAndPageCount } from '../services/lulu.service.js';
import { createStripeCheckoutSession } from '../services/stripe.service.js';
import { uploadPdfFileToCloudinary } from '../services/image.service.js';
import path from 'path';
import fs from 'fs/promises';


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

        const printOptionsCache = await getPrintOptions();
        const selectedProductConfig = printOptionsCache.find(p => p.id === luluProductId);
        if (!selectedProductConfig) {
            return res.status(404).json({ message: 'Selected product format (configuration) not found.' });
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

        const bookSql = `SELECT * FROM picture_books WHERE id = $1 AND user_id = $2`;
        const bookResult = await client.query(bookSql, [bookId, userId]);
        const book = bookResult.rows[0];

        if (!book) {
            return res.status(404).json({ message: 'Project not found.' });
        }

        const eventsSql = `SELECT *, uploaded_image_url, overlay_text FROM timeline_events WHERE book_id = $1 ORDER BY page_number ASC`;
        const timelineResult = await client.query(eventsSql, [bookId]);
        const timeline = timelineResult.rows;

        res.status(200).json({ book, timeline });
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
            SELECT
                pb.id, pb.title, pb.last_modified, pb.is_public, pb.cover_image_url, pb.lulu_product_id,
                u.username as author_username,
                u.avatar_url as author_avatar_url
            FROM picture_books pb
            JOIN users u ON pb.user_id = u.id
            WHERE pb.user_id = $1
            ORDER BY pb.last_modified DESC
        `;
        const booksResult = await client.query(sql, [userId]);
        const books = booksResult.rows;

        const printOptionsCache = await getPrintOptions();
        const booksWithType = books.map(book => {
            const productConfig = printOptionsCache.find(p => p.id === book.lulu_product_id);
            return { ...book, productName: productConfig ? productConfig.name : 'Unknown Book', type: 'pictureBook', book_type: 'pictureBook' };
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

        if (!book) {
            return res.status(404).json({ message: 'Project not found.' });
        }

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

export const createBookCheckoutSession = async (req, res) => {
    let client;
    let interiorPdfPath = null;
    let coverPdfPath = null;

    const { bookId } = req.params;
    const userId = req.userId;
    const minPageCountForPictureBook = 24;

    try {
        const pool = await getDb();
        client = await pool.connect();

        const bookResult = await client.query(`SELECT * FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        const book = bookResult.rows[0];
        if (!book) return res.status(404).json({ message: "Project not found." });

        const timelineResult = await client.query(`SELECT * FROM timeline_events WHERE book_id = $1 ORDER BY page_number ASC`, [bookId]);
        const timeline = timelineResult.rows;
        if (timeline.length < minPageCountForPictureBook) {
            return res.status(400).json({ message: `Project must have at least ${minPageCountForPictureBook} pages.` });
        }

        const printOptions = await getPrintOptions();
        const selectedProductConfig = printOptions.find(p => p.id === book.lulu_product_id);
        if (!selectedProductConfig) return res.status(500).json({ message: "Picture book product configuration not found." });

        console.log(`Generating PDFs for picture book ${bookId}...`);

        const tempPdfsDir = path.resolve(process.cwd(), 'tmp', 'pdfs');

        const userResult = await client.query(`SELECT username FROM users WHERE id = $1`, [userId]);
        const authorUsername = userResult.rows[0]?.username || 'Inkwell AI';

        // Step 1: Generate Interior PDF and save locally
        interiorPdfPath = await generateAndSavePictureBookPdf(book, timeline, selectedProductConfig.id, tempPdfsDir);
        console.log(`Interior PDF saved temporarily at: ${interiorPdfPath}`);

        // Step 2: Programmatically Read and Confirm Interior PDF Page Count
        const actualInteriorPageCount = await getPdfPageCount(interiorPdfPath);
        console.log(`Actual interior PDF page count: ${actualInteriorPageCount}`);

        // Step 3: Dynamically Determine SKU based on actual page count
        const dynamicLuluSku = getLuluSkuByConfigAndPageCount(selectedProductConfig.id, actualInteriorPageCount);
        console.log(`Determined dynamic Lulu SKU: ${dynamicLuluSku} for actual page count: ${actualInteriorPageCount}`);


        // Step 6: Upload Both PDFs to Cloudinary Correctly
        const interiorPdfUrl = await uploadPdfFileToCloudinary(
            interiorPdfPath,
            `inkwell-ai/user_${userId}/books`,
            `book_${bookId}_interior`
        );
        console.log(`Uploaded interior PDF to Cloudinary: ${interiorPdfUrl}`);

        // Generate Cover PDF - Pass the ACTUAL interior page count and the DYNAMIC SKU
        const coverPdfBuffer = await generateCoverPdf(book.title, authorUsername, dynamicLuluSku, actualInteriorPageCount);
        coverPdfPath = path.join(tempPdfsDir, `cover_${Date.now()}_${randomUUID().substring(0,8)}.pdf`);
        await fs.writeFile(coverPdfPath, coverPdfBuffer);
        console.log(`Cover PDF saved temporarily at: ${coverPdfPath}`);

        // Step 6: Upload Both PDFs to Cloudinary Correctly
        const coverPdfUrl = await uploadPdfFileToCloudinary(
            coverPdfPath,
            `inkwell-ai/user_${userId}/covers`,
            `book_${bookId}_cover`
        );
        console.log(`Uploaded cover PDF to Cloudinary: ${coverPdfUrl}`);

        console.log(`Creating Stripe session for book ${bookId}...`);

        const orderId = randomUUID();

        await client.query(
            `INSERT INTO orders (id, user_id, book_id, book_type, book_title, lulu_product_id, status, total_price, interior_pdf_url, cover_pdf_url, order_date, actual_page_count) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
                orderId,
                userId,
                bookId,
                'pictureBook',
                book.title,
                dynamicLuluSku,
                'pending',
                selectedProductConfig.basePrice,
                interiorPdfUrl,
                coverPdfUrl,
                new Date().toISOString(),
                actualInteriorPageCount
            ]
        );

        const session = await createStripeCheckoutSession(
            {
                id: dynamicLuluSku,
                name: selectedProductConfig.name,
                description: book.title,
                price: selectedProductConfig.basePrice,
                bookType: 'pictureBook',
                pageCount: actualInteriorPageCount
            },
            userId,
            orderId,
            bookId
        );

        await client.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, orderId]);

        res.status(200).json({ url: session.url });
    } catch (error) {
        console.error("Failed to create checkout session:", error);
        res.status(500).json({ message: "Failed to create checkout session." });
    } finally {
        if (client) client.release();
        if (interiorPdfPath) {
            try {
                await fs.unlink(interiorPdfPath);
                console.log(`Cleaned up temporary interior PDF: ${interiorPdfPath}`);
            } catch (unlinkError) {
                console.error(`Error cleaning up temporary interior PDF ${interiorPdfPath}:`, unlinkError);
            }
        }
        if (coverPdfPath) {
            try {
                await fs.unlink(coverPdfPath);
                console.log(`Cleaned up temporary cover PDF: ${coverPdfPath}`);
            } catch (unlinkError) {
                console.error(`Error cleaning up temporary cover PDF ${coverPdfPath}:`, unlinkError);
            }
        }
    }
};

export const deleteTimelineEvent = async (req, res) => {
    console.log("DEBUG BACKEND: deleteTimelineEvent controller hit!");
    let client;
    const { bookId, pageNumber } = req.params;
    const userId = req.userId;

    console.log(`DEBUG BACKEND: Deleting for Book ID: ${bookId}, Page Number: ${pageNumber}, User ID: ${userId}`);

    try {
        const pool = await getDb();
        client = await pool.connect();

        const bookResult = await client.query(`SELECT id FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        const book = bookResult.rows[0];
        if (!book) {
            console.log(`DEBUG BACKEND: Book ${bookId} not found or not owned by user ${userId}.`);
            return res.status(404).json({ message: 'Project not found or you do not have permission to edit it.' });
        }

        if (isNaN(parseInt(pageNumber)) || parseInt(pageNumber) <= 0) {
            console.log(`DEBUG BACKEND: Invalid page number provided: ${pageNumber}`);
            return res.status(400).json({ message: 'Invalid page number provided.' });
        }

        const eventToDeleteResult = await client.query(`SELECT * FROM timeline_events WHERE book_id = $1 AND page_number = $2`, [bookId, pageNumber]);
        const eventToDelete = eventToDeleteResult.rows[0];
        if (!eventToDelete) {
            console.log(`DEBUG BACKEND: Page ${pageNumber} not found for book ${bookId}.`);
            return res.status(404).json({ message: `Page ${pageNumber} not found for this book.` });
        }
        console.log(`DEBUG BACKEND: Found event to delete: Page ${pageNumber}`);

        await client.query(`DELETE FROM timeline_events WHERE book_id = $1 AND page_number = $2`, [bookId, pageNumber]);
        console.log(`DEBUG BACKEND: Deleted timeline event for book ${bookId}, page ${pageNumber}.`);

        await client.query(`UPDATE timeline_events SET page_number = page_number - 1 WHERE book_id = $1 AND page_number > $2`, [bookId, pageNumber]);
        console.log(`DEBUG BACKEND: Re-ordered subsequent pages for book ${bookId}.`);

        await client.query(`UPDATE picture_books SET last_modified = $1 WHERE id = $2`, [new Date().toISOString(), bookId]);
        console.log(`DEBUG BACKEND: Updated last_modified for book ${bookId}.`);

        res.status(200).json({ message: `Page ${pageNumber} deleted successfully and subsequent pages re-ordered.` });

    } catch (err) {
        console.error(`DEBUG BACKEND: Error in deleteTimelineEvent controller:`, err.message, err.stack);
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

        const bookResult = await client.query(`SELECT id FROM picture_books WHERE id = $1`, [bookId]);
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