// backend/src/middleware/coop.middleware.js

export const setCoopHeader = (req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
};