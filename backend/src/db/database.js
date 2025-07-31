// backend/src/db/database.js
import pg from 'pg'; // Import PostgreSQL client

let dbPool = null;

export async function getDb() {
    // If the pool already exists, return it.
    if (dbPool) {
        return dbPool;
    }

    try {
        // This is now the ONLY connection logic.
        // It requires the DATABASE_URL to be set in your .env file for local development.
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

        // Test the connection to ensure it's working.
        const client = await dbPool.connect();
        console.log("✅ Successfully connected to the PostgreSQL database pool.");
        client.release(); // Release the client back to the pool.
        
        return dbPool;

    } catch (err) {
        console.error("❌ Error connecting to PostgreSQL database:", err.message);
        // Exit the process if the database connection fails, as the app cannot run without it.
        process.exit(1); 
    }
}