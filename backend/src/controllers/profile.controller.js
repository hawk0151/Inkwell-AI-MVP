// backend/src/controllers/profile.controller.js
import admin from 'firebase-admin';
import { getDb } from '../db/database.js';

export const toggleFollow = async (req, res) => {
    const followerId = req.userId;
    const { userIdToToggle: followingId } = req.params;

    if (followerId === followingId) {
        return res.status(400).json({ message: "You cannot follow yourself." });
    }

    let client; // Declare client for transaction management
    try {
        const pool = await getDb(); // Get the pool directly
        client = await pool.connect(); // Get a client from the pool
        await client.query('BEGIN'); // Start transaction

        const checkQuery = 'SELECT * FROM follows WHERE follower_id = $1 AND following_id = $2';
        const existingFollow = (await client.query(checkQuery, [followerId, followingId])).rows[0]; // Use client.query

        if (existingFollow) {
            const deleteQuery = 'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2';
            await client.query(deleteQuery, [followerId, followingId]); // Use client.query
            res.status(200).json({ message: 'User unfollowed successfully.', isFollowing: false });
        } else {
            const insertQuery = 'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)';
            await client.query(insertQuery, [followerId, followingId]); // Use client.query
            res.status(201).json({ message: 'User followed successfully.', isFollowing: true });
        }
        await client.query('COMMIT'); // Commit transaction

    } catch (error) {
        if (client) await client.query('ROLLBACK'); // Rollback on error
        console.error("Error toggling follow:", error);
        res.status(500).json({ message: 'Server error while toggling follow.' });
    } finally {
        if (client) client.release(); // Release client back to pool
    }
};

export const getProfileByUsername = async (req, res) => {
    const { username } = req.params;
    const viewerId = req.userId;

    console.log(`[DEBUG] Searching for username in Firestore: "${username}"`);

    let client; // Declare client for transaction management
    try {
        const pool = await getDb(); // Get the pool directly
        client = await pool.connect(); // Get a client from the pool

        const usersRef = admin.firestore().collection('users');
        const snapshot = await usersRef.where('username', '==', username).limit(1).get();

        if (snapshot.empty) {
            console.log(`[DEBUG] User not found for username: "${username}"`);
            return res.status(404).json({ message: 'User not found' });
        }

        const userDoc = snapshot.docs[0];
        const profileDataFromFirestore = userDoc.data();
        const profileUserId = userDoc.id;

        const followersCountQuery = `SELECT COUNT(*) as count FROM follows WHERE following_id = $1`;
        const followingCountQuery = `SELECT COUNT(*) as count FROM follows WHERE follower_id = $1`;

        let isFollowing = false;
        if (viewerId && viewerId !== profileUserId) {
            const followStatusQuery = 'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2';
            const result = (await client.query(followStatusQuery, [viewerId, profileUserId])).rows[0]; // Use client.query
            isFollowing = !!result;
        }

        const [followersResult, followingResult] = await Promise.all([
            client.query(followersCountQuery, [profileUserId]), // Use client.query
            client.query(followingCountQuery, [profileUserId])  // Use client.query
        ]);
        const followers = followersResult.rows[0];
        const following = followingResult.rows[0];

        // MODIFIED: TEMPORARILY SIMPLIFIED & SINGLE-LINE booksQuery for debugging
        const booksQuery = `SELECT id, title, cover_image_url, like_count, comment_count, 'picture_book' as book_type, user_id FROM picture_books WHERE user_id = $1 AND is_public = TRUE`;
        
        console.log("[DEBUG] Executing booksQuery:", booksQuery, "with params:", [profileUserId]); 

        let books = (await client.query(booksQuery, [profileUserId])).rows; // Use client.query and get .rows

        books = books.map(book => ({
            ...book,
            author_username: profileDataFromFirestore.username,
            author_avatar_url: profileDataFromFirestore.avatar_url,
        }));

        if (viewerId) {
            // Re-evaluating this dynamic IN clause to be safer for PostgreSQL
            // It's generally safer to build the IN clause with specific parameters
            // or pass as an array and let PG expand, but db.all adapter might not handle array expansion.
            // For now, let's keep the parameter construction for the IN clause consistent,
            // but the primary error was likely the boolean comparison.
            const bookTypePlaceholders = books.map((_, i) => `($${i * 2 + 2}, $${i * 2 + 3})`).join(',');
            const likeCheckParams = [];
            books.forEach(book => {
                likeCheckParams.push(book.id, book.book_type);
            });

            const likesSql = `SELECT book_id, book_type FROM likes WHERE user_id = $1 AND (book_id, book_type) IN (${bookTypePlaceholders})`;
            const likedResults = (await client.query(likesSql, [viewerId, ...likeCheckParams])).rows; // Use client.query

            const likedSet = new Set(likedResults.map(like => `${like.book_type}:${like.book_id}`));
            books = books.map(book => ({
                ...book,
                isLiked: likedSet.has(`${book.book_type}:${book.id}`)
            }));
        }

        res.json({
            profile: {
                ...profileDataFromFirestore,
                uid: profileUserId,
                followers_count: followers?.count || 0,
                following_count: following?.count || 0,
                isFollowing: isFollowing,
            },
            books: books
        });

    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).json({ message: "Server error while fetching profile." });
    } finally {
        if (client) client.release(); // Release client back to pool
    }
};

export const updateMyProfile = async (req, res) => {
    const userId = req.userId;
    const { username, bio, avatar_url } = req.body;

    let client; // Declare client for transaction management
    try {
        const pool = await getDb(); // Get the pool directly
        client = await pool.connect(); // Get a client from the pool

        const firestore = admin.firestore();
        const userDocRef = firestore.collection('users').doc(userId);

        if (username) {
            const usersRef = firestore.collection('users');
            const snapshot = await usersRef.where('username', '==', username).limit(1).get();

            if (!snapshot.empty && snapshot.docs[0].id !== userId) {
                return res.status(409).json({ message: 'Username is already taken.' });
            }
        }

        const updateData = {};
        if (username) updateData.username = username;
        if (bio !== undefined) updateData.bio = bio;
        if (avatar_url) updateData.avatar_url = avatar_url;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: 'No fields to update were provided.' });
        }

        await userDocRef.update(updateData);

        res.status(200).json({ message: 'Profile updated successfully.' });

    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ message: "Server error while updating profile." });
    } finally {
        if (client) client.release(); // Release client back to pool
    }
};