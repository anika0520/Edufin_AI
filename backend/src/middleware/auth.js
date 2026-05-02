// src/middleware/auth.js — Hardened JWT Auth Middleware
const jwt  = require('jsonwebtoken');
const { UnauthorizedError } = require('../utils/response');
const { query } = require('../database/connection');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError('No token provided');

    const token   = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'access') throw new UnauthorizedError('Invalid token type');

    // Check jti-based blacklist (covers logout and token rotation)
    const blacklistKey = decoded.jti ? `blacklist:${decoded.jti}` : `blacklist:${token.substring(0, 20)}`;
    const blacklisted  = await cache.get(blacklistKey);
    if (blacklisted) throw new UnauthorizedError('Token has been revoked');

    // Load user from cache or DB (15-min TTL matches access token)
    let user = await cache.get(`user:${decoded.userId}`);
    if (!user) {
      const result = await query(
        'SELECT id, email, first_name, last_name, is_active, profile_stage FROM users WHERE id=$1',
        [decoded.userId]
      );
      if (!result.rows.length) throw new UnauthorizedError('User not found');
      user = result.rows[0];
      await cache.set(`user:${decoded.userId}`, user, 900);
    }

    if (!user.is_active) throw new UnauthorizedError('Account deactivated');

    req.user   = user;
    req.userId = user.id;
    req.tokenDecoded = decoded;
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) return res.status(401).json({ success: false, message: err.message });
    if (err.name === 'JsonWebTokenError')  return res.status(401).json({ success: false, message: 'Invalid token' });
    if (err.name === 'TokenExpiredError')  return res.status(401).json({ success: false, message: 'Token expired — please refresh' });
    next(err);
  }
};

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();
  try { await authenticate(req, res, next); } catch { next(); }
};

module.exports = { authenticate, optionalAuth };
