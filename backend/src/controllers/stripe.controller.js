import stripe from 'stripe';
import { getDb } from '../db/database.js';
import * as luluService from '../services/lulu.service.js';

const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

const handleSuccessfulCheckout = async (session) => {
    console.log("✅ Stripe Webhook received for Session ID:", session.id);
    const { orderId, bookId, bookType } = session.metadata;

    if (!orderId || !bookId || !bookType) {
        console.error("❌ CRITICAL: Stripe session is missing required metadata (orderId, bookId, or bookType).");
        return;
    }

    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();
        await client.query('BEGIN');

        const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 AND status = $2', [orderId, 'pending']);
        const order = orderResult.rows[0];

        if (!order) {
            console.warn(`⚠️ Order with ID ${orderId} not found or already processed.`);
            await client.query('COMMIT');
            return;
        }

        const shippingDetails = session.collected_information?.shipping_details;
        if (!shippingDetails) {
            throw new Error('Shipping details are missing from the session payload.');
        }

        const shippingInfo = {
            name: shippingDetails.name,
            street1: shippingDetails.address.line1,
            street2: shippingDetails.address.line2,
            city: shippingDetails.address.city,
            postcode: shippingDetails.address.postal_code,
            country_code: shippingDetails.address.country,
            state_code: shippingDetails.address.state,
            email: session.customer_details.email,
            phone_number: session.customer_details.phone || '000-000-0000',
        };

        const finalInteriorPdfUrl = order.interior_pdf_url;
        const finalCoverPdfUrl = order.cover_pdf_url;
        const finalLuluProductId = order.lulu_product_id;
        const finalBookTitle = order.book_title;

        if (!finalInteriorPdfUrl || !finalCoverPdfUrl) {
            throw new Error(`CRITICAL: Order ${orderId} is missing pre-validated PDF URLs.`);
        }

        console.log(`[Webhook] Processing order ${orderId}. Using pre-validated PDFs.`);

        const luluOrderDetails = {
            id: order.id,
            book_title: finalBookTitle,
            lulu_product_id: finalLuluProductId,
            shipping_level_selected: order.shipping_level_selected,
            cover_pdf_url: finalCoverPdfUrl,
            interior_pdf_url: finalInteriorPdfUrl
        };

        const luluJob = await luluService.createLuluPrintJob(luluOrderDetails, shippingInfo);

        await client.query(
            `UPDATE orders SET lulu_job_id = $1, status = 'processing', lulu_job_status = $2 WHERE id = $3`,
            [luluJob.id, luluJob.status.name, order.id]
        );

        await client.query('COMMIT');
        console.log(`✅ Order ${orderId} successfully submitted to Lulu. Job ID: ${luluJob.id}`);

    } catch (error) {
        if (client) {
            console.error(`❌ CRITICAL: Failed to process successful checkout for Order ID ${orderId}:`, error.stack);
            await client.query(`UPDATE orders SET status = 'fulfillment_failed', error_message = $1 WHERE id = $2`, [error.message, orderId]);
            await client.query('COMMIT');
        }
    } finally {
        if (client) client.release();
    }
};

export const stripeWebhook = (req, res, endpointSecret) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        // --- ADDED LOGGING STATEMENTS ---
        console.log(`[Stripe Webhook] Received signature: ${sig}`);
        console.log(`[Stripe Webhook] Using endpoint secret: ${endpointSecret}`);
        // --- END ADDED LOGGING STATEMENTS ---
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error(`❌ Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
        case 'checkout.session.completed':
            handleSuccessfulCheckout(event.data.object);
            break;
        case 'payment_intent.succeeded':
            console.log(`✅ PaymentIntent ${event.data.object.id} succeeded!`);
            break;
        case 'payment_intent.created':
        case 'charge.succeeded':
        case 'charge.updated':
        case 'product.created':
        case 'price.created':
            console.log(`⚠️ Unhandled but acknowledged event type: ${event.type}`);
            break;
        default:
            console.log(`⚠️ Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
};