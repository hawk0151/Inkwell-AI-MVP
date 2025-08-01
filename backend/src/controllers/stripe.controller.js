// backend/src/controllers/stripe.controller.js

import stripe from 'stripe';
import { getDb } from '../db/database.js';
import { createLuluPrintJob } from '../services/lulu.service.js';

const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

const handleSuccessfulCheckout = async (session) => {
    console.log("✅ Stripe Webhook received for Session ID:", session.id);

    const { orderId } = session.metadata;

    if (!orderId) {
        console.error("❌ CRITICAL: Stripe session is missing the 'orderId' in metadata.");
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
        
        console.log(`Found pending order ${order.id}. Preparing for Lulu submission.`);

        const shippingDetails = session.shipping_details;
        if (!shippingDetails || !shippingDetails.address) {
            throw new Error("Shipping details are missing from the completed session.");
        }
        const shippingInfo = {
            name: shippingDetails.name,
            street1: shippingDetails.address.line1,
            city: shippingDetails.address.city,
            postcode: shippingDetails.address.postal_code,
            country_code: shippingDetails.address.country,
            state_code: shippingDetails.address.state,
            email: session.customer_details.email,
            phone_number: session.customer_details.phone || '000-000-0000',
        };

        const luluOrderDetails = {
            id: order.id,
            book_title: order.book_title,
            lulu_product_id: order.lulu_product_id,
            cover_pdf_url: order.cover_pdf_url,
            interior_pdf_url: order.interior_pdf_url
        };

        const luluJob = await createLuluPrintJob(luluOrderDetails, shippingInfo);

        await client.query(
            `UPDATE orders SET lulu_job_id = $1, status = $2, lulu_job_status = $3 WHERE id = $4`,
            [luluJob.id, 'processing', luluJob.status, order.id]
        );
        console.log(`✅ Order ${order.id} submitted to Lulu. Job ID: ${luluJob.id}`);

        await client.query('COMMIT');

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error(`❌ CRITICAL: Failed to process successful checkout for Order ID ${orderId}:`, error);
    } finally {
        if (client) client.release();
    }
};

export const stripeWebhook = (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    try {
        event = stripeClient.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err) {
        console.error(`❌ Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    if (event.type === 'checkout.session.completed') {
        stripeClient.checkout.sessions.retrieve(event.data.object.id, {
            expand: ['shipping_details'],
        }).then(session => {
            handleSuccessfulCheckout(session);
        }).catch(err => {
            console.error("Error retrieving full session from Stripe:", err);
        });
    } else {
        console.log(`Unhandled event type ${event.type}`);
    }
    
    res.json({ received: true });
};