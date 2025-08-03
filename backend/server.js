import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import admin from 'firebase-admin';
import morgan from 'morgan';
import dns from 'dns/promises';
import { setupDatabase } from './src/db/setupDatabase.js';
import { stripeWebhook } from './src/controllers/stripe.controller.js';
import { createTestCheckout } from './src/controllers/test.controller.js';

async function checkDnsResolution() {
    const luluUrl = process.env.LULU_API_BASE_URL;
    if (!luluUrl) {
        console.error('❌ LULU_API_BASE_URL is not set. Cannot perform DNS check.');
        return;
    }
    const hostname = new URL(luluUrl).hostname;
    console.log(`Performing startup DNS check for: ${hostname}`);
    try {
        const { address } = await dns.lookup(hostname);
        console.log(`✅ DNS resolution successful for ${hostname}. IP Address: ${address}`);
    } catch (error) {
        console.error(`❌ CRITICAL: DNS resolution failed for ${hostname}. The server may not be able to connect to the Lulu API.`);
        console.error(`Error details: ${error.message}`);
    }
}

const startServer = async () => {
    await checkDnsResolution();
    await setupDatabase();

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    let serviceAccount;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_CONFIG) {
        try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_CONFIG);
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        } catch (e) {
            console.error('Error: FIREBASE_SERVICE_ACCOUNT_CONFIG is not valid JSON.', e);
            process.exit(1);
        }
    } else {
        console.error('Error: FIREBASE_SERVICE_ACCOUNT_CONFIG environment variable is not set!');
        process.exit(1);
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    // Dynamically import routes
    const paypalRoutes = (await import('./src/api/paypal.routes.js')).default;
    const storyRoutes = (await import('./src/api/story.routes.js')).default;
    const productRoutes = (await import('./src/api/product.routes.js')).default;
    const orderRoutes = (await import('./src/api/order.routes.js')).default;
    const pictureBookRoutes = (await import('./src/api/picturebook.routes.js')).default;
    const imageRoutes = (await import('./src/api/image.routes.js')).default;
    const textBookRoutes = (await import('./src/api/textbook.routes.js')).default;
    const { router: userRoutes } = await import('./src/api/user.routes.js');
    const { router: analyticsRoutes } = await import('./src/api/analytics.routes.js');
    const profileRoutes = (await import('./src/api/profile.routes.js')).default;
    const socialBookRoutes = (await import('./src/api/social.book.routes.js')).default;
    const feedRoutes = (await import('./src/api/feed.routes.js')).default;
    const { handleWebhook } = await import('./src/controllers/order.controller.js');

    const app = express();
    const PORT = process.env.PORT || 5001;
    
    // --- MODIFIED: More robust CORS configuration ---
    const allowedOrigins = [
        process.env.CORS_ORIGIN || 'http://localhost:5173',
        'https://inkwell-ai-mvp-frontend.onrender.com'
    ];
    
    const corsOptions = {
        origin: function (origin, callback) {
            // allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);
            if (allowedOrigins.indexOf(origin) === -1) {
                const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
                return callback(new Error(msg), false);
            }
            return callback(null, true);
        },
        credentials: true
    };
    
    app.use(cors(corsOptions));
    console.log("DEBUG: CORS middleware applied with updated options.");
    // --- END OF CORS MODIFICATION ---

    app.use(morgan('dev'));
    
    app.post('/api/orders/webhook', express.raw({ type: 'application/json' }), handleWebhook);
    app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

    // Route Definitions
    app.get('/api/test/create-checkout', createTestCheckout);
    app.use('/api/story', storyRoutes);
    app.use('/api/products', productRoutes);
    app.use('/api/orders', orderRoutes);
    app.use('/api/paypal', paypalRoutes);
    app.use('/api/picture-books', pictureBookRoutes);
    app.use('/api/text-books', textBookRoutes);
    app.use('/api/images', imageRoutes);
    app.use('/api/v1/user', userRoutes);
    app.use('/api/profile', profileRoutes);
    app.use('/api/social', socialBookRoutes);
    app.use('/api/feed', feedRoutes);
    app.use('/api/v1/analytics', analyticsRoutes);

    app.get('/', (req, res) => {
        res.send('Inkwell AI Backend is running successfully!');
    });

    app.use((req, res, next) => {
        res.status(404).json({ message: 'Not Found' });
    });

    app.use((err, req, res, next) => {
        console.error('Unhandled error:', err);
        res.status(500).json({ message: 'Internal Server Error', error: err.message });
    });

    app.listen(PORT, () => {
        console.log(`✅ Server is running on http://localhost:${PORT}`);
    });
};

startServer();