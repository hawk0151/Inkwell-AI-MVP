// src/controllers/feed.controller.js

import { getDb } from '../db/database.js';
import admin from 'firebase-admin';

// --- Define your placeholder images here
const placeholderCovers = [
    '/assets/p1.png',
    '/assets/p2.png',
    '/assets/p3.png',
    '/assets/p4.png'
];

export const getForYouFeed = async (req, res) => {
    const userId = req.userId;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    console.log(`[FEED DEBUG 1] Fetching feed for user: ${userId}, page: ${page}, limit: ${limit}`);

    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();

        const allPublicBooksQuery = `
            SELECT 
                id, 
                user_id, 
                title, 
                user_cover_image_url AS cover_image_url,
                like_count, 
                comment_count, 
                date_created,
                'picture_book' AS book_type
            FROM picture_books
            WHERE is_public = TRUE
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
            WHERE is_public = TRUE
            ORDER BY date_created DESC
            LIMIT $1 OFFSET $2
        `;

        console.log("[DEBUG] Executing allPublicBooksQuery with params:", [limit, offset]); 

        let feedBooks = (await client.query(allPublicBooksQuery, [limit, offset])).rows;
        console.log(`[FEED DEBUG 2] Found ${feedBooks.length} public books from both tables.`);

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
            
            let coverUrl;

            if (book.cover_image_url) {
                coverUrl = book.cover_image_url;
            } else {
                const seed = book.id.charCodeAt(0) + book.id.charCodeAt(1); 
                const randomIndex = seed % placeholderCovers.length;
                coverUrl = placeholderCovers[randomIndex];
            }

            return {
                ...book,
                cover_image_url: coverUrl,
                author_username: profile.username || `Unknown User`,
                author_avatar_url: profile.avatar_url || 'https://via.placeholder.com/40',
            };
        });

        res.status(200).json(feedBooks);

    } catch (error) {
        console.error('[FEED ERROR] Failed to generate feed:', error);
        res.status(500).json({ message: 'Could not generate feed.' });
    } finally {
        if (client) client.release();
    }
};