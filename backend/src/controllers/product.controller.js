// backend/src/controllers/product.controller.js
import { getPrintOptions } from '../services/lulu.service.js';

export const getBookOptions = async (req, res) => {
  try {
    const options = await getPrintOptions();
    res.status(200).json(options);
  } catch (error) {
    console.error('Error fetching print options:', error);
    res.status(500).json({ message: 'Failed to fetch book options.' });
  }
};
