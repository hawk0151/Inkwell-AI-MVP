// backend/src/controllers/order.controller.js
import { getDb } from '../db/database.js';
import { getPrintOptions, getPrintJobStatus } from '../services/lulu.service.js';

let printOptionsCache = null;

const getProductConfig = async (configId) => {
    if (!printOptionsCache) {
        printOptionsCache = await getPrintOptions();
    }
    const config = printOptionsCache.find(p => p.id === configId);
    if (!config) {
        throw new Error(`Product configuration with ID ${configId} not found.`);
    }
    return config;
};

const calculateOrderAmount = async (items) => {
    let total = 0;
    for (const item of items) {
        const productConfig = await getProductConfig(item.productId);
        if (productConfig) {
            total += productConfig.price * item.quantity;
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
        const line_items = await Promise.all(items.map(async (item) => {
            const productConfig = await getProductConfig(item.productId);
            if (!productConfig) {
                throw new Error(`Product configuration with ID ${item.productId} not found.`);
            }
            return {
                price_data: {
                    currency: 'aud',
                    product_data: {
                        name: productConfig.name,
                    },
                    unit_amount: Math.round(productConfig.price * 100),
                },
                quantity: item.quantity,
            };
        }));

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

        const pool = await getDb();
        client = await pool.connect();
        await client.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, orderId]);

        res.status(200).json({ sessionId: session.id });
    } catch (error) {
        console.error("Error creating checkout session:", error);
        res.status(500).json({ message: "Failed to create checkout session." });
    } finally {
        if (client) client.release();
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
        const ordersResult = await client.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY updated_at DESC', [userId]);
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

export const getOrderBySessionId = async (req, res) => {
    let client;
    const { sessionId } = req.params;
    const userId = req.userId;

    if (!sessionId) {
        return res.status(400).json({ message: "Stripe Session ID is required." });
    }

    try {
        const pool = await getDb();
        client = await pool.connect();
        
        const orderResult = await client.query('SELECT * FROM orders WHERE stripe_session_id = $1 AND user_id = $2', [sessionId, userId]);
        const order = orderResult.rows[0];

        if (!order) {
            return res.status(404).json({ message: 'Order not found for this session ID, or you do not have permission to view it.' });
        }

        res.status(200).json(order);
    } catch (error) {
        console.error("Error fetching order details by session ID:", error);
        res.status(500).json({ message: "Failed to fetch order details by session ID." });
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

export const getLuluOrderStatus = async (req, res) => {
    const { luluJobId } = req.params;

    if (!luluJobId || luluJobId === 'null') {
        return res.status(400).json({ message: 'Lulu Job ID is not available for this order yet.' });
    }

    try {
        const statusData = await getPrintJobStatus(luluJobId);
        res.status(200).json(statusData);
    } catch (error) {
        console.error(`Error in getLuluOrderStatus controller for job ${luluJobId}:`, error);
        res.status(500).json({ message: 'Failed to retrieve order status from Lulu.' });
    }
};