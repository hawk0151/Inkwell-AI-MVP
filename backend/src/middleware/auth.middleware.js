// backend/src/middleware/auth.middleware.js
import admin from 'firebase-admin';
import { getDb } from '../db/database.js';

export const protect = async (req, res, next) => {
    let token;
    let client;

    if (process.env.NODE_ENV === 'development') {
        console.log(`[PROTECT DEBUG] Request to: ${req.method} ${req.originalUrl}`);
    }

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
        if (process.env.NODE_ENV === 'development') {
            console.log(`[PROTECT DEBUG] Token found: ${token ? 'YES' : 'NO'}`);
        }

        try {
            const decodedToken = await admin.auth().verifyIdToken(token);
            req.userId = decodedToken.uid;
            if (process.env.NODE_ENV === 'development') {
                console.log(`[PROTECT DEBUG] Token decoded. UID: ${req.userId}`);
            }

            const pool = await getDb();
            client = await pool.connect();

            const userQuery = 'SELECT id, role FROM users WHERE id = $1';
            const userResult = await client.query(userQuery, [req.userId]);
            const user = userResult.rows[0];

            if (user) {
                req.userRole = user.role;
                if (process.env.NODE_ENV === 'development') {
                    console.log(`[PROTECT DEBUG] User ${req.userId} found in DB. Role: ${req.userRole}. Calling next().`);
                }
                return next();
            } else {
                if (process.env.NODE_ENV === 'development') {
                    console.log(`[AUTH DEBUG] First-time login for UID: ${req.userId}. Creating user entry...`);
                }

                const initialUsername = decodedToken.name || decodedToken.email || `user_${req.userId.substring(0, 8)}`;
                const initialEmail = decodedToken.email || null;
                const initialAvatarUrl = decodedToken.picture || null;

                const insertQuery = 'INSERT INTO users (id, email, username, role, avatar_url) VALUES ($1, $2, $3, $4, $5)';
                const defaultRole = 'user';

                await client.query(insertQuery, [req.userId, initialEmail, initialUsername, defaultRole, initialAvatarUrl]);
                
                if (process.env.NODE_ENV === 'development') {
                    console.log(`[AUTH DEBUG] DB entry created for ${req.userId}`);
                }

                req.userRole = defaultRole;
                return next();
            }
        } catch (error) {
            console.error('[PROTECT ERROR] Error in authentication middleware:', error.message);
            // Handle specific auth errors
            if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
                 return res.status(401).json({ message: 'Authentication failed: Invalid or expired token.' });
            }
            return res.status(401).json({ message: 'Not authorized, token failed' });
        } finally {
            if (client) client.release();
        }
    }

    if (!token) {
        console.warn('[PROTECT WARNING] No token provided in protected route.');
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

export const optionalAuth = async (req, res, next) => {
    try {
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            const token = req.headers.authorization.split(' ')[1];
            const decodedToken = await admin.auth().verifyIdToken(token);
            req.userId = decodedToken.uid;
        }
    } catch (error) {
        // If token is invalid or missing, just proceed without a userId
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