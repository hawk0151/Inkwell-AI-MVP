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
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { initializeDb } from './src/db/database.js';
import { setupDatabase } from './src/db/setupDatabase.js';

// Import all your route handlers
import projectRoutes from './src/api/project.routes.js';
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
import contactRoutes from './src/api/contact.routes.js';

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
    await initializeDb();
    
    await checkDnsResolution();
    await setupDatabase();

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // FIX: Switched to individual environment variables for robust Firebase authentication.
    // This is a more stable way to handle credentials than parsing a giant JSON string.
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // The .replace() is still crucial for handling the private key from environment variables.
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
    
    // Check if the essential Firebase variables are present
    if (!serviceAccount.projectId || !serviceAccount.privateKey || !serviceAccount.clientEmail) {
        console.error('Error: Missing required Firebase environment variables! Ensure FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL are set.');
        process.exit(1);
    }
    
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase initialized for project:', serviceAccount.projectId);


    const app = express();
    const PORT = process.env.PORT || 5001;
    
    const server = http.createServer(app);

    const allowedOrigins = [
        ...new Set([
            process.env.CORS_ORIGIN,
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'https://inkwell-ai-mvp-frontend.onrender.com',
            'https://inkwell.net.au',
            'https://www.inkwell.net.au'
        ].filter(Boolean))
    ];

    const corsOptions = {
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.indexOf(origin) !== -1) {
                callback(null, true);
            } else {
                const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
                callback(new Error(msg), false);
            }
        },
        credentials: true
    };
    app.use(cors(corsOptions));
    app.options('*', cors(corsOptions));
    console.log("DEBUG: CORS middleware applied with preflight handling for origins:", allowedOrigins);

    const io = new SocketIOServer(server, {
        cors: {
            origin: allowedOrigins,
            methods: ["GET", "POST"]
        }
    });

    app.use((req, res, next) => {
        req.io = io;
        next();
    });

    io.on('connection', (socket) => {
        console.log('✅ A user connected via WebSocket:', socket.id);
        
        socket.on('join_room', (room) => {
            socket.join(room);
            console.log(`[Socket.IO] User ${socket.id} joined room: ${room}`);
        });

        socket.on('disconnect', () => {
            console.log('🔌 A user disconnected:', socket.id);
        });
    });

    app.use(morgan('dev'));

    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
        stripeWebhook(req, res, endpointSecret);
    });
    
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

    // API Routes
    app.use('/api/projects', projectRoutes);
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
    app.use('/api/contact', contactRoutes);

    // Health and status checks
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

    // Error handling
    app.use((req, res, next) => {
        console.log(`[404 Handler] Route not found for: ${req.method} ${req.originalUrl}`);
        res.status(404).json({ message: 'Not Found' });
    });
    app.use((err, req, res, next) => {
        console.error('Unhandled error:', err);
        res.status(500).json({ message: 'Internal Server Error', error: err.message });
    });

    server.listen(PORT, () => {
        console.log(`✅ Server is running on http://localhost:${PORT}`);
    });
};

startServer();