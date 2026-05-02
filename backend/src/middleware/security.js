// src/middleware/security.js — Advanced Security Middleware

const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// ─── Correlation ID ───────────────────────────────────────────────────────────
// Attaches a unique ID to every request for end-to-end tracing in logs.
const correlationId = (req, res, next) => {
  const id = req.headers['x-correlation-id'] || uuidv4();
  req.correlationId = id;
  res.setHeader('X-Correlation-ID', id);
  next();
};

// ─── Per-user AI rate limiter (in-memory sliding window) ─────────────────────
// Global rate limiter handles IP; this adds per-authenticated-user limits
// so one user can't hammer expensive AI endpoints even behind a shared IP.
const userAiWindows = new Map();

const perUserAiLimiter = (maxPerMinute = 10) => (req, res, next) => {
  const userId = req.userId;
  if (!userId) return next(); // Not authenticated — global limiter handles it

  const now      = Date.now();
  const window   = 60_000; // 1 minute
  const key      = userId;

  if (!userAiWindows.has(key)) userAiWindows.set(key, []);
  const timestamps = userAiWindows.get(key).filter(t => now - t < window);
  timestamps.push(now);
  userAiWindows.set(key, timestamps);

  if (timestamps.length > maxPerMinute) {
    logger.warn('[RateLimit] User exceeded AI limit', { userId, count: timestamps.length });
    return res.status(429).json({
      success: false,
      message: `AI rate limit: max ${maxPerMinute} requests/minute per user. Please wait.`,
      retryAfter: Math.ceil((timestamps[0] + window - now) / 1000),
    });
  }

  next();
};

// Purge old windows every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of userAiWindows.entries()) {
    const fresh = ts.filter(t => now - t < 60_000);
    if (fresh.length === 0) userAiWindows.delete(key);
    else userAiWindows.set(key, fresh);
  }
}, 2 * 60_000);

// ─── Content Security Policy headers (strict) ────────────────────────────────
const strictSecurity = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
};

// ─── Request size guard for AI payloads ──────────────────────────────────────
const aiPayloadGuard = (req, res, next) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > 50_000) { // 50KB max for AI prompts
    return res.status(413).json({
      success: false,
      message: 'Request payload too large for AI processing (max 50KB)',
    });
  }
  next();
};

// ─── Audit logger for sensitive endpoints ────────────────────────────────────
const auditLog = (action) => (req, res, next) => {
  const original = res.json.bind(res);
  res.json = (body) => {
    logger.info('[AUDIT]', {
      action,
      userId:        req.userId || 'anonymous',
      correlationId: req.correlationId,
      path:          req.path,
      method:        req.method,
      statusCode:    res.statusCode,
      success:       body?.success,
      ip:            req.ip,
      userAgent:     req.get('user-agent'),
      timestamp:     new Date().toISOString(),
    });
    return original(body);
  };
  next();
};

module.exports = { correlationId, perUserAiLimiter, strictSecurity, aiPayloadGuard, auditLog };
