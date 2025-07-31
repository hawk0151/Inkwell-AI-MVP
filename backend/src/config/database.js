// backend/src/config/database.js
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const dbPath = path.join(projectRoot, 'db', 'inkwell.db');

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening database", err.message);
  } else {
    console.log("Database connected successfully.");
    createTables();
  }
});

const createTables = () => {
    const usersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      google_id TEXT,
      date_created TEXT NOT NULL
    );
  `;
    const ordersTable = `
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      stripe_session_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      total_price REAL NOT NULL,
      order_status TEXT NOT NULL,
      date_ordered TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );
  `;
    const pictureBooksTable = `
    CREATE TABLE IF NOT EXISTS picture_books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      product_id TEXT,
      interior_pdf_url TEXT,
      cover_pdf_url TEXT,
      date_created TEXT NOT NULL,
      last_modified TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );
  `;
    const timelineEventsTable = `
    CREATE TABLE IF NOT EXISTS timeline_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      page_number INTEGER NOT NULL,
      event_date TEXT,
      description TEXT,
      image_url TEXT,
      image_style TEXT,
      FOREIGN KEY (book_id) REFERENCES picture_books (id),
      UNIQUE(book_id, page_number)
    );
  `;
    // --- NEW TABLE for Text-Based Books ---
    const textBooksTable = `
    CREATE TABLE IF NOT EXISTS text_books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        prompt_details TEXT NOT NULL, -- Storing the initial prompt as JSON
        lulu_product_id TEXT NOT NULL,
        date_created TEXT NOT NULL,
        last_modified TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );
  `;
    // --- NEW TABLE for Individual Chapters ---
    const chaptersTable = `
    CREATE TABLE IF NOT EXISTS chapters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER NOT NULL,
        chapter_number INTEGER NOT NULL,
        content TEXT NOT NULL,
        date_created TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES text_books (id),
        UNIQUE(book_id, chapter_number)
    );
  `;

    db.serialize(() => {
        db.exec(usersTable, err => err ? console.error("Error creating users table:", err.message) : console.log("Users table is ready."));
        db.exec(ordersTable, err => err ? console.error("Error creating orders table:", err.message) : console.log("Orders table is ready."));
        db.exec(pictureBooksTable, err => err ? console.error("Error creating picture_books table:", err.message) : console.log("Picture books table is ready."));
        db.exec(timelineEventsTable, err => err ? console.error("Error creating timeline_events table:", err.message) : console.log("Timeline events table is ready."));
        db.exec(textBooksTable, err => err ? console.error("Error creating text_books table:", err.message) : console.log("Text books table is ready."));
        db.exec(chaptersTable, err => err ? console.error("Error creating chapters table:", err.message) : console.log("Chapters table is ready."));
    });
};

export default db;