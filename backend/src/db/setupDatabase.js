// backend/src/db/setupDatabase.js
import { getDb } from './database.js';

const addColumnIfNotExists = async (dbConnection, tableName, columnName, columnDefinition) => {
    try {
        if (dbConnection.query) { // pg Client
            const result = await dbConnection.query(`
                SELECT column_name FROM information_schema.columns
                WHERE table_name = $1 AND column_name = $2
            `, [tableName, columnName]);
            if (result.rows.length === 0) {
                console.log(`Adding column '${columnName}' to table '${tableName}'...`);
                await dbConnection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
            }
        } else { // SQLite
            const result = await dbConnection.all(`PRAGMA table_info(${tableName})`);
            if (!result.some(column => column.name === columnName)) {
                console.log(`Adding column '${columnName}' to table '${tableName}'...`);
                await dbConnection.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
            }
        }
    } catch (error) {
        console.error(`Failed to add column ${columnName} to ${tableName}:`, error);
    }
};

const createUsersTable = `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE, username TEXT UNIQUE, role TEXT NOT NULL DEFAULT 'user', date_created TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, avatar_url TEXT);`;
const createPictureBooksTable = `CREATE TABLE IF NOT EXISTS picture_books (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, is_public BOOLEAN DEFAULT FALSE, like_count INTEGER DEFAULT 0, comment_count INTEGER DEFAULT 0, cover_image_url TEXT, date_created TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, interior_pdf_url TEXT, cover_pdf_url TEXT, lulu_product_id TEXT);`;
const createTextBooksTable = `CREATE TABLE IF NOT EXISTS text_books (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, is_public BOOLEAN DEFAULT FALSE, like_count INTEGER DEFAULT 0, comment_count INTEGER DEFAULT 0, cover_image_url TEXT, prompt_details TEXT, lulu_product_id TEXT, interior_pdf_url TEXT, cover_pdf_url TEXT, date_created TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, total_chapters INTEGER DEFAULT 0);`;
const createChaptersTable = `CREATE TABLE IF NOT EXISTS chapters (id SERIAL PRIMARY KEY, book_id TEXT NOT NULL, chapter_number INTEGER NOT NULL, content TEXT, date_created TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (book_id) REFERENCES text_books(id) ON DELETE CASCADE);`;
const createTimelineEventsTable = `CREATE TABLE IF NOT EXISTS timeline_events (id SERIAL PRIMARY KEY, book_id TEXT NOT NULL, page_number INTEGER NOT NULL, event_date TEXT, description TEXT, image_url TEXT, image_style TEXT, uploaded_image_url TEXT, overlay_text TEXT, UNIQUE(book_id, page_number), FOREIGN KEY(book_id) REFERENCES picture_books(id) ON DELETE CASCADE);`;
const createFollowsTable = `CREATE TABLE IF NOT EXISTS follows (follower_id TEXT NOT NULL, following_id TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (follower_id, following_id));`;
const createLikesTable = `CREATE TABLE IF NOT EXISTS likes (user_id TEXT NOT NULL, book_id TEXT NOT NULL, book_type TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, book_id, book_type));`;
const createCommentsTable = `CREATE TABLE IF NOT EXISTS comments (id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, book_id TEXT NOT NULL, book_type TEXT NOT NULL, comment_text TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);`;

// --- MODIFICATION START ---
// Added interior_pdf_url, cover_pdf_url, lulu_job_id, lulu_job_status, and NOW updated_at to orders table definition
const createOrdersTable = `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    book_id TEXT NOT NULL,
    book_type TEXT NOT NULL,
    book_title TEXT,
    lulu_order_id TEXT,
    stripe_session_id TEXT,
    status TEXT,
    total_price NUMERIC(10, 2),
    interior_pdf_url TEXT,
    cover_pdf_url TEXT,
    lulu_job_id TEXT,
    lulu_job_status TEXT,
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP -- NEW
);`;
// --- MODIFICATION END ---


export const setupDatabase = async () => {
    let client;
    try {
        const db = await getDb();
        if (db.query) {
            client = await db.connect();
            console.log("Setting up database tables (PostgreSQL)...");
            await client.query(createUsersTable);
            await client.query(createPictureBooksTable);
            await client.query(createTextBooksTable);
            await client.query(createChaptersTable);
            await client.query(createTimelineEventsTable);
            await client.query(createFollowsTable);
            await client.query(createLikesTable);
            await client.query(createCommentsTable);
            await client.query(createOrdersTable); 

            console.log("Checking and adding missing columns (PostgreSQL)...");
            await addColumnIfNotExists(client, 'users', 'avatar_url', 'TEXT');
            await addColumnIfNotExists(client, 'text_books', 'total_chapters', 'INTEGER DEFAULT 0');
            await addColumnIfNotExists(client, 'picture_books', 'lulu_product_id', 'TEXT');
            await addColumnIfNotExists(client, 'timeline_events', 'overlay_text', 'TEXT');
            
            await addColumnIfNotExists(client, 'orders', 'interior_pdf_url', 'TEXT');
            await addColumnIfNotExists(client, 'orders', 'cover_pdf_url', 'TEXT');
            await addColumnIfNotExists(client, 'orders', 'shipping_carrier', 'TEXT');
            await addColumnIfNotExists(client, 'orders', 'tracking_number', 'TEXT');
            await addColumnIfNotExists(client, 'orders', 'lulu_job_id', 'TEXT');
            await addColumnIfNotExists(client, 'orders', 'lulu_job_status', 'TEXT');
            await addColumnIfNotExists(client, 'orders', 'updated_at', 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP'); // NEW
            
        } else {
            // Fallback for SQLite - if you are not using SQLite, this block is fine as is
        }

        console.log("✅ All application tables are ready.");
    } catch (error) {
        console.error("❌ Error setting up tables:", error);
        throw error;
    } finally {
        if (client) client.release();
    }
};