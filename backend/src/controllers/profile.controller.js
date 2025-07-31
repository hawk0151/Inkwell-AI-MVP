// backend/src/controllers/profile.controller.js
import admin from 'firebase-admin';
import { getDb } from '../db/database.js'; // MODIFIED: Import getDb function

export const toggleFollow = async (req, res) => {
    const followerId = req.userId;
    const { userIdToToggle: followingId } = req.params;

    if (followerId === followingId) {
        return res.status(400).json({ message: "You cannot follow yourself." });
    }

    try {
        const db = await getDb(); // NEW: Get the db instance
        const checkQuery = 'SELECT * FROM follows WHERE follower_id = $1 AND following_id = $2'; // PostgreSQL parameters
        const existingFollow = await db.get(checkQuery, [followerId, followingId]);

        if (existingFollow) {
            const deleteQuery = 'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2'; // PostgreSQL parameters
            await db.run(deleteQuery, [followerId, followingId]);
            res.status(200).json({ message: 'User unfollowed successfully.', isFollowing: false });
        } else {
            const insertQuery = 'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)'; // PostgreSQL parameters
            await db.run(insertQuery, [followerId, followingId]);
            res.status(201).json({ message: 'User followed successfully.', isFollowing: true });
        }
    } catch (error) {
        console.error("Error toggling follow:", error);
        res.status(500).json({ message: 'Server error while toggling follow.' });
    }
};

export const getProfileByUsername = async (req, res) => {
    const { username } = req.params;
    const viewerId = req.userId;

    console.log(`[DEBUG] Searching for username in Firestore: "${username}"`);

    try {
        const db = await getDb(); // NEW: Get the db instance
        const usersRef = admin.firestore().collection('users');
        const snapshot = await usersRef.where('username', '==', username).limit(1).get();

        if (snapshot.empty) {
            console.log(`[DEBUG] User not found for username: "${username}"`);
            return res.status(404).json({ message: 'User not found' });
        }

        const userDoc = snapshot.docs[0];
        const profileDataFromFirestore = userDoc.data();
        const profileUserId = userDoc.id;

        const followersCountQuery = `SELECT COUNT(*) as count FROM follows WHERE following_id = $1`; // PostgreSQL parameters
        const followingCountQuery = `SELECT COUNT(*) as count FROM follows WHERE follower_id = $1`; // PostgreSQL parameters

        let isFollowing = false;
        if (viewerId && viewerId !== profileUserId) {
            const followStatusQuery = 'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2'; // PostgreSQL parameters
            const result = await db.get(followStatusQuery, [viewerId, profileUserId]);
            isFollowing = !!result;
        }

        const [followers, following] = await Promise.all([
            db.get(followersCountQuery, [profileUserId]),
            db.get(followingCountQuery, [profileUserId])
        ]);

        const booksQuery = `
            SELECT id, title, cover_image_url, like_count, comment_count, 'picture_book' as book_type, user_id FROM picture_books WHERE user_id = $1 AND is_public = TRUE
            UNION ALL
            SELECT id, title, cover_image_url, like_count, comment_count, 'text_book' as book_type, user_id FROM text_books WHERE user_id = $2 AND is_public = TRUE
        `; // PostgreSQL parameters and BOOLEAN
        let books = await db.all(booksQuery, [profileUserId, profileUserId]);

        books = books.map(book => ({
            ...book,
            author_username: profileDataFromFirestore.username,
            author_avatar_url: profileDataFromFirestore.avatar_url,
        }));

        if (viewerId) {
            const bookIds = books.map(book => book.id);
            // This part for likes needs to be careful with IN clause parameterization in PG
            // A common way for IN ( (?), (?) ) is to use a dynamic number of $ parameters
            const bookTypePlaceholders = books.map((_, i) => `($${2*i+1}, $${2*i+2})`).join(','); // Example: ($1, $2), ($3, $4)
            const likeCheckParams = [];
            books.forEach(book => {
                likeCheckParams.push(book.id, book.book_type);
            });

            const likeQuery = `SELECT book_id, book_type FROM likes WHERE user_id = $1 AND (book_id, book_type) IN (${bookTypePlaceholders})`;
            const userLikes = await db.all(likeQuery, [viewerId, ...likeCheckParams]); // Combine parameters correctly

            const likedSet = new Set(userLikes.map(like => `${like.book_type}:${like.book_id}`));
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
    }
};

export const updateMyProfile = async (req, res) => {
    const userId = req.userId;
    const { username, bio, avatar_url } = req.body;

    try {
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
    }
};