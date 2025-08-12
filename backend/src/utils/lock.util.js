import { getRedisClient } from '../config/redisClient.js';

// --- MODIFICATION: Use the single, shared Redis client for the entire application ---
const redisClient = getRedisClient();

// Lock expires after 5 minutes to prevent permanent deadlocks if a worker crashes hard
const LOCK_EXPIRATION_SECONDS = 300; 

/**
 * Attempts to acquire a lock for a specific book ID.
 * @param {string} bookId The ID of the book to lock.
 * @returns {Promise<boolean>} True if the lock was acquired, false otherwise.
 */
export const lockBook = async (bookId) => {
    const lockKey = `lock:book:${bookId}`;
    console.log(`[Lock Service] Attempting to acquire lock for ${lockKey}`);
    const result = await redisClient.set(lockKey, 'locked', 'NX', 'EX', LOCK_EXPIRATION_SECONDS);
    const success = result === 'OK';
    if (success) {
        console.log(`[Lock Service] Lock acquired for ${lockKey}`);
    } else {
        console.log(`[Lock Service] Lock for ${lockKey} is already held.`);
    }
    return success;
};

/**
 * Releases the lock for a specific book ID.
 * @param {string} bookId The ID of the book to unlock.
 */
export const unlockBook = async (bookId) => {
    const lockKey = `lock:book:${bookId}`;
    console.log(`[Lock Service] Releasing lock for ${lockKey}`);
    await redisClient.del(lockKey);
};