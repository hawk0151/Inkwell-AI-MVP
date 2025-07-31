// backend/src/controllers/stripe.controller.js
import stripe from 'stripe';
import { getDb } from '../db/database.js';
import { generateTextBookPdf, generatePictureBookPdf } from '../services/pdf.service.js';
import { uploadImageToCloudinary } from '../services/image.service.js';
import { createLuluPrintJob } from '../services/lulu.service.js';
import { randomUUID } from 'crypto';

const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

const handleSuccessfulCheckout = async (session) => {
    console.log("✅ Payment successful! Session ID:", session.id);
    const { bookId, bookType, userId } = session.metadata;

    if (!bookId || !bookType || !userId) {
        console.error("❌ Missing required metadata in Stripe session.");
        return;
    }

    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();
        await client.query('BEGIN');

        let luluOrderDetails;
        let shippingInfo = {
            name: session.shipping_details.address.name,
            street1: session.shipping_details.address.line1,
            city: session.shipping_details.address.city,
            postcode: session.shipping_details.address.postal_code,
            country_code: session.shipping_details.address.country,
            state_code: session.shipping_details.address.state,
            email: session.customer_details.email,
            phone_number: session.customer_details.phone || '000-000-0000', // Phone is optional
        };
        
        let bookTitle;

        if (bookType === 'text_book') {
            const bookResult = await client.query(`SELECT * FROM text_books WHERE id = $1`, [bookId]);
            const book = bookResult.rows[0];
            if (!book) throw new Error(`Text book with ID ${bookId} not found.`);
            
            bookTitle = book.title;
            const chaptersResult = await client.query(`SELECT chapter_number, content FROM chapters WHERE book_id = $1 ORDER BY chapter_number ASC`, [bookId]);
            
            console.log(`Generating PDF for text book: ${book.title}`);
            const pdfBuffer = await generateTextBookPdf(book.title, chaptersResult.rows);
            
            const interiorPdfUrl = await uploadImageToCloudinary(pdfBuffer, `inkwell-ai/user_${userId}/books`);
            const coverPdfUrl = book.cover_image_url || "https://www.dropbox.com/s/7bv6mg2tj0h3l0r/lulu_trade_perfect_template.pdf?dl=1&raw=1";
            
            await client.query(`UPDATE text_books SET interior_pdf_url = $1, cover_pdf_url = $2 WHERE id = $3`, [interiorPdfUrl, coverPdfUrl, bookId]);
            
            luluOrderDetails = { id: bookId, product_name: book.title, lulu_product_id: book.lulu_product_id, cover_pdf_url: coverPdfUrl, interior_pdf_url: interiorPdfUrl };

        } else if (bookType === 'picture_book') {
            const bookResult = await client.query(`SELECT * FROM picture_books WHERE id = $1`, [bookId]);
            const book = bookResult.rows[0];
            if (!book) throw new Error(`Picture book with ID ${bookId} not found.`);

            bookTitle = book.title;
            const eventsResult = await client.query(`SELECT * FROM timeline_events WHERE book_id = $1 ORDER BY page_number ASC`, [bookId]);

            console.log(`Generating PDF for picture book: ${book.title}`);
            const pdfBuffer = await generatePictureBookPdf(book, eventsResult.rows); // Use the updated PDF service function

            const interiorPdfUrl = await uploadImageToCloudinary(pdfBuffer, `inkwell-ai/user_${userId}/books`);
            const coverPdfUrl = book.cover_image_url || "https://www.dropbox.com/s/7bv6mg2tj0h3l0r/lulu_trade_perfect_template.pdf?dl=1&raw=1"; // Use book's cover or a default
            
            await client.query(`UPDATE picture_books SET interior_pdf_url = $1, cover_pdf_url = $2 WHERE id = $3`, [interiorPdfUrl, coverPdfUrl, bookId]);
            
            luluOrderDetails = { id: bookId, product_name: book.title, lulu_product_id: book.lulu_product_id, cover_pdf_url: coverPdfUrl, interior_pdf_url: interiorPdfUrl };
        } else {
             throw new Error(`Unknown book type: ${bookType}`);
        }

        console.log('Submitting print job to Lulu...');
        const luluJob = await createLuluPrintJob(luluOrderDetails, shippingInfo);

        const orderId = randomUUID();
        const orderSql = `INSERT INTO orders (id, user_id, book_id, book_type, book_title, lulu_order_id, stripe_session_id, status, total_price, order_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`;
        await client.query(orderSql, [orderId, userId, bookId, bookType, bookTitle, luluJob.id, session.id, luluJob.status, session.amount_total / 100]);
        console.log('✅ Order saved to database. Order ID:', orderId);
        
        await client.query('COMMIT');

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error("❌ CRITICAL: Failed to process successful checkout:", error);
    } finally {
        if (client) client.release();
    }
};

export const stripeWebhook = (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;

    try {
        event = stripeClient.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error(`❌ Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
        case 'checkout.session.completed':
            handleSuccessfulCheckout(event.data.object);
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
};