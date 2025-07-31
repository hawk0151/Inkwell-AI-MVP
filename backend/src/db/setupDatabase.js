import { getDb } from './database.js';

// Helper function to add a column if it doesn't exist
// This needs to be slightly smarter for PG, as PRAGMA table_info is SQLite-specific.
// For PG, we query information_schema.columns.
const addColumnIfNotExists = async (dbInstance, tableName, columnName, columnDefinition) => {
    try {
        if (dbInstance._isPg) { // Check if it's a PostgreSQL connection
            const result = await dbInstance.all(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = $1 AND column_name = $2
            `, [tableName, columnName]);
            const columnExists = result.length > 0;
            if (!columnExists) {
                console.log(`Adding column '${columnName}' to table '${tableName}' (PostgreSQL)...`);
                await dbInstance.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
            }
        } else { // Assume SQLite
            const result = await dbInstance.all(`PRAGMA table_info(${tableName})`);
            const columnExists = result.some(column => column.name === columnName);
            if (!columnExists) {
                console.log(`Adding column '${columnName}' to table '${tableName}' (SQLite)...`);
                await dbInstance.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
            }
        }
    } catch (error) {
        if (!error.message.includes('relation "')) { // PostgreSQL "no such table" might be "relation 'tablename' does not exist"
            console.error(`Failed to add column ${columnName} to ${tableName}:`, error);
        }
    }
};

// SQL for PostgreSQL - Changes:
// - INTEGER PRIMARY KEY AUTOINCREMENT -> SERIAL PRIMARY KEY (or GENERATED ALWAYS AS IDENTITY)
// - BOOLEAN DEFAULT 0 -> BOOLEAN DEFAULT FALSE (for clarity, though 0/1 often works)
// - TEXT PRIMARY KEY -> TEXT PRIMARY KEY (UUIDs should be TEXT in PG)

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
        id SERIAL PRIMARY KEY, -- Changed from INTEGER PRIMARY KEY AUTOINCREMENT
        book_id TEXT NOT NULL,
        chapter_number INTEGER NOT NULL,
        content TEXT,
        date_created TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES text_books(id) ON DELETE CASCADE
    );
`;

const createTimelineEventsTable = `
    CREATE TABLE IF NOT EXISTS timeline_events (
        id SERIAL PRIMARY KEY, -- Changed from INTEGER PRIMARY KEY AUTOINCREMENT
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
        id SERIAL PRIMARY KEY, -- Changed from INTEGER PRIMARY KEY AUTOINCREMENT
        user_id TEXT NOT NULL,
        book_id TEXT NOT NULL,
        book_type TEXT NOT NULL,
        comment_text TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
`;

export const setupDatabase = async () => {
    try {
        const dbInstance = await getDb();

        // --- Create Tables ---
        console.log("Setting up database tables...");
        await dbInstance.exec(createUsersTable);
        await dbInstance.exec(createPictureBooksTable);
        await dbInstance.exec(createTextBooksTable);
        await dbInstance.exec(createChaptersTable);
        await dbInstance.exec(createTimelineEventsTable);
        await dbInstance.exec(createFollowsTable);
        await dbInstance.exec(createLikesTable);
        await dbInstance.exec(createCommentsTable);

        // --- Add Missing Columns to Tables (as a fallback) ---
        // Ensure that column additions are idempotent and handle existing columns.
        // PostgreSQL ALTER TABLE ADD COLUMN IF NOT EXISTS is in newer versions, older requires check.
        // Our addColumnIfNotExists helper handles this by checking information_schema for PG.
        console.log("Checking and adding missing columns...");
        await addColumnIfNotExists(dbInstance, 'users', 'avatar_url', 'TEXT');
        await addColumnIfNotExists(dbInstance, 'text_books', 'prompt_details', 'TEXT');
        await addColumnIfNotExists(dbInstance, 'text_books', 'lulu_product_id', 'TEXT');
        await addColumnIfNotExists(dbInstance, 'text_books', 'interior_pdf_url', 'TEXT');
        await addColumnIfNotExists(dbInstance, 'text_books', 'cover_pdf_url', 'TEXT');
        await addColumnIfNotExists(dbInstance, 'text_books', 'date_created', 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP');
        await addColumnIfNotExists(dbInstance, 'text_books', 'is_public', 'BOOLEAN DEFAULT FALSE');
        await addColumnIfNotExists(dbInstance, 'text_books', 'total_chapters', 'INTEGER DEFAULT 0');

        await addColumnIfNotExists(dbInstance, 'picture_books', 'interior_pdf_url', 'TEXT');
        await addColumnIfNotExists(dbInstance, 'picture_books', 'cover_pdf_url', 'TEXT');
        await addColumnIfNotExists(dbInstance, 'picture_books', 'lulu_product_id', 'TEXT');
        await addColumnIfNotExists(dbInstance, 'picture_books', 'date_created', 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP');
        await addColumnIfNotExists(dbInstance, 'picture_books', 'is_public', 'BOOLEAN DEFAULT FALSE');

        await addColumnIfNotExists(dbInstance, 'timeline_events', 'uploaded_image_url', 'TEXT');
        await addColumnIfNotExists(dbInstance, 'timeline_events', 'overlay_text', 'TEXT');

        console.log("✅ All application tables are ready.");
    } catch (error) {
        console.error("❌ Error setting up tables:", error);
        // Important: Re-throw the error so the server doesn't start with a bad DB connection
        throw error;
    }
};