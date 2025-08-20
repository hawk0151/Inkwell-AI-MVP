import IORedis from 'ioredis';

console.log('DEBUG REDIS_URL:', JSON.stringify(process.env.REDIS_URL));
const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
    console.error('❌ CRITICAL: REDIS_URL environment variable is not set!');
    process.exit(1);
}

// MODIFIED: The tls object has been removed.
// ioredis will automatically enable and configure TLS when the redisUrl starts with "rediss://".
const redisOptions = {
    maxRetriesPerRequest: null,
};

// This is our single, centralized Redis connection instance.
export const redisConnection = new IORedis(redisUrl, redisOptions);

redisConnection.on('connect', () => {
    console.log('✅ Connected to Redis successfully.');
});

redisConnection.on('error', (err) => {
    // We can ignore timeout errors during initial connection attempts with local Redis
    if (err.code === 'ETIMEDT' && redisUrl.includes('localhost')) {
        return;
    }
    console.error('❌ Redis connection error:', err);
});