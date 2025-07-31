// backend/src/middleware/auth.middleware.js
import admin from 'firebase-admin';
import { getDb } from '../db/database.js';

/**
 * Middleware to protect routes that require a logged-in user.
 * 1. Verifies the Firebase ID token from the Authorization header.
 * 2. Attaches the Firebase UID to the request as `req.userId`.
 * 3. Creates a user record in SQLite on their first API call if one doesn't exist.
 * 4. Attaches the user's role from SQLite to the request as `req.userRole`.
 */
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

            const pool = await getDb(); // Get the pool
            client = await pool.connect(); // Get a client from the pool

            const userQuery = 'SELECT id, role FROM users WHERE id = $1';
            const userResult = await client.query(userQuery, [req.userId]); // Use client.query
            const user = userResult.rows[0]; // Get the row from the result

            if (user) {
                req.userRole = user.role;
                console.log(`[PROTECT DEBUG] User ${req.userId} found in DB. Role: ${req.userRole}. Calling next().`); // Changed SQLite to DB
                return next();
            } else {
                console.log(`[AUTH DEBUG] First-time login for UID: ${req.userId}. Creating user entry in DB and Firestore.`); // Changed SQLite to DB

                console.log(`[AUTH DEBUG] Decoded Token Name: ${decodedToken.name}`);
                console.log(`[AUTH DEBUG] Decoded Token Email: ${decodedToken.email}`);
                console.log(`[AUTH DEBUG] Decoded Token Picture: ${decodedToken.picture}`);

                const initialUsername = decodedToken.name || decodedToken.email || `user_${req.userId.substring(0, 8)}`;
                const initialEmail = decodedToken.email || null;
                const initialAvatarUrl = decodedToken.picture || null;

                console.log(`[AUTH DEBUG] Determined initialUsername for DB/Firestore: "${initialUsername}"`); // Changed SQLite to DB

                const insertQuery = 'INSERT INTO users (id, email, username, role, avatar_url) VALUES ($1, $2, $3, $4, $5)';
                const defaultRole = 'user';

                await client.query(insertQuery, [req.userId, initialEmail, initialUsername, defaultRole, initialAvatarUrl]); // Use client.query
                console.log(`[AUTH DEBUG] DB entry created for ${req.userId} with username: ${initialUsername}`); // Changed SQLite to DB

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
            if (error.code === '23505' /* PostgreSQL unique_violation */ || error.code === 'SQLITE_CONSTRAINT') {
                try {
                    // Re-acquire client for retry if it was released by initial error, or use same client if still valid
                    // For simplicity, get a fresh client for the retry logic
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
            if (client) client.release(); // Release the client back to the pool
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

/**
 * Middleware to conditionally attach user info without protecting the route.
 * Use for public routes that display extra info for logged-in users.
 * It will NOT throw an error if the user is not authenticated.
 */
export const optionalAuth = async (req, res, next) => {
    // This middleware doesn't perform DB writes, so a direct pool.query is often sufficient
    // without explicit client acquisition/release IF it's only read and not part of a transaction.
    // However, for consistency and robustness, let's use client.query here too.
    let client;
    try {
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            const token = req.headers.authorization.split(' ')[1];
            const decodedToken = await admin.auth().verifyIdToken(token);
            req.userId = decodedToken.uid;
        }
    } catch (error) {
        req.userId = null;
    } finally {
        // No client to release here if no pool.connect() was called.
        // For simple read-only, pool.query() doesn't need explicit client.release().
        // If pool.connect() was used here, then client.release() would be needed.
    }
    next();
};

/**
 * Middleware to authorize routes based on user roles.
 * Must be used AFTER the `protect` middleware.
 * @param {...string} roles - The roles allowed to access the route.
 */
export const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.userRole || !roles.includes(req.userRole)) {
            return res.status(403).json({ message: 'User role not authorized to access this route' });
        }
        next();
    };
};