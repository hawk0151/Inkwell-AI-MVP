// backend/src/db/database.js
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

let dbPool = null; // Changed from 'db' to 'dbPool' to better represent a pg.Pool

export async function getDb() {
    if (dbPool) {
        return dbPool; // Return the pool directly
    }

    try {
        if (isProduction) {
            if (!process.env.DATABASE_URL) {
                throw new Error('DATABASE_URL environment variable is not set for production.');
            }
            console.log("Attempting to connect to PostgreSQL...");
            const { Pool } = pg;
            dbPool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: {
                    rejectUnauthorized: false
                }
            });

            await dbPool.query('SELECT 1 + 1 AS solution'); // Test the connection
            console.log("✅ Successfully connected to the PostgreSQL database pool.");
            return dbPool;

        } else {
            console.log("Attempting to connect to SQLite...");
            const sqliteDb = await open({
                filename: DB_PATH,
                driver: sqlite3.Database
            });

            await sqliteDb.exec('PRAGMA journal_mode = WAL;');
            console.log("✅ Successfully connected to the SQLite database.");
            
            // Re-add simplified adapters for SQLite local compatibility
            sqliteDb.all = (sql, params = []) => new Promise((resolve, reject) => {
                sqliteDb.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
            });
            sqliteDb.get = (sql, params = []) => new Promise((resolve, reject) => {
                sqliteDb.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
            });
            sqliteDb.run = (sql, params = []) => new Promise((resolve, reject) => {
                sqliteDb.run(sql, params, function(err) {
                    if (err) return reject(err);
                    resolve({ lastID: this.lastID, changes: this.changes });
                });
            });
            sqliteDb.exec = (sql) => new Promise((resolve, reject) => {
                sqliteDb.exec(sql, (err) => err ? reject(err) : resolve());
            });

            dbPool = sqliteDb; // Assign SQLite instance to dbPool for consistency
            return dbPool;
        }
    } catch (err) {
        console.error("❌ Error connecting to database:", err.message);
        throw err;
    }
}