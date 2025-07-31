// backend/src/controllers/textbook.controller.js
import { getDb } from '../db/database.js'; // MODIFIED: Import getDb function
import { randomUUID } from 'crypto';
import { generateStoryFromApi } from '../services/gemini.service.js';
import { getPrintOptions } from '../services/lulu.service.js';
import { generateTextBookPdf } from '../services/pdf.service.js';
import { uploadImageToCloudinary } from '../services/image.service.js';
import { createStripeCheckoutSession } from '../services/stripe.service.js';

let printOptionsCache = null; // Cache for print options

export const createTextBook = async (req, res) => {
    const { title, promptDetails, luluProductId } = req.body;
    const userId = req.userId;

    if (!title || !promptDetails || !luluProductId) {
        return res.status(400).json({ message: 'Missing title, prompt details, or product ID.' });
    }

    try {
        const db = await getDb(); // NEW: Get the db instance
        if (!printOptionsCache) {
            printOptionsCache = await getPrintOptions();
        }
        const selectedProduct = printOptionsCache.find(p => p.id === luluProductId);
        if (!selectedProduct) {
            return res.status(404).json({ message: 'Selected product format not found.' });
        }

        const totalChaptersForBook = Math.ceil(selectedProduct.pageCount / (selectedProduct.pagesPerChapter || 1));

        const bookId = randomUUID();
        const currentDate = new Date().toISOString();

        const bookSql = `INSERT INTO text_books (id, user_id, title, prompt_details, lulu_product_id, date_created, last_modified, total_chapters) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        await db.run(bookSql, [bookId, userId, title, JSON.stringify(promptDetails), luluProductId, currentDate, currentDate, totalChaptersForBook]);

        const firstChapterText = await generateStoryFromApi({
            ...promptDetails,
            pageCount: selectedProduct.pageCount,
            wordsPerPage: selectedProduct.wordsPerPage,
            previousChaptersText: '',
            chapterNumber: 1,
            totalChapters: totalChaptersForBook,
        });

        const chapterSql = `INSERT INTO chapters (book_id, chapter_number, content, date_created) VALUES (?, 1, ?, ?)`;
        await db.run(chapterSql, [bookId, firstChapterText, currentDate]);

        res.status(201).json({
            message: 'Project created and first chapter generated.',
            bookId: bookId,
            firstChapter: firstChapterText,
            totalChapters: totalChaptersForBook,
        });
    } catch (error) {
        console.error('Error creating text book:', error);
        res.status(500).json({ message: 'Failed to create text book project.' });
    }
};

export const generateNextChapter = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;
    try {
        const db = await getDb(); // NEW: Get the db instance
        const book = await db.get(`SELECT * FROM text_books WHERE id = ? AND user_id = ?`, [bookId, userId]);
        if (!book) return res.status(404).json({ message: 'Book project not found.' });

        if (!printOptionsCache) {
            printOptionsCache = await getPrintOptions();
        }
        const selectedProduct = printOptionsCache.find(p => p.id === book.lulu_product_id);
        if (!selectedProduct) return res.status(404).json({ message: 'Product format for this book not found.' });

        const chapters = await db.all(`SELECT * FROM chapters WHERE book_id = ? ORDER BY chapter_number ASC`, [bookId]);
        const previousChaptersText = chapters.map(c => c.content).join('\n\n---\n\n');
        const nextChapterNumber = chapters.length + 1;
        const promptDetails = JSON.parse(book.prompt_details);

        const isFinalChapter = nextChapterNumber === book.total_chapters;

        const newChapterText = await generateStoryFromApi({
            ...promptDetails,
            pageCount: selectedProduct.pageCount,
            wordsPerPage: selectedProduct.wordsPerPage,
            previousChaptersText: previousChaptersText,
            chapterNumber: nextChapterNumber,
            totalChapters: book.total_chapters,
            isFinalChapter: isFinalChapter,
        });

        const currentDate = new Date().toISOString();
        const chapterSql = `INSERT INTO chapters (book_id, chapter_number, content, date_created) VALUES (?, ?, ?, ?)`;
        await db.run(chapterSql, [bookId, nextChapterNumber, newChapterText, currentDate]);
        await db.run(`UPDATE text_books SET last_modified = ? WHERE id = ?`, [currentDate, bookId]);

        res.status(201).json({
            message: `Chapter ${nextChapterNumber} generated.`,
            newChapter: newChapterText,
            chapterNumber: nextChapterNumber,
            isStoryComplete: isFinalChapter,
        });
    } catch (error) {
        console.error(`Error generating chapter for book ${bookId}:`, error);
        res.status(500).json({ message: 'Failed to generate next chapter.' });
    }
};

export const getTextBooks = async (req, res) => {
    const userId = req.userId;
    try {
        const db = await getDb(); // NEW: Get the db instance
        const books = await db.all(`
            SELECT
                tb.id, tb.title, tb.last_modified, tb.lulu_product_id, tb.is_public, tb.cover_image_url, tb.total_chapters,
                u.username as author_username,
                (SELECT avatar_url FROM users WHERE id = tb.user_id) as author_avatar_url
            FROM text_books tb
            JOIN users u ON tb.user_id = u.id
            WHERE tb.user_id = ?
            ORDER BY tb.last_modified DESC
        `, [userId]);

        if (!printOptionsCache) {
            printOptionsCache = await getPrintOptions();
        }
        const booksWithData = books.map(book => {
            const product = printOptionsCache.find(p => p.id === book.lulu_product_id);
            return { ...book, productName: product ? product.name : 'Unknown Book', type: 'textBook', book_type: 'textBook' };
        });
        res.status(200).json(booksWithData);
    } catch (error) {
        console.error('Error fetching text books:', error);
        res.status(500).json({ message: 'Failed to fetch text book projects.' });
    }
};

export const getTextBookDetails = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;
    try {
        const db = await getDb(); // NEW: Get the db instance
        const book = await db.get(`SELECT *, total_chapters FROM text_books WHERE id = ? AND user_id = ?`, [bookId, userId]);
        if (!book) return res.status(404).json({ message: 'Book project not found.' });
        const chapters = await db.all(`SELECT chapter_number, content FROM chapters WHERE book_id = ? ORDER BY chapter_number ASC`, [bookId]);
        const bookDetails = {
            id: book.id,
            title: book.title,
            promptDetails: JSON.parse(book.prompt_details),
            luluProductId: book.lulu_product_id,
            lastModified: book.last_modified,
            totalChapters: book.total_chapters,
        };
        res.status(200).json({ book: bookDetails, chapters });
    } catch (error) {
        console.error(`Error fetching details for book ${bookId}:`, error);
        res.status(500).json({ message: 'Failed to fetch book details.' });
    }
};

export const createTextBookCheckoutSession = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;
    try {
        const db = await getDb(); // NEW: Get the db instance
        const book = await db.get(`SELECT * FROM text_books WHERE id = ? AND user_id = ?`, [bookId, userId]);
        if (!book) return res.status(404).json({ message: "Project not found." });
        const chapters = await db.all(`SELECT * FROM chapters WHERE book_id = ?`, [bookId]);

        if (chapters.length < book.total_chapters) {
            return res.status(400).json({ message: `Please generate all ${book.total_chapters} chapters before finalizing your book.` });
        }

        if (!printOptionsCache) {
            printOptionsCache = await getPrintOptions();
        }
        const productInfo = printOptionsCache.find(p => p.id === book.lulu_product_id);
        if (!productInfo) return res.status(500).json({ message: "Book product definition not found." });

        console.log(`Generating text PDF for book ${bookId}...`);
        const pdfBuffer = await generateTextBookPdf(book.title, chapters);
        console.log(`Uploading text PDF to Cloudinary for book ${bookId}...`);
        const folder = `inkwell-ai/user_${userId}/books`;
        const interiorPdfUrl = await uploadImageToCloudinary(pdfBuffer, folder);
        const coverPdfUrl = "https://www.dropbox.com/s/7bv6mg2tj0h3l0r/lulu_trade_perfect_template.pdf?dl=1&raw=1";
        await db.run(`UPDATE text_books SET interior_pdf_url = ?, cover_pdf_url = ? WHERE id = ?`, [interiorPdfUrl, coverPdfUrl, bookId]);
        console.log(`Creating Stripe session for text book ${bookId}...`);
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
        console.error("Failed to create checkout session for text book:", error);
        res.status(500).json({ message: "Failed to create checkout session." });
    }
};

export const toggleTextBookPrivacy = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;
    const { is_public } = req.body;
    if (typeof is_public !== 'boolean') {
        return res.status(400).json({ message: 'is_public must be a boolean value.' });
    }
    try {
        const db = await getDb(); // NEW: Get the db instance
        const book = await db.get(`SELECT id, user_id FROM text_books WHERE id = ?`, [bookId]);
        if (!book) {
            return res.status(404).json({ message: 'Project not found.' });
        }
        if (book.user_id !== userId) {
            return res.status(403).json({ message: 'You are not authorized to edit this project.' });
        }
        await db.run(`UPDATE text_books SET is_public = ? WHERE id = ?`, [is_public, bookId]);
        res.status(200).json({
            message: `Book status successfully set to ${is_public ? 'public' : 'private'}.`,
            is_public: is_public
        });
    } catch (err) {
        console.error("Error toggling book privacy:", err.message);
        res.status(500).json({ message: 'Failed to update project status.' });
    }
};

export const deleteTextBook = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;
    try {
        const db = await getDb(); // NEW: Get the db instance
        const book = await db.get(`SELECT id FROM text_books WHERE id = ? AND user_id = ?`, [bookId, userId]);
        if (!book) {
            return res.status(404).json({ message: 'Project not found or you are not authorized to delete it.' });
        }
        await db.run('BEGIN TRANSACTION');
        await db.run(`DELETE FROM chapters WHERE book_id = ?`, [bookId]);
        await db.run(`DELETE FROM text_books WHERE id = ?`, [bookId]);
        await db.run('COMMIT');
        res.status(200).json({ message: 'Text book project and all its chapters have been deleted.' });
    } catch (error) {
        const db = await getDb(); // NEW: Get db for rollback if needed
        await db.run('ROLLBACK');
        console.error(`Error deleting text book ${bookId}:`, error);
        res.status(500).json({ message: 'Failed to delete project.' });
    }
};