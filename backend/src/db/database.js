import sqlite3 from 'sqlite3';
import { open } from 'sqlite'; // Used for SQLite connection
import pg from 'pg'; // NEW: Import PostgreSQL client
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Determine if we are in a production environment
const isProduction = process.env.NODE_ENV === 'production';

// SQLite specific paths (only used in development)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'inkwell.db');

let db = null; // Initialize db to null

export async function getDb() {
    if (db) {
        // If db is already connected, return the existing instance
        return db;
    }

    try {
        if (isProduction) {
            // NEW: Connect to PostgreSQL in production
            if (!process.env.DATABASE_URL) {
                throw new Error('DATABASE_URL environment variable is not set for production.');
            }
            console.log("Attempting to connect to PostgreSQL...");
            const { Pool } = pg;
            const pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                // NEW: Add SSL options for Render's PostgreSQL
                ssl: {
                    rejectUnauthorized: false // Required for Render connections
                }
            });
            // Test the connection
            db = await pool.connect();
            console.log("✅ Successfully connected to the PostgreSQL database.");
            // Override exec and all methods to work with pg.Pool client
            db.exec = async (sql) => {
                try {
                    await db.query(sql);
                } finally {
                    // Release the client back to the pool if it was a direct client, not for pool.connect()
                }
            };
            db.all = async (sql, params = []) => {
                const res = await db.query(sql, params);
                return res.rows;
            };
            db.get = async (sql, params = []) => {
                const res = await db.query(sql, params);
                return res.rows[0];
            };
            db.run = async (sql, params = []) => {
                const res = await db.query(sql, params);
                // Simulate lastID and changes for compatibility if needed.
                return { lastID: null, changes: res.rowCount };
            };
            db._isPg = true;
            return db;

        } else {
            // Connect to SQLite in development
            console.log("Attempting to connect to SQLite...");
            db = await open({
                filename: DB_PATH,
                driver: sqlite3.Database
            });

            await db.exec('PRAGMA journal_mode = WAL;');
            console.log("✅ Successfully connected to the SQLite database.");
            db._isPg = false; // Set a flag for SQLite connection
            return db;
        }
    } catch (err) {
        console.error("❌ Error connecting to database:", err.message);
        throw err; // Re-throw the error so calling code knows it failed
    }
}