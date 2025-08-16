import IORedis from 'ioredis';

console.log('DEBUG REDIS_URL:', JSON.stringify(process.env.REDIS_URL));
const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
    console.error('❌ CRITICAL: REDIS_URL environment variable is not set!');
    process.exit(1);
}

// Explicitly set TLS options for secure connections.
// The `tls` object is now always present, telling the client to use TLS.
const redisOptions = {
    maxRetriesPerRequest: null,
    tls: {
        rejectUnauthorized: false
    }
};

// This is our single, centralized Redis connection instance.
export const redisConnection = new IORedis(redisUrl, redisOptions);

redisConnection.on('connect', () => {
    console.log('✅ Connected to Redis successfully.');
});

redisConnection.on('error', (err) => {
    // We can ignore timeout errors during initial connection attempts with local Redis
    if (err.code === 'ETIMEDOUT' && redisUrl.includes('localhost')) {
        return;
    }
    console.error('❌ Redis connection error:', err);
});