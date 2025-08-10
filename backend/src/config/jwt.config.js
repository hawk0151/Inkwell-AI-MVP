// backend/src/config/jwt.config.js
export const JWT_QUOTE_SECRET = process.env.JWT_QUOTE_SECRET;

if (!JWT_QUOTE_SECRET) {
    console.error("❌ CRITICAL: JWT_QUOTE_SECRET environment variable is not set!");
    throw new Error("JWT_QUOTE_SECRET must be set in your .env file.");
}