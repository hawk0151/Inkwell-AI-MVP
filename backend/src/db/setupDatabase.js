// backend/src/db/setupDatabase.js
// No need for sqlite3 import anymore since we're using pg directly or the adapter
// import sqlite3 from 'sqlite3';
import { getDb } from './database.js'; // Import getDb function

// Helper function to add a column if it doesn't exist
// MODIFIED: Takes 'client' as argument if it's PostgreSQL, uses dbInstance for SQLite
const addColumnIfNotExists = async (dbConnection, tableName, columnName, columnDefinition) => {
    try {
        if (dbConnection.query) { // Check if it's a pg Client (has .query method)
            const result = await dbConnection.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = $1 AND column_name = $2
            `, [tableName, columnName]);
            const columnExists = result.rows.length > 0;
            if (!columnExists) {
                console.log(`Adding column '${columnName}' to table '${tableName}' (PostgreSQL)...`);
                await dbConnection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
            }
        } else { // Assume it's the SQLite instance (for local dev)
            const result = await dbConnection.all(`PRAGMA table_info(${tableName})`);
            const columnExists = result.some(column => column.name === columnName);
            if (!columnExists) {
                console.log(`Adding column '${columnName}' to table '${tableName}' (SQLite)...`);
                await dbConnection.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
            }
        }
    } catch (error) {
        if (error.code === '42P01') { // PostgreSQL error code for undefined_table
             console.warn(`Table ${tableName} does not exist when trying to add column ${columnName}. Will be created later.`);
        } else {
            console.error(`Failed to add column ${columnName} to ${tableName}:`, error);
        }
    }
};

const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        username TEXT UNIQUE,
        role TEXT NOT NULL DEFAULT 'user',
        date_created TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        avatar_url TEXT
    );
`;

const createPictureBooksTable = `
    CREATE TABLE IF NOT EXISTS picture_books (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_public BOOLEAN DEFAULT FALSE,
        like_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        cover_image_url TEXT,
        date_created TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        interior_pdf_url TEXT,
        cover_pdf_url TEXT,
        lulu_product_id TEXT
    );
`;

const createTextBooksTable = `
    CREATE TABLE IF NOT EXISTS text_books (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_public BOOLEAN DEFAULT FALSE,
        like_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        cover_image_url TEXT,
        prompt_details TEXT,
        lulu_product_id TEXT,
        interior_pdf_url TEXT,
        cover_pdf_url TEXT,
        date_created TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        total_chapters INTEGER DEFAULT 0
    );
`;

const createChaptersTable = `
    CREATE TABLE IF NOT EXISTS chapters (
        id SERIAL PRIMARY KEY,
        book_id TEXT NOT NULL,
        chapter_number INTEGER NOT NULL,
        content TEXT,
        date_created TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES text_books(id) ON DELETE CASCADE
    );
`;

const createTimelineEventsTable = `
    CREATE TABLE IF NOT EXISTS timeline_events (
        id SERIAL PRIMARY KEY,
        book_id TEXT NOT NULL,
        page_number INTEGER NOT NULL,
        event_date TEXT,
        description TEXT,
        image_url TEXT,
        image_style TEXT,
        uploaded_image_url TEXT,
        overlay_text TEXT,
        UNIQUE(book_id, page_number),
        FOREIGN KEY(book_id) REFERENCES picture_books(id) ON DELETE CASCADE
    );
`;

const createFollowsTable = `
    CREATE TABLE IF NOT EXISTS follows (
        follower_id TEXT NOT NULL,
        following_id TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (follower_id, following_id)
    );
`;

const createLikesTable = `
    CREATE TABLE IF NOT EXISTS likes (
        user_id TEXT NOT NULL,
        book_id TEXT NOT NULL,
        book_type TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, book_id, book_type)
    );
`;

const createCommentsTable = `
    CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        book_id TEXT NOT NULL,
        book_type TEXT NOT NULL,
        comment_text TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
`;

export const setupDatabase = async () => {
    let client; // Declare client for transaction management for PostgreSQL
    try {
        const poolOrSqliteDb = await getDb(); // Get the pool (either pg.Pool or SQLite instance)

        if (poolOrSqliteDb.query && poolOrSqliteDb.connect) { // Check if it's a pg.Pool instance (production)
            client = await poolOrSqliteDb.connect(); // Get a client from the pool
            console.log("Setting up database tables (PostgreSQL)...");
            await client.query(createUsersTable); // Use client.query
            await client.query(createPictureBooksTable);
            await client.query(createTextBooksTable);
            await client.query(createChaptersTable);
            await client.query(createTimelineEventsTable);
            await client.query(createFollowsTable);
            await client.query(createLikesTable);
            await client.query(createCommentsTable);

            // For addColumnIfNotExists, pass the acquired client
            console.log("Checking and adding missing columns (PostgreSQL)...");
            await addColumnIfNotExists(client, 'users', 'avatar_url', 'TEXT');
            await addColumnIfNotExists(client, 'text_books', 'prompt_details', 'TEXT');
            await addColumnIfNotExists(client, 'text_books', 'lulu_product_id', 'TEXT');
            await addColumnIfNotExists(client, 'text_books', 'interior_pdf_url', 'TEXT');
            await addColumnIfNotExists(client, 'text_books', 'cover_pdf_url', 'TEXT');
            await addColumnIfNotExists(client, 'text_books', 'date_created', 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP');
            await addColumnIfNotExists(client, 'text_books', 'is_public', 'BOOLEAN DEFAULT FALSE');
            await addColumnIfNotExists(client, 'text_books', 'total_chapters', 'INTEGER DEFAULT 0');

            await addColumnIfNotExists(client, 'picture_books', 'interior_pdf_url', 'TEXT');
            await addColumnIfNotExists(client, 'picture_books', 'cover_pdf_url', 'TEXT');
            await addColumnIfNotExists(client, 'picture_books', 'lulu_product_id', 'TEXT');
            await addColumnIfNotExists(client, 'picture_books', 'date_created', 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP');
            await addColumnIfNotExists(client, 'picture_books', 'is_public', 'BOOLEAN DEFAULT FALSE');

            await addColumnIfNotExists(client, 'timeline_events', 'uploaded_image_url', 'TEXT');
            await addColumnIfNotExists(client, 'timeline_events', 'overlay_text', 'TEXT');

        } else { // It's the SQLite instance (development)
            console.log("Setting up database tables (SQLite)...");
            await poolOrSqliteDb.exec(createUsersTable); // Use exec for SQLite
            await poolOrSqliteDb.exec(createPictureBooksTable);
            await poolOrSqliteDb.exec(createTextBooksTable);
            await poolOrSqliteDb.exec(createChaptersTable);
            await poolOrSqliteDb.exec(createTimelineEventsTable);
            await poolOrSqliteDb.exec(createFollowsTable);
            await poolOrSqliteDb.exec(createLikesTable);
            await poolOrSqliteDb.exec(createCommentsTable);

            // For addColumnIfNotExists, pass the SQLite instance (which has .exec)
            console.log("Checking and adding missing columns (SQLite)...");
            await addColumnIfNotExists(poolOrSqliteDb, 'users', 'avatar_url', 'TEXT');
            await addColumnIfNotExists(poolOrSqliteDb, 'text_books', 'prompt_details', 'TEXT');
            await addColumnIfNotExists(poolOrSqliteDb, 'text_books', 'lulu_product_id', 'TEXT');
            await addColumnIfNotExists(poolOrSqliteDb, 'text_books', 'interior_pdf_url', 'TEXT');
            await addColumnIfNotExists(poolOrSqliteDb, 'text_books', 'cover_pdf_url', 'TEXT');
            await addColumnIfNotExists(poolOrSqliteDb, 'text_books', 'date_created', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
            await addColumnIfNotExists(poolOrSqliteDb, 'text_books', 'is_public', 'BOOLEAN DEFAULT 0');
            await addColumnIfNotExists(poolOrSqliteDb, 'text_books', 'total_chapters', 'INTEGER DEFAULT 0');

            await addColumnIfNotExists(poolOrSqliteDb, 'picture_books', 'interior_pdf_url', 'TEXT');
            await addColumnIfNotExists(poolOrSqliteDb, 'picture_books', 'cover_pdf_url', 'TEXT');
            await addColumnIfNotExists(poolOrSqliteDb, 'picture_books', 'lulu_product_id', 'TEXT');
            await addColumnIfNotExists(poolOrSqliteDb, 'picture_books', 'date_created', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
            await addColumnIfNotExists(poolOrSqliteDb, 'picture_books', 'is_public', 'BOOLEAN DEFAULT 0');

            await addColumnIfNotExists(poolOrSqliteDb, 'timeline_events', 'uploaded_image_url', 'TEXT');
            await addColumnIfNotExists(poolOrSqliteDb, 'timeline_events', 'overlay_text', 'TEXT');
        }

        console.log("✅ All application tables are ready.");
    } catch (error) {
        console.error("❌ Error setting up tables:", error);
        throw error;
    } finally {
        if (client) client.release(); // Release client back to pool if it was acquired
    }
};