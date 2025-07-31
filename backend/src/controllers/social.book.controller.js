// backend/src/controllers/social.book.controller.js
import { getDb } from '../db/database.js';
import admin from 'firebase-admin';

// Helper function to accept both camelCase and snake_case
const getTableName = (bookType) => {
    const validTypes = {
        'pictureBook': 'picture_books',
        'picture_book': 'picture_books',
        'textBook': 'text_books',
        'text_book': 'text_books'
    };
    return validTypes[bookType] || null;
};

// --- Like / Unlike a Book ---
export const likeBook = async (req, res) => {
    let client;
    const { bookId, bookType } = req.body;
    const userId = req.userId;
    const tableName = getTableName(bookType);

    console.log(`[LIKE DEBUG] User ${userId} attempting to like book ${bookId} of type ${bookType}`);

    if (!tableName) {
        console.error(`[LIKE ERROR] Invalid book type: ${bookType}`);
        return res.status(400).json({ message: 'Invalid book type specified.' });
    }

    try {
        const pool = await getDb();
        client = await pool.connect();
        await client.query('BEGIN');

        const checkLikeQuery = 'SELECT 1 FROM likes WHERE user_id = $1 AND book_id = $2 AND book_type = $3';
        const existingLikeResult = await client.query(checkLikeQuery, [userId, bookId, bookType]);
        const existingLike = existingLikeResult.rows[0];

        if (existingLike) {
            console.warn(`[LIKE DEBUG] User ${userId} already liked book ${bookId}. Not inserting.`);
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'You have already liked this book.' });
        }

        const insertLikeQuery = 'INSERT INTO likes (user_id, book_id, book_type) VALUES ($1, $2, $3)';
        const insertResult = await client.query(insertLikeQuery, [userId, bookId, bookType]);
        console.log(`[LIKE DEBUG] Inserted into likes table. Changes: ${insertResult.rowCount}`);

        const updateCountQuery = `UPDATE ${tableName} SET like_count = like_count + 1 WHERE id = $1`;
        const updateResult = await client.query(updateCountQuery, [bookId]);
        console.log(`[LIKE DEBUG] Updated ${tableName} like_count. Changes: ${updateResult.rowCount}`);

        await client.query('COMMIT');
        console.log(`[LIKE DEBUG] Transaction committed for liking book ${bookId}.`);

        res.status(201).json({ message: 'Book liked successfully.' });
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error(`[LIKE ERROR] Error liking book ${bookId}:`, error);
        res.status(500).json({ message: 'Server error while liking book.' });
    } finally {
        if (client) client.release();
    }
};

export const unlikeBook = async (req, res) => {
    let client;
    const { bookId, bookType } = req.body;
    const userId = req.userId;
    const tableName = getTableName(bookType);

    console.log(`[UNLIKE DEBUG] User ${userId} attempting to unlike book ${bookId} of type ${bookType}`);

    if (!tableName) {
        console.error(`[UNLIKE ERROR] Invalid book type: ${bookType}`);
        return res.status(400).json({ message: 'Invalid book type specified.' });
    }

    try {
        const pool = await getDb();
        client = await pool.connect();
        await client.query('BEGIN');
        
        const deleteLikeQuery = 'DELETE FROM likes WHERE user_id = $1 AND book_id = $2 AND book_type = $3';
        const deleteResult = await client.query(deleteLikeQuery, [userId, bookId, bookType]);
        console.log(`[UNLIKE DEBUG] Deleted from likes table. Changes: ${deleteResult.rowCount}`);

        if (deleteResult.rowCount > 0) {
            const updateCountQuery = `UPDATE ${tableName} SET like_count = MAX(0, like_count - 1) WHERE id = $1`;
            const updateResult = await client.query(updateCountQuery, [bookId]);
            console.log(`[UNLIKE DEBUG] Updated ${tableName} like_count. Changes: ${updateResult.rowCount}`);
        } else {
            console.warn(`[UNLIKE DEBUG] No like found for user ${userId} on book ${bookId}.`);
        }
        await client.query('COMMIT');
        console.log(`[UNLIKE DEBUG] Transaction committed for unliking book ${bookId}.`);

        res.status(200).json({ message: 'Book unliked successfully.' });
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error(`[UNLIKE ERROR] Error unliking book ${bookId}:`, error);
        res.status(500).json({ message: 'Server error while unliking book.' });
    } finally {
        if (client) client.release();
    }
};

// --- Comments ---
export const addComment = async (req, res) => {
    let client;
    const { bookId, bookType, commentText } = req.body;
    const userId = req.userId;
    const tableName = getTableName(bookType);

    if (!tableName) {
        return res.status(400).json({ message: 'Invalid book type specified.' });
    }
    if (!commentText || commentText.trim() === '') {
        return res.status(400).json({ message: 'Comment text cannot be empty.' });
    }

    console.log(`[COMMENT DEBUG] User ${userId} attempting to add comment to book ${bookId} of type ${bookType}`);

    try {
        const pool = await getDb();
        client = await pool.connect();
        await client.query('BEGIN');
        
        const insertQuery = 'INSERT INTO comments (user_id, book_id, book_type, comment_text) VALUES ($1, $2, $3, $4)';
        const insertResult = await client.query(insertQuery, [userId, bookId, bookType, commentText]);
        // For SERIAL primary keys, you can get the lastID via RETURNING id
        console.log(`[COMMENT DEBUG] Inserted into comments table. Changes: ${insertResult.rowCount}. New comment ID: ${insertResult.rows[0]?.id}`); // Assuming RETURNING id in insert

        const updateCountQuery = `UPDATE ${tableName} SET comment_count = comment_count + 1 WHERE id = $1`;
        const updateResult = await client.query(updateCountQuery, [bookId]);
        console.log(`[COMMENT DEBUG] Updated ${tableName} comment_count. Changes: ${updateResult.rowCount}`);

        await client.query('COMMIT');
        console.log(`[COMMENT DEBUG] Transaction committed for adding comment.`);
        res.status(201).json({ message: 'Comment added successfully.' });
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error("[COMMENT ERROR] Error adding comment:", error);
        res.status(500).json({ message: 'Server error while adding comment.' });
    } finally {
        if (client) client.release();
    }
};

export const getCommentsForBook = async (req, res) => {
    let client;
    const { bookId, bookType } = req.params;
    console.log(`[COMMENTS FETCH DEBUG] Fetching comments for book ID: ${bookId}, Type: ${bookType}`);

    try {
        const pool = await getDb();
        client = await pool.connect();
        
        const query = `
            SELECT
                c.id,
                c.user_id,
                c.book_id,
                c.book_type,
                c.comment_text,
                c.created_at,
                u.username AS username,
                u.avatar_url AS user_avatar_url
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.book_id = $1 AND c.book_type = $2
            ORDER BY c.created_at DESC`;
        const commentsResult = await client.query(query, [bookId, bookType]);
        const comments = commentsResult.rows;
        console.log(`[COMMENTS FETCH DEBUG] Found ${comments.length} comments. Sample:`, comments[0]);

        if (comments.length > 0 && !comments[0].username) {
            console.warn(`[COMMENTS FETCH WARNING] First comment returned with no username. Check 'users' table 'username' field values or 'id' consistency.`);
            console.warn(`[COMMENTS FETCH WARNING] Problematic Comment Data:`, comments[0]);
        }

        res.json(comments);
    } catch (error) {
        console.error("[COMMENTS FETCH ERROR] Error getting comments:", error);
        res.status(500).json({ message: 'Server error while fetching comments.' });
    } finally {
        if (client) client.release();
    }
};

export const deleteComment = async (req, res) => {
    let client;
    const { commentId, bookId, bookType } = req.params;
    const userId = req.userId;

    const tableName = getTableName(bookType);

    if (!tableName) {
        return res.status(400).json({ message: 'Invalid book type specified.' });
    }

    console.log(`[COMMENT DELETE DEBUG] User ${userId} attempting to delete comment ${commentId} for book ${bookId} (${bookType})`);

    try {
        const pool = await getDb();
        client = await pool.connect();
        await client.query('BEGIN');

        const commentQuery = 'SELECT user_id FROM comments WHERE id = $1 AND book_id = $2 AND book_type = $3';
        const commentResult = await client.query(commentQuery, [commentId, bookId, bookType]);
        const comment = commentResult.rows[0];

        if (!comment) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Comment not found.' });
        }

        if (comment.user_id !== userId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'You are not authorized to delete this comment.' });
        }

        const deleteQuery = 'DELETE FROM comments WHERE id = $1';
        const deleteResult = await client.query(deleteQuery, [commentId]);
        console.log(`[COMMENT DELETE DEBUG] Deleted from comments table. Changes: ${deleteResult.rowCount}`);

        if (deleteResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Comment not found or already deleted.' });
        }

        const updateCountQuery = `UPDATE ${tableName} SET comment_count = MAX(0, comment_count - 1) WHERE id = $1`;
        const updateResult = await client.query(updateCountQuery, [bookId]);
        console.log(`[COMMENT DELETE DEBUG] Updated ${tableName} comment_count. Changes: ${updateResult.rowCount}`);

        await client.query('COMMIT');
        console.log(`[COMMENT DELETE DEBUG] Transaction committed for deleting comment ${commentId}.`);
        res.status(200).json({ message: 'Comment deleted successfully.' });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error("[COMMENT DELETE ERROR] Error deleting comment:", error);
        res.status(500).json({ message: 'Server error while deleting comment.' });
    } finally {
        if (client) client.release();
    }
};

export const toggleBookPrivacy = async (req, res) => {
    let client;
    const { bookId, bookType } = req.body;
    const userId = req.userId;
    const tableName = getTableName(bookType);

    if (!tableName) {
        return res.status(400).json({ message: 'Invalid book type specified.' });
    }

    try {
        const pool = await getDb();
        client = await pool.connect();
        
        const ownerQuery = `SELECT user_id, is_public FROM ${tableName} WHERE id = $1`;
        const bookResult = await client.query(ownerQuery, [bookId]);
        const book = bookResult.rows[0];

        if (!book) {
            return res.status(404).json({ message: 'Book not found.' });
        }

        if (book.user_id !== userId) {
            return res.status(403).json({ message: 'You are not authorized to change this book\'s privacy.' });
        }

        const toggleQuery = `UPDATE ${tableName} SET is_public = NOT is_public WHERE id = $1`;
        await client.query(toggleQuery, [bookId]);

        const newIsPublicStatus = !book.is_public;

        res.status(200).json({
            message: `Book status successfully set to ${newIsPublicStatus ? 'public' : 'private'}.`,
            is_public: newIsPublicStatus
        });
    } catch (error) {
        if (client) await client.query('ROLLBACK'); // Rollback if transaction exists, though this isn't a transaction currently
        console.error("Error toggling book privacy:", error);
        res.status(500).json({ message: 'Server error while toggling book privacy.' });
    } finally {
        if (client) client.release();
    }
};