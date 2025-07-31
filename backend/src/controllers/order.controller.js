import { getDb } from '../db/database.js'; // CORRECTED: Import getDb function
import Stripe from 'stripe';
import { PRODUCTS_TO_OFFER } from '../services/lulu.service.js'; // Assumed from context
import { createLuluPrintJob } from '../services/lulu.service.js'; // Assumed from context

// Initialize Stripe (use environment variable for secret key)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Helper to calculate total from line items (similar to frontend)
const calculateOrderAmount = (items) => {
    let total = 0;
    for (const item of items) {
        const productInfo = PRODUCTS_TO_OFFER.find(p => p.id === item.productId);
        if (productInfo) {
            total += productInfo.price; // Assuming price is simple for MVP
        }
    }
    return total; // Amount in cents
};

export const createCheckoutSession = async (req, res) => {
    const { items, orderId, redirectUrls } = req.body;
    const userId = req.userId; // From protect middleware

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
                    currency: 'aud', // or your desired currency
                    product_data: {
                        name: productInfo.name,
                        // description: productInfo.description, // Optional
                        // images: [productInfo.imageUrl], // Optional
                    },
                    unit_amount: productInfo.price, // Price in cents
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
                orderId: orderId, // Link to your internal order ID
            },
        });

        // Store the Stripe session ID with your order in the database for later reconciliation
        const db = await getDb(); // Get the db instance
        await db.run('UPDATE orders SET stripe_session_id = ? WHERE id = ?', [session.id, orderId]);

        res.status(200).json({ sessionId: session.id });
    } catch (error) {
        console.error("Error creating checkout session:", error);
        res.status(500).json({ message: "Failed to create checkout session." });
    }
};

export const handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Stripe Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const db = await getDb(); // Get the db instance

    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            console.log(`Stripe checkout.session.completed event received for session: ${session.id}`);

            const { userId, orderId } = session.metadata;
            const customerEmail = session.customer_details ? session.customer_details.email : null;

            try {
                // Update order status in your database
                await db.run('UPDATE orders SET status = ?, stripe_customer_email = ?, payment_status = ? WHERE id = ? AND user_id = ?',
                    ['completed', customerEmail, 'paid', orderId, userId]);
                console.log(`Order ${orderId} marked as completed in DB.`);

                // Optionally, create Lulu print job here
                // You'd fetch more details from your order table using orderId
                const orderDetails = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);

                if (orderDetails && orderDetails.lulu_order_data) {
                    try {
                        const luluOrderData = JSON.parse(orderDetails.lulu_order_data);
                        const printJobResult = await createLuluPrintJob(luluOrderData);
                        await db.run('UPDATE orders SET lulu_job_id = ?, lulu_job_status = ? WHERE id = ?',
                            [printJobResult.id, printJobResult.status, orderId]);
                        console.log(`Lulu print job created for order ${orderId}:`, printJobResult.id);
                    } catch (luluError) {
                        console.error(`Error creating Lulu print job for order ${orderId}:`, luluError);
                        // Log or handle the failure to create print job
                    }
                }

            } catch (dbError) {
                console.error(`Database update error for session ${session.id}:`, dbError);
                return res.status(500).send('Database update failed');
            }
            break;
        case 'payment_intent.succeeded':
            // Handle payment_intent.succeeded if needed for other payment flows
            console.log(`PaymentIntent ${event.data.object.id} succeeded!`);
            break;
        case 'payment_intent.payment_failed':
            // Handle payment_intent.payment_failed
            console.log(`PaymentIntent ${event.data.object.id} failed.`);
            const failedSessionId = event.data.object.id; // Or associated checkout session ID if available
            try {
                await db.run('UPDATE orders SET status = ?, payment_status = ? WHERE stripe_session_id = ?',
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
};

export const getMyOrders = async (req, res) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ message: 'User not authenticated.' });
    }

    try {
        const db = await getDb(); // Get the db instance
        const orders = await db.all('SELECT * FROM orders WHERE user_id = ? ORDER BY date_created DESC', [userId]);
        res.status(200).json(orders);
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ message: "Failed to fetch orders." });
    }
};

export const getOrderDetails = async (req, res) => {
    const { orderId } = req.params;
    const userId = req.userId; // From protect middleware

    if (!orderId) {
        return res.status(400).json({ message: "Order ID is required." });
    }

    try {
        const db = await getDb(); // Get the db instance
        const order = await db.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, userId]);

        if (!order) {
            return res.status(404).json({ message: 'Order not found or you do not have permission to view it.' });
        }

        res.status(200).json(order);
    } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).json({ message: "Failed to fetch order details." });
    }
};

export const saveOrder = async (req, res) => {
    const { orderId, selectedProducts, totalAmount, bookId, bookType } = req.body;
    const userId = req.userId;

    if (!orderId || !selectedProducts || !totalAmount || !bookId || !bookType) {
        return res.status(400).json({ message: "Missing required order data." });
    }

    try {
        const db = await getDb(); // Get the db instance
        const productsJson = JSON.stringify(selectedProducts);

        const result = await db.run(
            'INSERT INTO orders (id, user_id, products, total_amount, status, book_id, book_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [orderId, userId, productsJson, totalAmount, 'pending', bookId, bookType]
        );

        res.status(201).json({ message: 'Order saved successfully.', orderId: orderId });
    } catch (error) {
        console.error("Error saving order:", error);
        res.status(500).json({ message: 'Failed to save order.' });
    }
};

export const updateOrderLuluData = async (req, res) => {
    const { orderId, luluOrderData } = req.body;
    const userId = req.userId;

    if (!orderId || !luluOrderData) {
        return res.status(400).json({ message: 'Missing order ID or Lulu data.' });
    }

    try {
        const db = await getDb(); // Get the db instance
        const result = await db.run(
            'UPDATE orders SET lulu_order_data = ? WHERE id = ? AND user_id = ?',
            [JSON.stringify(luluOrderData), orderId, userId]
        );

        if (result.changes === 0) {
            return res.status(404).json({ message: 'Order not found or unauthorized.' });
        }

        res.status(200).json({ message: 'Lulu order data updated successfully.' });
    } catch (error) {
        console.error("Error updating Lulu order data:", error);
        res.status(500).json({ message: 'Failed to update Lulu order data.' });
    }
};