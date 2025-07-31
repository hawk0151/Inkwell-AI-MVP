import stripe from 'stripe';
import { getDb } from '../db/database.js';
// MODIFIED: Import generateCoverPdf
import { generateTextBookPdf, generatePictureBookPdf, generateCoverPdf } from '../services/pdf.service.js';
import { uploadImageToCloudinary } from '../services/image.service.js';
import { createLuluPrintJob } from '../services/lulu.service.js';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

const handleSuccessfulCheckout = async (session) => {
    console.log("✅ Webhook received for Session ID:", session.id);

    const fullSession = await stripeClient.checkout.sessions.retrieve(session.id, {
        expand: ['customer'],
    });

    const { userId, bookId, bookType, luluProductId, productName } = fullSession.metadata;

    console.log("DEBUG: Stripe Session Metadata -> userId:", userId, "bookId:", bookId, "bookType:", bookType, "luluProductId:", luluProductId, "productName:", productName);

    if (!bookId || !bookType || !userId || !luluProductId) {
        console.error("❌ Missing required metadata in Stripe session.");
        return;
    }
    if (!fullSession.shipping_details || !fullSession.shipping_details.address) {
        console.error("❌ Shipping details are missing from the completed session.");
        return;
    }

    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();
        await client.query('BEGIN');

        let shippingInfo = {
            name: fullSession.shipping_details.name,
            street1: fullSession.shipping_details.address.line1,
            city: fullSession.shipping_details.address.city,
            postcode: fullSession.shipping_details.address.postal_code,
            country_code: fullSession.shipping_details.address.country,
            state_code: fullSession.shipping_details.address.state,
            email: fullSession.customer_details.email,
            phone_number: fullSession.customer_details.phone || '000-000-0000',
        };

        let bookTitle;
        let interiorPdfUrl;
        let coverPdfUrl; // This will now be dynamically generated
        let pdfBuffer;
        let luluOrderDetails = null;
        let pageCountForCover = 0; // To fetch page count for spine calculation

        if (bookType === 'textBook') {
            const bookResult = await client.query(`SELECT * FROM text_books WHERE id = $1`, [bookId]);
            const book = bookResult.rows[0];
            if (!book) throw new Error(`Text book with ID ${bookId} not found in DB.`);

            bookTitle = book.title;
            pageCountForCover = book.total_chapters * (book.pagesPerChapter || 1); // Assuming avg pages per chapter to get total pages
            // If total_chapters already means total pages, use that directly.
            // Otherwise, we need to know how many pages each chapter translates to.
            // Let's assume total_chapters * selectedProduct.pagesPerChapter from lulu.service.js gives us the actual page count.
            // Or, more robustly, fetch actual chapter content and count pages using PDFKit's methods if you need extremely accurate total pages.
            // For now, let's try getting it from the product info itself
            
            // Re-fetch product info to get pageCount accurately
            const product = (await import('../services/lulu.service.js')).PRODUCTS_TO_OFFER.find(p => p.id === luluProductId);
            if (!product) throw new Error(`Lulu product ${luluProductId} not found for cover page count.`);
            pageCountForCover = product.pageCount;


            const chaptersResult = await client.query(`SELECT chapter_number, content FROM chapters WHERE book_id = $1 ORDER BY chapter_number ASC`, [bookId]);
            console.log(`DEBUG: Generating PDF for text book: ${book.title}. Chapters count: ${chaptersResult.rows.length}`);

            pdfBuffer = await generateTextBookPdf(book.title, chaptersResult.rows, luluProductId);

            console.log(`DEBUG: Uploading Interior PDF to Cloudinary for book: ${bookId}. PDF Buffer length: ${pdfBuffer ? pdfBuffer.length : 'null'}`);
            interiorPdfUrl = await uploadImageToCloudinary(pdfBuffer, `inkwell-ai/user_${userId}/books`);

            // --- MODIFICATION START: Generate dynamic cover PDF ---
            console.log(`DEBUG: Generating Cover PDF for text book: ${book.title} with product ID ${luluProductId} and page count ${pageCountForCover}.`);
            const coverPdfBuffer = await generateCoverPdf(book.title, book.author_name || 'Inkwell AI', luluProductId, pageCountForCover); // Assuming book has author_name or default
            coverPdfUrl = await uploadImageToCloudinary(coverPdfBuffer, `inkwell-ai/user_${userId}/covers`);
            // --- MODIFICATION END ---

            await client.query(`UPDATE text_books SET interior_pdf_url = $1, cover_pdf_url = $2 WHERE id = $3`, [interiorPdfUrl, coverPdfUrl, bookId]);

            luluOrderDetails = {
                id: bookId,
                product_name: bookTitle,
                lulu_product_id: luluProductId,
                cover_pdf_url: coverPdfUrl,
                interior_pdf_url: interiorPdfUrl
            };

        } else if (bookType === 'pictureBook') {
            const bookResult = await client.query(`SELECT * FROM picture_books WHERE id = $1`, [bookId]);
            const book = bookResult.rows[0];
            if (!book) throw new Error(`Picture book with ID ${bookId} not found in DB.`);

            bookTitle = book.title;
            // Re-fetch product info to get pageCount accurately
            const product = (await import('../services/lulu.service.js')).PRODUCTS_TO_OFFER.find(p => p.id === luluProductId);
            if (!product) throw new Error(`Lulu product ${luluProductId} not found for cover page count.`);
            pageCountForCover = product.pageCount;


            const timelineResult = await client.query(`SELECT * FROM timeline_events WHERE book_id = $1 ORDER BY page_number ASC`, [bookId]);

            console.log(`DEBUG: Generating Interior PDF for picture book: ${book.title}`);
            pdfBuffer = await generatePictureBookPdf(book, timelineResult.rows, luluProductId);

            console.log(`DEBUG: Uploading Interior PDF to Cloudinary for book: ${bookId}. PDF Buffer length: ${pdfBuffer ? pdfBuffer.length : 'null'}`);
            interiorPdfUrl = await uploadImageToCloudinary(pdfBuffer, `inkwell-ai/user_${userId}/books`);

            // --- MODIFICATION START: Generate dynamic cover PDF ---
            console.log(`DEBUG: Generating Cover PDF for picture book: ${book.title} with product ID ${luluProductId} and page count ${pageCountForCover}.`);
            const coverPdfBuffer = await generateCoverPdf(book.title, book.author_name || 'Inkwell AI', luluProductId, pageCountForCover); // Assuming book has author_name or default
            coverPdfUrl = await uploadImageToCloudinary(coverPdfBuffer, `inkwell-ai/user_${userId}/covers`);
            // --- MODIFICATION END ---

            await client.query(`UPDATE picture_books SET interior_pdf_url = $1, cover_pdf_url = $2 WHERE id = $3`, [interiorPdfUrl, coverPdfUrl, bookId]);

            luluOrderDetails = {
                id: bookId,
                product_name: bookTitle,
                lulu_product_id: luluProductId,
                cover_pdf_url: coverPdfUrl,
                interior_pdf_url: interiorPdfUrl
            };

        } else {
            console.error(`❌ CRITICAL: Unknown book type received in webhook: ${bookType}`);
            throw new Error(`Unknown book type: ${bookType}`);
        }

        if (luluOrderDetails === null) {
            console.error("❌ CRITICAL: luluOrderDetails was not assigned for bookType:", bookType);
            throw new Error("Lulu order details could not be prepared for the print job.");
        }

        console.log("--- DEBUG: CHECKING PDF URLS (before Lulu call) ---");
        console.log("Interior PDF URL:", luluOrderDetails.interior_pdf_url);
        console.log("Cover PDF URL:", luluOrderDetails.cover_pdf_url);
        console.log("Lulu Product ID:", luluOrderDetails.lulu_product_id);
        console.log("Shipping Info:", shippingInfo);
        console.log("--------------------------------------------------");

        console.log('Submitting print job to Lulu...');
        const luluJob = await createLuluPrintJob(luluOrderDetails, shippingInfo);

        const orderRecordResult = await client.query('SELECT id FROM orders WHERE stripe_session_id = $1', [fullSession.id]);
        const orderIdFromDB = orderRecordResult.rows[0]?.id;

        if (!orderIdFromDB) {
            console.error("❌ Order record not found in DB for Stripe Session ID:", fullSession.id);
            throw new Error("Order record missing for completed session.");
        }

        const orderSqlUpdate = `UPDATE orders SET lulu_order_id = $1, status = $2, lulu_job_status = $3, updated_at = NOW(), lulu_job_id = $4 WHERE id = $5`;
        await client.query(orderSqlUpdate, [luluJob.id, 'completed', luluJob.status, luluJob.id, orderIdFromDB]);

        console.log('✅ Order record updated with Lulu Job ID and status. Order ID:', orderIdFromDB);

        await client.query('COMMIT');
        console.log('✅ Transaction committed successfully.');

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
        const rawBody = req.rawBody || req.body;
        console.log("DEBUG: Type of rawBody for Stripe webhook:", typeof rawBody, rawBody instanceof Buffer ? " (Buffer)" : "");

        event = stripeClient.webhooks.constructEvent(rawBody, sig, endpointSecret);
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