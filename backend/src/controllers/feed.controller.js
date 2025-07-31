// backend/src/controllers/feed.controller.js
import { getDb } from '../db/database.js';
import admin from 'firebase-admin';

export const getForYouFeed = async (req, res) => {
    const userId = req.userId;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    console.log(`[FEED DEBUG 1] Fetching feed for user: ${userId}, page: ${page}, limit: ${limit}`);

    try {
        const db = await getDb();

        const allPublicBooksQuery = `
            SELECT
                id,
                user_id,
                title,
                cover_image_url,
                like_count,
                comment_count,
                date_created,
                'picture_book' AS book_type
            FROM picture_books
            WHERE is_public = 1 -- MODIFIED: is_public = TRUE changed to is_public = 1

            UNION ALL

            SELECT
                id,
                user_id,
                title,
                cover_image_url,
                like_count,
                comment_count,
                date_created,
                'text_book' AS book_type
            FROM text_books
            WHERE is_public = 1 -- MODIFIED: is_public = TRUE changed to is_public = 1
            ORDER BY date_created DESC
            LIMIT $1 OFFSET $2
        `;

        let feedBooks = await db.all(allPublicBooksQuery, [limit, offset]);
        console.log(`[FEED DEBUG 2] Found ${feedBooks.length} public books from both tables.`);

        // Map Firebase UIDs to usernames and avatar URLs
        const uniqueUserIds = [...new Set(feedBooks.map(book => book.user_id))];
        const userProfiles = new Map();

        if (uniqueUserIds.length > 0) {
            const firestore = admin.firestore();
            const usersRef = firestore.collection('users');
            const userDocs = await Promise.all(uniqueUserIds.map(uid => usersRef.doc(uid).get()));

            userDocs.forEach(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    userProfiles.set(doc.id, {
                        username: data.username,
                        avatar_url: data.avatar_url
                    });
                }
            });
            console.log(`[FEED DEBUG] Fetched ${userProfiles.size} author profiles from Firestore.`);
        }

        feedBooks = feedBooks.map(book => {
            const profile = userProfiles.get(book.user_id) || {};
            return {
                ...book,
                author_username: profile.username || `Unknown User`,
                author_avatar_url: profile.avatar_url || 'https://via.placeholder.com/40',
            };
        });

        if (userId && feedBooks.length > 0) {
            // Re-evaluating this dynamic IN clause to be safer for PostgreSQL
            // It's generally safer to build the IN clause with specific parameters
            const bookTypePlaceholders = feedBooks.map((_, i) => `($${i * 2 + 2}, $${i * 2 + 3})`).join(','); // Generates ($2,$3), ($4,$5) etc.
            const likeCheckParams = [userId];
            feedBooks.forEach(book => {
                likeCheckParams.push(book.id, book.book_type);
            });

            const likesSql = `SELECT book_id, book_type FROM likes WHERE user_id = $1 AND (book_id, book_type) IN (${bookTypePlaceholders})`;
            const likedResults = await db.all(likesSql, likeCheckParams);

            const likedSet = new Set(likedResults.map(like => `${like.book_type}:${like.book_id}`));

            feedBooks = feedBooks.map(book => ({
                ...book,
                isLiked: likedSet.has(`${book.book_type}:${book.id}`)
            }));
            console.log(`[FEED DEBUG] Checked like status for ${likedResults.length} books.`);
        } else if (!userId) {
            feedBooks = feedBooks.map(book => ({ ...book, isLiked: false }));
            console.log(`[FEED DEBUG] User not logged in, setting all books as not liked.`);
        }

        res.status(200).json(feedBooks);

    } catch (error) {
        console.error('[FEED ERROR] Failed to generate feed:', error);
        res.status(500).json({ message: 'Could not generate feed.' });
    }
};