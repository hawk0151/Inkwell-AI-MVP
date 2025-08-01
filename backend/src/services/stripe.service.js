// backend/src/services/stripe.service.js

import stripe from 'stripe';
import { getDb } from '../db/database.js';
import { createLuluPrintJob } from '../services/lulu.service.js';
import { randomUUID } from 'crypto';

const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

export const createStripeCheckoutSession = async (productDetails, userId, orderId, bookId) => {
    try {
        const session = await stripeClient.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'aud',
                        product_data: {
                            name: productDetails.name,
                            description: productDetails.description,
                            // images: [productDetails.imageUrl], // if you have product images
                        },
                        unit_amount: Math.round(productDetails.price * 100), // Price in cents
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${process.env.CLIENT_URL}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL}/checkout-cancel`,
            metadata: {
                userId: userId,
                orderId: orderId,
                bookId: bookId,
                luluProductId: productDetails.id, // This is now the DYNAMIC LULU SKU
                bookType: productDetails.bookType,
                pageCount: productDetails.pageCount
            },
        });
        return session;
    } catch (error) {
        console.error("Error creating Stripe checkout session:", error);
        throw error;
    }
};


const handleSuccessfulCheckout = async (session) => {
    console.log("✅ Webhook received for Session ID:", session.id);

    const fullSession = await stripeClient.checkout.sessions.retrieve(session.id, {
        expand: ['customer'],
    });

    const { userId, bookId, bookType, luluProductId, productName, pageCount } = fullSession.metadata;

    console.log("DEBUG: Stripe Session Metadata -> userId:", userId, "bookId:", bookId, "bookType:", bookType, "luluProductId (Dynamic SKU):", luluProductId, "productName:", productName, "pageCount (Actual from Metadata):", pageCount);

    if (!bookId || !bookType || !userId || !luluProductId || !pageCount) {
        console.error("❌ Missing required metadata in Stripe session (bookId, bookType, userId, luluProductId, or pageCount).");
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

        const orderResult = await client.query(`SELECT id, interior_pdf_url, cover_pdf_url, actual_page_count FROM orders WHERE stripe_session_id = $1`, [fullSession.id]);
        const order = orderResult.rows[0];

        if (!order || !order.interior_pdf_url || !order.cover_pdf_url || !order.actual_page_count) {
            console.error(`Order ${fullSession.id} not found or missing PDF URLs/actual_page_count in DB during webhook processing.`);
            throw new Error("Order data incomplete for print job submission.");
        }

        console.log("--- DEBUG: CHECKING PDF URLS (before Lulu call) ---");
        console.log("Interior PDF URL:", order.interior_pdf_url);
        console.log("Cover PDF URL:", order.cover_pdf_url);
        console.log("Lulu Product ID (Dynamic SKU from DB):", luluProductId);
        console.log("Actual Page Count (from DB):", order.actual_page_count);
        console.log("Shipping Info:", shippingInfo);
        console.log("--------------------------------------------------");

        console.log('Submitting print job to Lulu...');
        const luluJob = await createLuluPrintJob(
            luluProductId,
            order.actual_page_count,
            order.interior_pdf_url,
            order.cover_pdf_url,
            order.id,
            userId,
            shippingInfo
        );
        console.log('Lulu Print Job initiated:', luluJob);

        const orderSqlUpdate = `UPDATE orders SET lulu_order_id = $1, status = $2, lulu_job_status = $3, updated_at = NOW(), lulu_job_id = $4 WHERE id = $5`;
        await client.query(orderSqlUpdate, [luluJob.id, 'print_job_created', luluJob.status, luluJob.id, order.id]);

        console.log('✅ Order record updated with Lulu Job ID and status. Order ID:', order.id);

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