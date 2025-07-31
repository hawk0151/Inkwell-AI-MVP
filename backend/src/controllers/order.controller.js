import { getDb } from '../db/database.js';
import Stripe from 'stripe';
import { PRODUCTS_TO_OFFER } from '../services/lulu.service.js';
import { createLuluPrintJob } from '../services/lulu.service.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const calculateOrderAmount = (items) => {
    let total = 0;
    for (const item of items) {
        const productInfo = PRODUCTS_TO_OFFER.find(p => p.id === item.productId);
        if (productInfo) {
            total += productInfo.price;
        }
    }
    return total;
};

export const createCheckoutSession = async (req, res) => {
    let client;
    const { items, orderId, redirectUrls } = req.body;
    const userId = req.userId;

    if (!items || items.length === 0 || !orderId || !redirectUrls) {
        return res.status(400).json({ message: "Missing required order details." });
    }

    try {
        const line_items = items.map(item => {
            const productInfo = PRODUCTS_TO_OFFER.find(p => p.id === item.productId);
            if (!productInfo) {
                throw new Error(`Product with ID ${item.productId} not found.`);
            }
            return {
                price_data: {
                    currency: 'aud',
                    product_data: {
                        name: productInfo.name,
                    },
                    unit_amount: productInfo.price,
                },
                quantity: item.quantity,
            };
        });

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items,
            mode: 'payment',
            success_url: `${redirectUrls.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: redirectUrls.cancelUrl,
            metadata: {
                userId: userId,
                orderId: orderId,
            },
        });

        // Store the Stripe session ID with your order in the database for later reconciliation
        const pool = await getDb();
        client = await pool.connect();
        await client.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, orderId]);

        res.status(200).json({ sessionId: session.id });
    } catch (error) {
        console.error("Error creating checkout session:", error);
        res.status(500).json({ message: "Failed to create checkout session." });
    } finally {
        if (client) client.release(); // Release client for this specific DB operation
    }
};

export const handleWebhook = async (req, res) => {
    let client;
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Stripe Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        const pool = await getDb();
        client = await pool.connect(); // Acquire client once for the webhook logic

        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object;
                console.log(`Stripe checkout.session.completed event received for session: ${session.id}`);

                const { userId, orderId } = session.metadata;
                const customerEmail = session.customer_details ? session.customer_details.email : null;

                try {
                    await client.query('UPDATE orders SET status = $1, stripe_customer_email = $2, payment_status = $3 WHERE id = $4 AND user_id = $5',
                        ['completed', customerEmail, 'paid', orderId, userId]);
                    console.log(`Order ${orderId} marked as completed in DB.`);

                    const orderDetailsResult = await client.query('SELECT * FROM orders WHERE id = $1', [orderId]);
                    const orderDetails = orderDetailsResult.rows[0];

                    if (orderDetails && orderDetails.lulu_order_data) {
                        try {
                            const luluOrderData = JSON.parse(orderDetails.lulu_order_data);
                            const printJobResult = await createLuluPrintJob(luluOrderData);
                            await client.query('UPDATE orders SET lulu_job_id = $1, lulu_job_status = $2 WHERE id = $3',
                                [printJobResult.id, printJobResult.status, orderId]);
                            console.log(`Lulu print job created for order ${orderId}:`, printJobResult.id);
                        } catch (luluError) {
                            console.error(`Error creating Lulu print job for order ${orderId}:`, luluError);
                        }
                    }

                } catch (dbError) {
                    console.error(`Database update error for session ${session.id}:`, dbError);
                    return res.status(500).send('Database update failed');
                }
                break;
            case 'payment_intent.succeeded':
                console.log(`PaymentIntent ${event.data.object.id} succeeded!`);
                break;
            case 'payment_intent.payment_failed':
                console.log(`PaymentIntent ${event.data.object.id} failed.`);
                const failedSessionId = event.data.object.id;
                try {
                    await client.query('UPDATE orders SET status = $1, payment_status = $2 WHERE stripe_session_id = $3',
                        ['failed', 'failed', failedSessionId]);
                    console.log(`Order associated with session ${failedSessionId} marked as failed.`);
                } catch (dbError) {
                    console.error(`Database update error for failed session ${failedSessionId}:`, dbError);
                }
                break;
            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error("Error in webhook handler:", error);
        res.status(500).json({ message: "Server error in webhook handler." });
    } finally {
        if (client) client.release(); // Release client for the webhook logic
    }
};

export const getMyOrders = async (req, res) => {
    let client;
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ message: 'User not authenticated.' });
    }

    try {
        const pool = await getDb();
        client = await pool.connect();
        const ordersResult = await client.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY date_created DESC', [userId]);
        const orders = ordersResult.rows;
        res.status(200).json(orders);
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ message: "Failed to fetch orders." });
    } finally {
        if (client) client.release();
    }
};

export const getOrderDetails = async (req, res) => {
    let client;
    const { orderId } = req.params;
    const userId = req.userId;

    if (!orderId) {
        return res.status(400).json({ message: "Order ID is required." });
    }

    try {
        const pool = await getDb();
        client = await pool.connect();
        const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [orderId, userId]);
        const order = orderResult.rows[0];

        if (!order) {
            return res.status(404).json({ message: 'Order not found or you do not have permission to view it.' });
        }

        res.status(200).json(order);
    } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).json({ message: "Failed to fetch order details." });
    } finally {
        if (client) client.release();
    }
};

export const saveOrder = async (req, res) => {
    let client;
    const { orderId, selectedProducts, totalAmount, bookId, bookType } = req.body;
    const userId = req.userId;

    if (!orderId || !selectedProducts || !totalAmount || !bookId || !bookType) {
        return res.status(400).json({ message: "Missing required order data." });
    }

    try {
        const pool = await getDb();
        client = await pool.connect();
        const productsJson = JSON.stringify(selectedProducts);

        const result = await client.query(
            'INSERT INTO orders (id, user_id, products, total_amount, status, book_id, book_type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [orderId, userId, productsJson, totalAmount, 'pending', bookId, bookType]
        );

        res.status(201).json({ message: 'Order saved successfully.', orderId: orderId });
    } catch (error) {
        console.error("Error saving order:", error);
        res.status(500).json({ message: 'Failed to save order.' });
    } finally {
        if (client) client.release();
    }
};

export const updateOrderLuluData = async (req, res) => {
    let client;
    const { orderId, luluOrderData } = req.body;
    const userId = req.userId;

    if (!orderId || !luluOrderData) {
        return res.status(400).json({ message: 'Missing order ID or Lulu data.' });
    }

    try {
        const pool = await getDb();
        client = await pool.connect();
        const result = await client.query(
            'UPDATE orders SET lulu_order_data = $1 WHERE id = $2 AND user_id = $3',
            [JSON.stringify(luluOrderData), orderId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Order not found or unauthorized.' });
        }

        res.status(200).json({ message: 'Lulu order data updated successfully.' });
    } catch (error) {
        console.error("Error updating Lulu order data:", error);
        res.status(500).json({ message: 'Failed to update Lulu order data.' });
    } finally {
        if (client) client.release();
    }
};