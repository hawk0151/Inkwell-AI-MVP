// backend/controllers/follow.controller.js

import db from '../db/database.js'; // Adjust the path to your SQLite db instance

/**
 * @description Toggles the follow status between the logged-in user and another user.
 * @route POST /api/users/:profileUserId/follow
 * @access Private
 */
export const toggleFollow = async (req, res) => {
    // The user ID of the person initiating the follow/unfollow (from our 'protect' middleware)
    const followerId = req.user.uid; 
    
    // The user ID of the person being followed/unfollowed (from the URL parameter)
    const followedId = req.params.profileUserId;

    // A user cannot follow themselves
    if (followerId === followedId) {
        return res.status(400).json({ message: "You cannot follow yourself." });
    }

    try {
        // Check if the follow relationship already exists
        const sqlCheck = `SELECT * FROM follows WHERE follower_id = ? AND followed_id = ?`;
        db.get(sqlCheck, [followerId, followedId], (err, row) => {
            if (err) {
                console.error("Database error checking follow status:", err.message);
                return res.status(500).json({ message: "Database error." });
            }

            if (row) {
                // If it exists, UNFOLLOW: Delete the record
                const sqlDelete = `DELETE FROM follows WHERE follower_id = ? AND followed_id = ?`;
                db.run(sqlDelete, [followerId, followedId], function(err) {
                    if (err) {
                        console.error("Database error unfollowing user:", err.message);
                        return res.status(500).json({ message: "Database error." });
                    }
                    res.status(200).json({ message: "Successfully unfollowed.", followStatus: false });
                });
            } else {
                // If it doesn't exist, FOLLOW: Insert a new record
                const sqlInsert = `INSERT INTO follows (follower_id, followed_id) VALUES (?, ?)`;
                db.run(sqlInsert, [followerId, followedId], function(err) {
                    if (err) {
                        console.error("Database error following user:", err.message);
                        return res.status(500).json({ message: "Database error." });
                    }
                    res.status(200).json({ message: "Successfully followed.", followStatus: true });
                });
            }
        });
    } catch (error) {
        console.error("Error in toggleFollow controller:", error);
        res.status(500).json({ message: "Server error." });
    }
};