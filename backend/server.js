// backend/server.js
import 'dotenv/config';
import projectRoutes from './src/api/project.routes.js';
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

import shippingRoutes from './src/api/shipping.routes.js';
import orderRoutes from './src/api/order.routes.js';
import pictureBookRoutes from './src/api/picturebook.routes.js';
import textBookRoutes from './src/api/textbook.routes.js';
import imageRoutes from './src/api/image.routes.js';
import { router as userRoutes } from './src/api/user.routes.js';
import { router as analyticsRoutes } from './src/api/analytics.routes.js';
import profileRoutes from './src/api/profile.routes.js';
import socialBookRoutes from './src/api/social.book.routes.js';
import feedRoutes from './src/api/feed.routes.js';
import storyRoutes from './src/api/story.routes.js';
import productRoutes from './src/api/product.routes.js';
import paypalRoutes from './src/api/paypal.routes.js';

import { handleWebhook } from './src/controllers/order.controller.js';

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

    console.log('✅ Firebase initialized for project:', serviceAccount.project_id);

    const app = express();
    const PORT = process.env.PORT || 5001;
    
    // --- THIS IS THE FIX ---
    // Added your new custom domains to the list of allowed origins.
    const allowedOrigins = [
        process.env.CORS_ORIGIN || 'http://localhost:5173',
        'https://inkwell-ai-mvp-frontend.onrender.com',
        'https://inkwell.net.au',
        'https://www.inkwell.net.au'
    ];
    
    const corsOptions = {
        origin: function (origin, callback) {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);
            if (allowedOrigins.indexOf(origin) === -1) {
                const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
                return callback(new Error(msg), false);
            }
            return callback(null, true);
        },
        credentials: true
    };
    
    app.use(cors(corsOptions));
    app.options('*', cors(corsOptions)); // Enable pre-flight for all routes
    console.log("DEBUG: CORS middleware applied with preflight handling.");
    app.use('/api/projects', projectRoutes);
    app.use(morgan('dev'));

    // Stripe webhook needs to be registered before express.json()
    app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
    
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
    
    // Other webhooks
    app.post('/api/orders/webhook', express.raw({ type: 'application/json' }), handleWebhook);

    // API Routes
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
    app.use('/api/shipping', shippingRoutes);

    app.get('/health-check-version', (req, res) => {
      res.json({ 
        message: 'live backend sanity check', 
        timestamp: new Date().toISOString(), 
        commit: 'final-merge-20250803-1730'
      });
    });

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