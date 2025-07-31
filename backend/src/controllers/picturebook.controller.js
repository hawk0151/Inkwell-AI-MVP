// backend/src/controllers/picturebook.controller.js
import { getDb } from '../db/database.js';
import { randomUUID } from 'crypto';
import { generatePictureBookPdf } from '../services/pdf.service.js';
import { getPrintOptions } from '../services/lulu.service.js';
import { createStripeCheckoutSession } from '../services/stripe.service.js';
import { uploadImageToCloudinary } from '../services/image.service.js';

export const createPictureBook = async (req, res) => {
    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();
        
        const { title } = req.body;
        const userId = req.userId;
        
        const countSql = `SELECT COUNT(*) as count FROM picture_books WHERE user_id = $1`;
        const countResult = await client.query(countSql, [userId]);
        const { count } = countResult.rows[0];

        if (count >= 5) {
            return res.status(403).json({ message: "You have reached the maximum of 5 projects." });
        }
        
        const bookId = randomUUID();
        const currentDate = new Date().toISOString();
        const sql = `INSERT INTO picture_books (id, user_id, title, date_created, last_modified) VALUES ($1, $2, $3, $4, $5)`;
        await client.query(sql, [bookId, userId, title, currentDate, currentDate]);
        
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
                pb.id, pb.title, pb.last_modified, pb.is_public, pb.cover_image_url,
                u.username as author_username,
                u.avatar_url as author_avatar_url
            FROM picture_books pb
            JOIN users u ON pb.user_id = u.id
            WHERE pb.user_id = $1
            ORDER BY pb.last_modified DESC
        `;
        const booksResult = await client.query(sql, [userId]);
        const books = booksResult.rows;
        
        const booksWithType = books.map(b => ({ ...b, type: 'pictureBook', book_type: 'pictureBook' }));
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

        // PostgreSQL ON CONFLICT syntax
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
            last_modified = CURRENT_TIMESTAMP; -- Added last_modified update on conflict
        `;
        await client.query(sql, [bookId, page_number, event_date, description, finalImageUrl, image_style, uploaded_image_url, overlay_text]);
        
        // Update picture_books last_modified directly
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
        await client.query('BEGIN'); // Start transaction for multiple deletes
        
        const { bookId } = req.params;
        const userId = req.userId;
        
        const bookResult = await client.query(`SELECT id FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        const book = bookResult.rows[0];
        
        if (!book) {
            return res.status(404).json({ message: 'Project not found.' });
        }
        
        await client.query(`DELETE FROM timeline_events WHERE book_id = $1`, [bookId]);
        await client.query(`DELETE FROM picture_books WHERE id = $1`, [bookId]);
        
        await client.query('COMMIT'); // Commit transaction
        res.status(200).json({ message: 'Project deleted successfully.' });
    } catch (err) {
        if (client) await client.query('ROLLBACK'); // Rollback on error
        console.error("Error deleting project:", err.message);
        res.status(500).json({ message: 'Failed to delete project.' });
    } finally {
        if (client) client.release();
    }
};

export const createBookCheckoutSession = async (req, res) => {
    let client;
    const { bookId } = req.params;
    const userId = req.userId;
    const minPageCount = 24; // Assuming a minimum number of pages for a publishable picture book

    try {
        const pool = await getDb();
        client = await pool.connect();
        
        const bookResult = await client.query(`SELECT * FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        const book = bookResult.rows[0];
        if (!book) return res.status(404).json({ message: "Project not found." });
        
        const timelineResult = await client.query(`SELECT * FROM timeline_events WHERE book_id = $1`, [bookId]);
        const timeline = timelineResult.rows;
        if (timeline.length < minPageCount) {
            return res.status(400).json({ message: `Project must have at least ${minPageCount} pages.` });
        }
        
        const products = await getPrintOptions();
        const productInfo = products.find(p => p.type === 'picturebook');
        if (!productInfo) return res.status(500).json({ message: "Picture book product definition not found." });

        console.log(`Generating PDF for book ${bookId}...`);
        const pdfBuffer = await generatePictureBookPdf(bookId); // This might need db access too

        console.log(`Uploading PDF to Cloudinary for book ${bookId}...`);
        const folder = `inkwell-ai/user_${userId}/books`;
        const interiorPdfUrl = await uploadImageToCloudinary(pdfBuffer, folder);
        const coverPdfUrl = "https://www.dropbox.com/s/7bv6mg2tj0h3l0r/lulu_trade_perfect_template.pdf?dl=1&raw=1";

        // await client.query(`UPDATE picture_books SET lulu_product_id = $1, interior_pdf_url = $2, cover_pdf_url = $3 WHERE id = $4`, [productInfo.id, interiorPdfUrl, coverPdfUrl, bookId]); // This line is not needed if storing in orders table
        
        console.log(`Creating Stripe session for book ${bookId}...`);

        const orderId = randomUUID(); // Generate a unique orderId

        await client.query(
            `INSERT INTO orders (id, user_id, book_id, book_type, book_title, lulu_order_id, status, total_price, interior_pdf_url, cover_pdf_url, order_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                orderId, 
                userId, 
                bookId, 
                'pictureBook', // book_type
                book.title, // book_title
                productInfo.id, // lulu_order_id (using productInfo.id as luluProductId/SKU for now)
                'pending', 
                productInfo.price, 
                interiorPdfUrl, 
                coverPdfUrl, 
                new Date().toISOString()
            ]
        );

        // --- MODIFICATION START (passed productDetails, userId, orderId, bookId) ---
        const session = await createStripeCheckoutSession(
            { // productDetails object
                id: productInfo.id,
                name: productInfo.name,
                description: book.title,
                price: productInfo.price, // Include price here too
                bookType: 'pictureBook' // Explicitly pass bookType
            }, 
            userId, 
            orderId, // This is the orderId
            bookId // This is the actual book project ID
        );
        // --- MODIFICATION END ---
        
        await client.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, orderId]); // orderId is now defined

        res.status(200).json({ url: session.url });
    } catch (error) {
        console.error("Failed to create checkout session:", error);
        res.status(500).json({ message: "Failed to create checkout session." });
    } finally {
        if (client) client.release();
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