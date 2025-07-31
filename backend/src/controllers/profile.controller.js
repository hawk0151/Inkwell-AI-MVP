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
        const pool = await getDb();
        client = await pool.connect();
        await client.query('BEGIN');

        const checkQuery = 'SELECT * FROM follows WHERE follower_id = $1 AND following_id = $2';
        const existingFollow = (await client.query(checkQuery, [followerId, followingId])).rows[0];

        if (existingFollow) {
            const deleteQuery = 'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2';
            await client.query(deleteQuery, [followerId, followingId]);
            res.status(200).json({ message: 'User unfollowed successfully.', isFollowing: false });
        } else {
            const insertQuery = 'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)';
            await client.query(insertQuery, [followerId, followingId]);
            res.status(201).json({ message: 'User followed successfully.', isFollowing: true });
        }
        await client.query('COMMIT');

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error("Error toggling follow:", error);
        res.status(500).json({ message: 'Server error while toggling follow.' });
    } finally {
        if (client) client.release();
    }
};

export const getProfileByUsername = async (req, res) => {
    const { username } = req.params;
    const viewerId = req.userId; // This is the person viewing the profile

    console.log(`[DEBUG] Searching for username in Firestore: "${username}"`);

    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();

        const usersRef = admin.firestore().collection('users');
        const snapshot = await usersRef.where('username', '==', username).limit(1).get();

        if (snapshot.empty) {
            console.log(`[DEBUG] User not found for username: "${username}"`);
            return res.status(404).json({ message: 'User not found' });
        }

        const userDoc = snapshot.docs[0];
        const profileDataFromFirestore = userDoc.data();
        const profileUserId = userDoc.id; // This is the ID of the profile being viewed

        // --- Fetch follower/following counts and status ---
        const followersCountQuery = `SELECT COUNT(*) as count FROM follows WHERE following_id = $1`;
        const followingCountQuery = `SELECT COUNT(*) as count FROM follows WHERE follower_id = $1`;

        let isFollowing = false;
        // Check follow status only if a viewer is logged in and is not viewing their own profile
        if (viewerId && viewerId !== profileUserId) {
            const followStatusQuery = 'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2';
            const result = await client.query(followStatusQuery, [viewerId, profileUserId]);
            isFollowing = result.rowCount > 0;
        }

        const [followersResult, followingResult] = await Promise.all([
            client.query(followersCountQuery, [profileUserId]),
            client.query(followingCountQuery, [profileUserId])
        ]);
        const followers = followersResult.rows[0];
        const following = followingResult.rows[0];

        // --- FIXED: Query BOTH book types, like in the feed controller ---
        const booksQuery =
            "SELECT id, title, cover_image_url, like_count, comment_count, date_created, 'picture_book' as book_type, user_id " +
            "FROM picture_books " +
            "WHERE user_id = $1 AND is_public = TRUE " +
            "UNION ALL " +
            "SELECT id, title, cover_image_url, like_count, comment_count, date_created, 'text_book' as book_type, user_id " +
            "FROM text_books " +
            "WHERE user_id = $1 AND is_public = TRUE " +
            "ORDER BY date_created DESC";

        console.log("[DEBUG] Executing booksQuery for user:", profileUserId);
        // Note: The same parameter $1 can be used for both parts of the UNION query.
        let books = (await client.query(booksQuery, [profileUserId])).rows;

        // Add author info to each book
        books = books.map(book => ({
            ...book,
            author_username: profileDataFromFirestore.username,
            author_avatar_url: profileDataFromFirestore.avatar_url,
        }));

        // --- FIXED: The Guard Clause ---
        // Only check for likes if a user is logged in AND if there are any books to check.
        if (viewerId && books.length > 0) {
            const bookTypePlaceholders = books.map((_, i) => `($${i * 2 + 2}, $${i * 2 + 3})`).join(',');
            const likeCheckParams = [viewerId]; // $1 is the viewerId
            books.forEach(book => {
                likeCheckParams.push(book.id, book.book_type);
            });
            
            const likeQuery = `SELECT book_id, book_type FROM likes WHERE user_id = $1 AND (book_id, book_type) IN (${bookTypePlaceholders})`;
            
            console.log("[DEBUG] Executing likeQuery for viewer:", viewerId);
            const userLikesResult = await client.query(likeQuery, likeCheckParams);
            const userLikes = userLikesResult.rows;

            const likedSet = new Set(userLikes.map(like => `${like.book_type}:${like.id}`));
            books = books.map(book => ({
                ...book,
                isLiked: likedSet.has(`${book.book_type}:${book.id}`)
            }));
        } else {
            // If not logged in or no books, ensure isLiked is false
             books = books.map(book => ({ ...book, isLiked: false }));
        }

        res.json({
            profile: {
                ...profileDataFromFirestore,
                uid: profileUserId,
                followers_count: parseInt(followers?.count || 0, 10),
                following_count: parseInt(following?.count || 0, 10),
                isFollowing: isFollowing,
            },
            books: books
        });

    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).json({ message: "Server error while fetching profile." });
    } finally {
        if (client) client.release();
    }
};


export const updateMyProfile = async (req, res) => {
    const userId = req.userId;
    const { username, bio, avatar_url } = req.body;

    // No need for a pg client here as we are only interacting with Firestore
    try {
        const firestore = admin.firestore();
        const userDocRef = firestore.collection('users').doc(userId);

        if (username) {
            const currentDoc = await userDocRef.get();
            const currentUsername = currentDoc.data()?.username;
            
            // Only check for uniqueness if the username is actually changing
            if (username !== currentUsername) {
                const usersRef = firestore.collection('users');
                const snapshot = await usersRef.where('username', '==', username).limit(1).get();
    
                if (!snapshot.empty) {
                     return res.status(409).json({ message: 'Username is already taken.' });
                }
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
    }
};