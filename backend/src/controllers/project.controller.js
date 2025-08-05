// backend/src/controllers/project.controller.js
import { getDb } from '../db/database.js';

export const getAllProjects = async (req, res) => {
    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();
        const userId = req.userId;

        const sql = `
            SELECT id, title, last_modified, is_public, cover_image_url, lulu_product_id, 'pictureBook' as type
            FROM picture_books
            WHERE user_id = $1
            UNION ALL
            SELECT id, title, last_modified, is_public, cover_url as cover_image_url, lulu_product_id, 'textBook' as type
            FROM text_books
            WHERE user_id = $1
            ORDER BY last_modified DESC;
        `;
        
        const result = await client.query(sql, [userId]);
        
        res.status(200).json(result.rows);

    } catch (err) {
        console.error("Error fetching all projects:", err.message);
        res.status(500).json({ message: 'Failed to fetch projects.' });
    } finally {
        if (client) client.release();
    }
};