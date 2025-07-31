// backend/src/api/product.routes.js
import express from 'express';
import { getBookOptions } from '../controllers/product.controller.js';

const router = express.Router();

// Route for fetching the available book formats and their prices
// GET /api/products/book-options
router.get('/book-options', getBookOptions);

export default router;
