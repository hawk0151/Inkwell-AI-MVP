// backend/src/db/database.js
import pg from 'pg'; // Import PostgreSQL client

let dbPool = null;

// --- MODIFICATION: New explicit initialization function ---
// Any part of the application that needs the database MUST call this first.
export async function initializeDb() {
    // If the pool is already initialized, do nothing.
    if (dbPool) {
        return;
    }

    try {
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL environment variable is not set.');
        }

        console.log("Attempting to connect to PostgreSQL...");
        const { Pool } = pg;
        dbPool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false // Required for services like Render
            }
        });

        // Test the connection.
        const client = await dbPool.connect();
        console.log("✅ Successfully connected to the PostgreSQL database pool.");
        client.release();
        
    } catch (err) {
        console.error("❌ Error initializing PostgreSQL database pool:", err.message);
        process.exit(1);
    }
}

// --- MODIFICATION: getDb now assumes initialization has already happened. ---
export function getDb() {
    // This function no longer creates the pool. It only returns the existing one.
    if (!dbPool) {
        throw new Error('Database has not been initialized. Please call initializeDb() first.');
    }
    return dbPool;
}