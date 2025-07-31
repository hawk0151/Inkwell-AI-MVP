import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import admin from 'firebase-admin';
import morgan from 'morgan';
import { setupDatabase } from './src/db/setupDatabase.js';

// NEW: Import the Stripe controller
import { stripeWebhook } from './src/controllers/stripe.controller.js';


const startServer = async () => {
    await setupDatabase();

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // NEW: Load Firebase service account config from environment variable
    let serviceAccount;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_CONFIG) {
        try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_CONFIG);
        } catch (e) {
            console.error('Error: FIREBASE_SERVICE_ACCOUNT_CONFIG environment variable is not valid JSON.', e);
            process.exit(1);
        }
    } else {
        // Fallback for local development using the file, or error in production
        const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
        if (process.env.NODE_ENV === 'production') {
            console.error('Error: FIREBASE_SERVICE_ACCOUNT_CONFIG environment variable is not set in production!');
            process.exit(1); // Critical error if not set in production
        }
        // For local development, still try to read from file if env var isn't set
        try {
            // Re-adding fs for local dev fallback to read file
            const fs = await import('fs');
            if (!fs.existsSync(serviceAccountPath)) {
                console.error('Error: serviceAccountKey.json not found for local Firebase Admin SDK initialization.');
                console.error('In local development, ensure "serviceAccountKey.json" is in the root of your backend directory or FIREBASE_SERVICE_ACCOUNT_CONFIG is set.');
                process.exit(1);
            }
            serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
            console.warn('Warning: Using serviceAccountKey.json file for Firebase Admin SDK. For production, use FIREBASE_SERVICE_ACCOUNT_CONFIG env var.');
        } catch (e) {
            console.error('Error reading serviceAccountKey.json for local Firebase Admin SDK:', e);
            process.exit(1);
        }
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
    const { router: userRoutes } = await import('./src/api/user.routes.js'); // Named export
    const { router: analyticsRoutes } = await import('./src/api/analytics.routes.js'); // Named export
    const profileRoutes = (await import('./src/api/profile.routes.js')).default;
    const socialBookRoutes = (await import('./src/api/social.book.routes.js')).default;
    const feedRoutes = (await import('./src/api/feed.routes.js')).default;
    const { handleWebhook } = await import('./src/controllers/order.controller.js');

    const app = express();
    const PORT = process.env.PORT || 5001;

    app.use(cors({
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
        credentials: true,
    }));

    app.use(morgan('dev'));
    
    // --- Webhook routes that need the raw body must come BEFORE express.json() ---
    app.post('/api/orders/webhook', express.raw({ type: 'application/json' }), handleWebhook);
    // NEW: Add the Stripe webhook route
    app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);


    // --- Parsers for all other routes ---
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());

    // Serve static files (e.g., uploaded images)
    app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

    // --- Route Definitions ---
    app.use('/api/story', storyRoutes);
    app.use('/api/products', productRoutes);
    app.use('/api/orders', orderRoutes);
    app.use('/api/paypal', paypalRoutes);
    app.use('/api/picture-books', pictureBookRoutes);
    app.use('/api/text-books', textBookRoutes);

    app.use('/api/v1/user', userRoutes);
    app.use('/api/profile', profileRoutes);

    app.use('/api/social', socialBookRoutes);
    app.use('/api/feed', feedRoutes);

    app.use('/api/v1/analytics', analyticsRoutes);

    // Root route
    app.get('/', (req, res) => {
        res.send('Inkwell AI Backend is running successfully!');
    });

    // Catch-all for 404 Not Found
    app.use((req, res, next) => {
        res.status(404).json({ message: 'Not Found' });
    });

    // Global error handler
    app.use((err, req, res, next) => {
        console.error('Unhandled error:', err);
        res.status(500).json({ message: 'Internal Server Error', error: err.message });
    });

    app.listen(PORT, () => {
        console.log(`✅ Server is running on http://localhost:${PORT}`);
    });
};

startServer();