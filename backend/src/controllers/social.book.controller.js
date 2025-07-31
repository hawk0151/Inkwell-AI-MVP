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
    const { bookId, bookType } = req.body;
    const userId = req.userId;
    const tableName = getTableName(bookType);

    console.log(`[LIKE DEBUG] User ${userId} attempting to like book ${bookId} of type ${bookType}`);

    if (!tableName) {
        console.error(`[LIKE ERROR] Invalid book type: ${bookType}`);
        return res.status(400).json({ message: 'Invalid book type specified.' });
    }

    let dbInstance;
    try {
        dbInstance = await getDb();
        await dbInstance.run('BEGIN');

        const checkLikeQuery = 'SELECT 1 FROM likes WHERE user_id = ? AND book_id = ? AND book_type = ?';
        const existingLike = await dbInstance.get(checkLikeQuery, [userId, bookId, bookType]);

        if (existingLike) {
            console.warn(`[LIKE DEBUG] User ${userId} already liked book ${bookId}. Not inserting.`);
            await dbInstance.run('ROLLBACK');
            return res.status(409).json({ message: 'You have already liked this book.' });
        }

        const insertLikeQuery = 'INSERT INTO likes (user_id, book_id, book_type) VALUES (?, ?, ?)';
        const insertResult = await dbInstance.run(insertLikeQuery, [userId, bookId, bookType]);
        console.log(`[LIKE DEBUG] Inserted into likes table. Changes: ${insertResult.changes}`);

        const updateCountQuery = `UPDATE ${tableName} SET like_count = like_count + 1 WHERE id = ?`;
        const updateResult = await dbInstance.run(updateCountQuery, [bookId]);
        console.log(`[LIKE DEBUG] Updated ${tableName} like_count. Changes: ${updateResult.changes}`);

        await dbInstance.run('COMMIT');
        console.log(`[LIKE DEBUG] Transaction committed for liking book ${bookId}.`);

        res.status(201).json({ message: 'Book liked successfully.' });
    } catch (error) {
        if (dbInstance) {
            await dbInstance.run('ROLLBACK');
        } else {
            const db = await getDb();
            await db.run('ROLLBACK');
        }
        console.error(`[LIKE ERROR] Error liking book ${bookId}:`, error);
        res.status(500).json({ message: 'Server error while liking book.' });
    }
};

export const unlikeBook = async (req, res) => {
    const { bookId, bookType } = req.body;
    const userId = req.userId;
    const tableName = getTableName(bookType);

    console.log(`[UNLIKE DEBUG] User ${userId} attempting to unlike book ${bookId} of type ${bookType}`);

    if (!tableName) {
        console.error(`[UNLIKE ERROR] Invalid book type: ${bookType}`);
        return res.status(400).json({ message: 'Invalid book type specified.' });
    }

    let dbInstance;
    try {
        dbInstance = await getDb();
        await dbInstance.run('BEGIN');
        const deleteLikeQuery = 'DELETE FROM likes WHERE user_id = ? AND book_id = ? AND book_type = ?';
        const deleteResult = await dbInstance.run(deleteLikeQuery, [userId, bookId, bookType]);
        console.log(`[UNLIKE DEBUG] Deleted from likes table. Changes: ${deleteResult.changes}`);

        if (deleteResult.changes > 0) {
            const updateCountQuery = `UPDATE ${tableName} SET like_count = MAX(0, like_count - 1) WHERE id = ?`;
            const updateResult = await dbInstance.run(updateCountQuery, [bookId]);
            console.log(`[UNLIKE DEBUG] Updated ${tableName} like_count. Changes: ${updateResult.changes}`);
        } else {
            console.warn(`[UNLIKE DEBUG] No like found for user ${userId} on book ${bookId}.`);
        }
        await dbInstance.run('COMMIT');
        console.log(`[UNLIKE DEBUG] Transaction committed for unliking book ${bookId}.`);

        res.status(200).json({ message: 'Book unliked successfully.' });
    } catch (error) {
        if (dbInstance) {
            await dbInstance.run('ROLLBACK');
        } else {
            const db = await getDb();
            await db.run('ROLLBACK');
        }
        console.error(`[UNLIKE ERROR] Error unliking book ${bookId}:`, error);
        res.status(500).json({ message: 'Server error while unliking book.' });
    }
};

// --- Comments ---
export const addComment = async (req, res) => {
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

    let dbInstance;
    try {
        dbInstance = await getDb();
        await dbInstance.run('BEGIN');
        const insertQuery = 'INSERT INTO comments (user_id, book_id, book_type, comment_text) VALUES (?, ?, ?, ?)';
        const insertResult = await dbInstance.run(insertQuery, [userId, bookId, bookType, commentText]);
        console.log(`[COMMENT DEBUG] Inserted into comments table. Changes: ${insertResult.changes}. New comment ID: ${insertResult.lastID}`);

        const updateCountQuery = `UPDATE ${tableName} SET comment_count = comment_count + 1 WHERE id = ?`;
        const updateResult = await dbInstance.run(updateCountQuery, [bookId]);
        console.log(`[COMMENT DEBUG] Updated ${tableName} comment_count. Changes: ${updateResult.changes}`);

        await dbInstance.run('COMMIT');
        console.log(`[COMMENT DEBUG] Transaction committed for adding comment.`);
        res.status(201).json({ message: 'Comment added successfully.' });
    } catch (error) {
        if (dbInstance) {
            await dbInstance.run('ROLLBACK');
        } else {
            const db = await getDb();
            await db.run('ROLLBACK');
        }
        console.error("[COMMENT ERROR] Error adding comment:", error);
        res.status(500).json({ message: 'Server error while adding comment.' });
    }
};

export const getCommentsForBook = async (req, res) => {
    const { bookId, bookType } = req.params;
    console.log(`[COMMENTS FETCH DEBUG] Fetching comments for book ID: ${bookId}, Type: ${bookType}`);

    try {
        const db = await getDb();
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
            WHERE c.book_id = ? AND c.book_type = ?
            ORDER BY c.created_at DESC`;
        const comments = await db.all(query, [bookId, bookType]);
        console.log(`[COMMENTS FETCH DEBUG] Found ${comments.length} comments. Sample:`, comments[0]);

        if (comments.length > 0 && !comments[0].username) {
            console.warn(`[COMMENTS FETCH WARNING] First comment returned with no username. Check 'users' table 'username' field values or 'id' consistency.`);
            console.warn(`[COMMENTS FETCH WARNING] Problematic Comment Data:`, comments[0]);
        }

        res.json(comments);
    } catch (error) {
        console.error("[COMMENTS FETCH ERROR] Error getting comments:", error);
        res.status(500).json({ message: 'Server error while fetching comments.' });
    }
};

export const deleteComment = async (req, res) => {
    const { commentId, bookId, bookType } = req.params;
    const userId = req.userId;

    const tableName = getTableName(bookType);

    if (!tableName) {
        return res.status(400).json({ message: 'Invalid book type specified.' });
    }

    console.log(`[COMMENT DELETE DEBUG] User ${userId} attempting to delete comment ${commentId} for book ${bookId} (${bookType})`);

    let dbInstance;
    try {
        dbInstance = await getDb();
        await dbInstance.run('BEGIN');

        const commentQuery = 'SELECT user_id FROM comments WHERE id = ? AND book_id = ? AND book_type = ?';
        const comment = await dbInstance.get(commentQuery, [commentId, bookId, bookType]);

        if (!comment) {
            await dbInstance.run('ROLLBACK');
            return res.status(404).json({ message: 'Comment not found.' });
        }

        if (comment.user_id !== userId) {
            await dbInstance.run('ROLLBACK');
            return res.status(403).json({ message: 'You are not authorized to delete this comment.' });
        }

        const deleteQuery = 'DELETE FROM comments WHERE id = ?';
        const deleteResult = await dbInstance.run(deleteQuery, [commentId]);
        console.log(`[COMMENT DELETE DEBUG] Deleted from comments table. Changes: ${deleteResult.changes}`);

        if (deleteResult.changes === 0) {
            await dbInstance.run('ROLLBACK');
            return res.status(404).json({ message: 'Comment not found or already deleted.' });
        }

        const updateCountQuery = `UPDATE ${tableName} SET comment_count = MAX(0, comment_count - 1) WHERE id = ?`;
        const updateResult = await dbInstance.run(updateCountQuery, [bookId]);
        console.log(`[COMMENT DELETE DEBUG] Updated ${tableName} comment_count. Changes: ${updateResult.changes}`);

        await dbInstance.run('COMMIT');
        console.log(`[COMMENT DELETE DEBUG] Transaction committed for deleting comment ${commentId}.`);
        res.status(200).json({ message: 'Comment deleted successfully.' });

    } catch (error) {
        if (dbInstance) {
            await dbInstance.run('ROLLBACK');
        } else {
            const db = await getDb();
            await db.run('ROLLBACK');
        }
        console.error("[COMMENT DELETE ERROR] Error deleting comment:", error);
        res.status(500).json({ message: 'Server error while deleting comment.' });
    }
};

export const toggleBookPrivacy = async (req, res) => {
    const { bookId, bookType } = req.body;
    const userId = req.userId;
    const tableName = getTableName(bookType);

    if (!tableName) {
        return res.status(400).json({ message: 'Invalid book type specified.' });
    }

    let dbInstance;
    try {
        dbInstance = await getDb();
        const ownerQuery = `SELECT user_id, is_public FROM ${tableName} WHERE id = ?`;
        const book = await dbInstance.get(ownerQuery, [bookId]);

        if (!book) {
            return res.status(404).json({ message: 'Book not found.' });
        }

        if (book.user_id !== userId) {
            return res.status(403).json({ message: 'You are not authorized to change this book\'s privacy.' });
        }

        const toggleQuery = `UPDATE ${tableName} SET is_public = NOT is_public WHERE id = ?`;
        await dbInstance.run(toggleQuery, [bookId]);

        const newIsPublicStatus = !book.is_public;

        res.status(200).json({
            message: `Book status successfully set to ${newIsPublicStatus ? 'public' : 'private'}.`,
            is_public: newIsPublicStatus
        });
    } catch (error) {
        if (dbInstance) {
            await dbInstance.run('ROLLBACK');
        } else {
            const db = await getDb();
            await db.run('ROLLBACK');
        }
        console.error("Error toggling book privacy:", error);
        res.status(500).json({ message: 'Server error while toggling book privacy.' });
    }
};