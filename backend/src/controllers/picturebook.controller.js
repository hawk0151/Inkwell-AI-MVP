// backend/src/controllers/picturebook.controller.js
import { getDb } from '../db/database.js'; // MODIFIED: Import getDb function
import { randomUUID } from 'crypto';
import { generatePictureBookPdf } from '../services/pdf.service.js';
import { getPrintOptions } from '../services/lulu.service.js';
import { createStripeCheckoutSession } from '../services/stripe.service.js';
import { uploadImageToCloudinary } from '../services/image.service.js'; // ADDED: Need this for Cloudinary upload

export const createPictureBook = async (req, res) => {
    try {
        const db = await getDb(); // NEW: Get the db instance
        const { title } = req.body;
        const userId = req.userId;
        const countSql = `SELECT COUNT(*) as count FROM picture_books WHERE user_id = ?`;
        const { count } = await db.get(countSql, [userId]);
        if (count >= 5) { // Assuming a max of 5 projects for MVP or free tier
            return res.status(403).json({ message: "You have reached the maximum of 5 projects." });
        }
        const bookId = randomUUID();
        const currentDate = new Date().toISOString();
        const sql = `INSERT INTO picture_books (id, user_id, title, date_created, last_modified) VALUES (?, ?, ?, ?, ?)`;
        await db.run(sql, [bookId, userId, title, currentDate, currentDate]);
        res.status(201).json({ bookId: bookId });
    } catch (err) {
        console.error("Error creating picture book:", err.message);
        res.status(500).json({ message: 'Failed to create picture book.' });
    }
};

export const getPictureBook = async (req, res) => {
    try {
        const db = await getDb(); // NEW: Get the db instance
        const { bookId } = req.params;
        const userId = req.userId;
        const bookSql = `SELECT * FROM picture_books WHERE id = ? AND user_id = ?`;
        const book = await db.get(bookSql, [bookId, userId]);
        if (!book) {
            return res.status(404).json({ message: 'Project not found.' });
        }
        const eventsSql = `SELECT *, uploaded_image_url, overlay_text FROM timeline_events WHERE book_id = ? ORDER BY page_number ASC`;
        const timeline = await db.all(eventsSql, [bookId]);
        res.status(200).json({ book, timeline });
    } catch (err) {
        console.error("Error fetching project:", err.message);
        res.status(500).json({ message: 'Failed to fetch project details.' });
    }
};

export const getPictureBooks = async (req, res) => {
    try {
        const db = await getDb(); // NEW: Get the db instance
        const userId = req.userId;
        const sql = `
            SELECT
                pb.id, pb.title, pb.last_modified, pb.is_public, pb.cover_image_url,
                u.username as author_username,
                u.avatar_url as author_avatar_url
            FROM picture_books pb
            JOIN users u ON pb.user_id = u.id
            WHERE pb.user_id = ?
            ORDER BY pb.last_modified DESC
        `;
        const books = await db.all(sql, [userId]);
        const booksWithType = books.map(b => ({ ...b, type: 'pictureBook', book_type: 'pictureBook' }));
        res.status(200).json(booksWithType);
    } catch (err) {
        console.error("Error fetching projects:", err.message);
        res.status(500).json({ message: 'Failed to fetch projects.' });
    }
};

export const addTimelineEvent = async (req, res) => {
    try {
        const db = await getDb(); // NEW: Get the db instance
        const { bookId } = req.params;
        const { page_number, event_date = null, description = null, image_url = null, image_style = null, uploaded_image_url = null, overlay_text = null } = req.body;

        if (page_number === undefined || page_number === null) {
            return res.status(400).json({ message: "Page number is a required field." });
        }

        const finalImageUrl = uploaded_image_url || image_url;

        const sql = `
            INSERT INTO timeline_events (book_id, page_number, event_date, description, image_url, image_style, uploaded_image_url, overlay_text)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(book_id, page_number) DO UPDATE SET
            event_date = excluded.event_date,
            description = excluded.description,
            image_url = excluded.image_url,
            image_style = excluded.image_style,
            uploaded_image_url = excluded.uploaded_image_url,
            overlay_text = excluded.overlay_text;
        `;
        await db.run(sql, [bookId, page_number, event_date, description, finalImageUrl, image_style, uploaded_image_url, overlay_text]);
        await db.run(`UPDATE picture_books SET last_modified = ? WHERE id = ?`, [new Date().toISOString(), bookId]);
        res.status(201).json({ message: 'Event saved.' });
    } catch (err) {
        console.error("Error in addTimelineEvent:", err.message);
        res.status(500).json({ message: 'Failed to save timeline event.' });
    }
};

export const deletePictureBook = async (req, res) => {
    try {
        const db = await getDb(); // NEW: Get the db instance
        const { bookId } = req.params;
        const userId = req.userId;
        const book = await db.get(`SELECT id FROM picture_books WHERE id = ? AND user_id = ?`, [bookId, userId]);
        if (!book) {
            return res.status(404).json({ message: 'Project not found.' });
        }
        await db.run(`DELETE FROM timeline_events WHERE book_id = ?`, [bookId]);
        await db.run(`DELETE FROM picture_books WHERE id = ?`, [bookId]);
        res.status(200).json({ message: 'Project deleted successfully.' });
    } catch (err) {
        console.error("Error deleting project:", err.message);
        res.status(500).json({ message: 'Failed to delete project.' });
    }
};

export const createBookCheckoutSession = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;
    const minPageCount = 24; // Assuming a minimum number of pages for a publishable picture book

    try {
        const db = await getDb(); // NEW: Get the db instance
        const book = await db.get(`SELECT * FROM picture_books WHERE id = ? AND user_id = ?`, [bookId, userId]);
        if (!book) return res.status(404).json({ message: "Project not found." });
        const timeline = await db.all(`SELECT * FROM timeline_events WHERE book_id = ?`, [bookId]);
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
        // Ensure uploadImageToCloudinary is correctly imported and uses getDb if it needs it
        const interiorPdfUrl = await uploadImageToCloudinary(pdfBuffer, folder);
        const coverPdfUrl = "https://www.dropbox.com/s/7bv6mg2tj0h3l0r/lulu_trade_perfect_template.pdf?dl=1&raw=1";

        await db.run(`UPDATE picture_books SET lulu_product_id = ?, interior_pdf_url = ?, cover_pdf_url = ? WHERE id = ?`, [productInfo.id, interiorPdfUrl, coverPdfUrl, bookId]);
        console.log(`Creating Stripe session for book ${bookId}...`);

        const orderDetails = {
            selections: {
                id: productInfo.id,
                name: productInfo.name,
                description: book.title,
            },
            totalPrice: productInfo.price
        };
        const session = await createStripeCheckoutSession(orderDetails, userId, bookId);
        res.status(200).json({ url: session.url });
    } catch (error) {
        console.error("Failed to create checkout session:", error);
        res.status(500).json({ message: "Failed to create checkout session." });
    }
};

// MODIFIED: Renamed and updated to delete a specific timeline event by page number
export const deleteTimelineEvent = async (req, res) => {
    console.log("DEBUG BACKEND: deleteTimelineEvent controller hit!");
    const { bookId, pageNumber } = req.params;
    const userId = req.userId;

    console.log(`DEBUG BACKEND: Deleting for Book ID: ${bookId}, Page Number: ${pageNumber}, User ID: ${userId}`);

    try {
        const db = await getDb(); // NEW: Get the db instance
        const book = await db.get(`SELECT id FROM picture_books WHERE id = ? AND user_id = ?`, [bookId, userId]);
        if (!book) {
            console.log(`DEBUG BACKEND: Book ${bookId} not found or not owned by user ${userId}.`);
            return res.status(404).json({ message: 'Project not found or you do not have permission to edit it.' });
        }

        if (isNaN(parseInt(pageNumber)) || parseInt(pageNumber) <= 0) {
            console.log(`DEBUG BACKEND: Invalid page number provided: ${pageNumber}`);
            return res.status(400).json({ message: 'Invalid page number provided.' });
        }

        const eventToDelete = await db.get(`SELECT * FROM timeline_events WHERE book_id = ? AND page_number = ?`, [bookId, pageNumber]);
        if (!eventToDelete) {
            console.log(`DEBUG BACKEND: Page ${pageNumber} not found for book ${bookId}.`);
            return res.status(404).json({ message: `Page ${pageNumber} not found for this book.` });
        }
        console.log(`DEBUG BACKEND: Found event to delete: Page ${pageNumber}`);

        await db.run(`DELETE FROM timeline_events WHERE book_id = ? AND page_number = ?`, [bookId, pageNumber]);
        console.log(`DEBUG BACKEND: Deleted timeline event for book ${bookId}, page ${pageNumber}.`);

        await db.run(`UPDATE timeline_events SET page_number = page_number - 1 WHERE book_id = ? AND page_number > ?`, [bookId, pageNumber]);
        console.log(`DEBUG BACKEND: Re-ordered subsequent pages for book ${bookId}.`);

        await db.run(`UPDATE picture_books SET last_modified = ? WHERE id = ?`, [new Date().toISOString(), bookId]);
        console.log(`DEBUG BACKEND: Updated last_modified for book ${bookId}.`);

        res.status(200).json({ message: `Page ${pageNumber} deleted successfully and subsequent pages re-ordered.` });

    } catch (err) {
        console.error(`DEBUG BACKEND: Error in deleteTimelineEvent controller:`, err.message, err.stack);
        res.status(500).json({ message: 'Failed to delete the page.' });
    }
};

export const togglePictureBookPrivacy = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;
    const { is_public } = req.body;
    if (typeof is_public !== 'boolean') {
        return res.status(400).json({ message: 'is_public must be a boolean value.' });
    }
    try {
        const db = await getDb(); // NEW: Get the db instance
        const book = await db.get(`SELECT id, user_id FROM picture_books WHERE id = ?`, [bookId]);
        if (!book) {
            return res.status(404).json({ message: 'Project not found.' });
        }
        if (book.user_id !== userId) {
            return res.status(403).json({ message: 'You are not authorized to edit this project.' });
        }
        await db.run(`UPDATE picture_books SET is_public = ? WHERE id = ?`, [is_public, bookId]);

        res.status(200).json({
            message: `Book status successfully set to ${is_public ? 'public' : 'private'}.`,
            is_public: is_public
        });
    } catch (err) {
        console.error("Error toggling book privacy:", err.message);
        res.status(500).json({ message: 'Failed to update project status.' });
    }
};