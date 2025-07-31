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

    console.log(`[PROTECT DEBUG] Request to: ${req.method} ${req.originalUrl}`);

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
        console.log(`[PROTECT DEBUG] Token found: ${token ? 'YES' : 'NO'}`);

        try {
            const decodedToken = await admin.auth().verifyIdToken(token);
            req.userId = decodedToken.uid;
            console.log(`[PROTECT DEBUG] Token decoded. UID: ${req.userId}`);

            const db = await getDb(); // Get the db instance within the function
            // MODIFIED: Changed ? to $1 for PostgreSQL parameter
            const userQuery = 'SELECT id, role FROM users WHERE id = $1';
            const user = await db.get(userQuery, [req.userId]);

            if (user) {
                req.userRole = user.role;
                console.log(`[PROTECT DEBUG] User ${req.userId} found in SQLite. Role: ${req.userRole}. Calling next().`);
                return next();
            } else {
                console.log(`[AUTH DEBUG] First-time login for UID: ${req.userId}. Creating user entry in SQLite and Firestore.`);

                console.log(`[AUTH DEBUG] Decoded Token Name: ${decodedToken.name}`);
                console.log(`[AUTH DEBUG] Decoded Token Email: ${decodedToken.email}`);
                console.log(`[AUTH DEBUG] Decoded Token Picture: ${decodedToken.picture}`);

                const initialUsername = decodedToken.name || decodedToken.email || `user_${req.userId.substring(0, 8)}`;
                const initialEmail = decodedToken.email || null;
                const initialAvatarUrl = decodedToken.picture || null;

                console.log(`[AUTH DEBUG] Determined initialUsername for SQLite/Firestore: "${initialUsername}"`);

                // MODIFIED: Changed ? to $1, $2, $3, $4, $5 for PostgreSQL parameters
                const insertQuery = 'INSERT INTO users (id, email, username, role, avatar_url) VALUES ($1, $2, $3, $4, $5)';
                const defaultRole = 'user';

                await db.run(insertQuery, [req.userId, initialEmail, initialUsername, defaultRole, initialAvatarUrl]);
                console.log(`[AUTH DEBUG] SQLite entry created for ${req.userId} with username: ${initialUsername}`);

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
            // The SQLITE_CONSTRAINT error code is specific to SQLite.
            // For PostgreSQL, check for error.code === '23505' for unique_violation.
            if (error.code === '23505' /* PostgreSQL unique_violation */ || error.code === 'SQLITE_CONSTRAINT') {
                try {
                    const db = await getDb(); // Get db for retry
                    const userQuery = 'SELECT id, role FROM users WHERE id = $1'; // MODIFIED: Changed ? to $1
                    const user = await db.get(userQuery, [req.userId]);
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
            // For general Firebase token verification errors
            if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
                 return res.status(401).json({ message: 'Authentication failed: Invalid or expired token.' });
            }
            return res.status(401).json({ message: 'Not authorized, token failed' });
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
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const decodedToken = await admin.auth().verifyIdToken(token);
            req.userId = decodedToken.uid;
        } catch (error) {
            req.userId = null;
        }
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