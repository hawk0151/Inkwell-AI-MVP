// backend/src/middleware/auth.middleware.js
import admin from 'firebase-admin';
import { getDb } from '../db/database.js';

export const protect = async (req, res, next) => {
    let token;
    let client; // Declare client for database operations

    console.log(`[PROTECT DEBUG] Request to: ${req.method} ${req.originalUrl}`);

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
        console.log(`[PROTECT DEBUG] Token found: ${token ? 'YES' : 'NO'}`);

        try {
            const decodedToken = await admin.auth().verifyIdToken(token);
            req.userId = decodedToken.uid;
            console.log(`[PROTECT DEBUG] Token decoded. UID: ${req.userId}`);

            const pool = await getDb();
            client = await pool.connect();

            const userQuery = 'SELECT id, role FROM users WHERE id = $1';
            const userResult = await client.query(userQuery, [req.userId]);
            const user = userResult.rows[0];

            if (user) {
                req.userRole = user.role;
                console.log(`[PROTECT DEBUG] User ${req.userId} found in DB. Role: ${req.userRole}. Calling next().`);
                return next();
            } else {
                console.log(`[AUTH DEBUG] First-time login for UID: ${req.userId}. Creating user entry in DB and Firestore.`);

                const initialUsername = decodedToken.name || decodedToken.email || `user_${req.userId.substring(0, 8)}`;
                const initialEmail = decodedToken.email || null;
                const initialAvatarUrl = decodedToken.picture || null;

                console.log(`[AUTH DEBUG] Determined initialUsername for DB/Firestore: "${initialUsername}"`);

                const insertQuery = 'INSERT INTO users (id, email, username, role, avatar_url) VALUES ($1, $2, $3, $4, $5)';
                const defaultRole = 'user';

                await client.query(insertQuery, [req.userId, initialEmail, initialUsername, defaultRole, initialAvatarUrl]);
                console.log(`[AUTH DEBUG] DB entry created for ${req.userId} with username: ${initialUsername}`);

                const firestore = admin.firestore();
                const userDocRef = firestore.collection('users').doc(req.userId);
                await userDocRef.set({
                    username: initialUsername,
                    email: initialEmail,
                    avatar_url: initialAvatarUrl,
                    bio: '',
                    date_created: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                console.log(`[AUTH DEBUG] Firestore entry updated/merged for ${req.userId} with username: ${initialUsername}`);

                req.userRole = defaultRole;
                console.log(`[PROTECT DEBUG] New user ${req.userId} created and added. Calling next().`);
                return next();
            }
        } catch (error) {
            console.error('[PROTECT ERROR] Error in authentication middleware:', error);

            // --- REFINEMENT ADDED: Defensively set CORS headers on error responses ---
            if (!res.headersSent) {
                const origin = req.headers.origin;
                const allowedOrigins = [process.env.CORS_ORIGIN || 'http://localhost:5173', 'https://inkwell-ai-mvp-frontend.onrender.com'];
                if (allowedOrigins.includes(origin)) {
                    res.setHeader('Access-Control-Allow-Origin', origin);
                    res.setHeader('Access-Control-Allow-Credentials', 'true');
                }
            }

            if (error.code === '23505' /* PostgreSQL unique_violation */ || error.code === 'SQLITE_CONSTRAINT') {
                try {
                    const pool = await getDb();
                    const retryClient = await pool.connect();
                    const userQuery = 'SELECT id, role FROM users WHERE id = $1';
                    const userResult = await retryClient.query(userQuery, [req.userId]);
                    const user = userResult.rows[0];
                    if (user) {
                        req.userRole = user.role;
                        console.log(`[PROTECT DEBUG] User ${req.userId} found on retry after constraint error. Calling next().`);
                        return next();
                    }
                } catch (retryError) {
                    console.error('[PROTECT ERROR] Retry failed after constraint error:', retryError);
                }
                return res.status(500).json({ message: 'A database constraint error occurred during user creation. Please try again.' });
            }
            if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
                 return res.status(401).json({ message: 'Authentication failed: Invalid or expired token.' });
            }
            return res.status(401).json({ message: 'Not authorized, token failed' });
        } finally {
            if (client) client.release();
        }
    } else {
        console.log('[PROTECT DEBUG] No Bearer token found in Authorization header.');
    }

    if (!token) {
        console.warn('[PROTECT WARNING] No token provided in protected route.');
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
    console.log('[PROTECT DEBUG] Fallback: Reached end of protect middleware without calling next() or responding. This indicates a logic error.');
    res.status(500).json({ message: 'Internal server error in authentication flow.' });
};

export const optionalAuth = async (req, res, next) => {
    let client;
    try {
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            const token = req.headers.authorization.split(' ')[1];
            const decodedToken = await admin.auth().verifyIdToken(token);
            req.userId = decodedToken.uid;
        }
    } catch (error) {
        req.userId = null;
    }
    next();
};

export const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.userRole || !roles.includes(req.userRole)) {
            return res.status(403).json({ message: 'User role not authorized to access this route' });
        }
        next();
    };
};