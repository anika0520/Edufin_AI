// src/config/redis.js — Redis with in-memory fallback
const logger = require('../utils/logger');

// ─── In-memory fallback cache ─────────────────────────────────────────────────
const memStore = new Map();
const memTTL = new Map();

const memCache = {
  async get(key) {
    const exp = memTTL.get(key);
    if (exp && Date.now() > exp) { memStore.delete(key); memTTL.delete(key); return null; }
    const val = memStore.get(key);
    return val !== undefined ? val : null;
  },
  async set(key, value, ttlSeconds = 3600) {
    memStore.set(key, value);
    memTTL.set(key, Date.now() + ttlSeconds * 1000);
    return true;
  },
  async del(key) { memStore.delete(key); memTTL.delete(key); return true; },
  async delPattern(pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of memStore.keys()) {
      if (regex.test(key)) { memStore.delete(key); memTTL.delete(key); }
    }
    return true;
  },
};

// Purge expired in-memory entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, exp] of memTTL.entries()) {
    if (now > exp) { memStore.delete(key); memTTL.delete(key); }
  }
}, 5 * 60 * 1000);

// ─── Redis client (optional) ──────────────────────────────────────────────────
let client = null;
let redisAvailable = false;

const getClient = async () => {
  if (client && client.isOpen) return client;
  if (redisAvailable === false && client === null) {
    // Already tried and failed — don't retry on every call
    return null;
  }

  try {
    const { createClient } = require('redis');
    client = createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        reconnectStrategy: (retries) => {
          if (retries > 3) { redisAvailable = false; return new Error('Redis unavailable'); }
          return Math.min(retries * 200, 1000);
        },
        connectTimeout: 3000,
      },
      password: process.env.REDIS_PASSWORD || undefined,
    });

    client.on('error', (err) => {
      logger.debug('Redis error:', err.message);
      redisAvailable = false;
    });
    client.on('connect', () => { logger.info('Redis connected'); redisAvailable = true; });

    await client.connect();
    redisAvailable = true;
  } catch (err) {
    logger.warn('Redis unavailable — using in-memory cache fallback:', err.message);
    client = null;
    redisAvailable = false;
  }

  return client && client.isOpen ? client : null;
};

// ─── Unified cache API ────────────────────────────────────────────────────────
const cache = {
  async get(key) {
    try {
      const c = await getClient();
      if (!c) return memCache.get(key);
      const val = await c.get(key);
      return val ? JSON.parse(val) : null;
    } catch { return memCache.get(key); }
  },

  async set(key, value, ttlSeconds = null) {
    try {
      const ttl = ttlSeconds || parseInt(process.env.REDIS_TTL_DEFAULT) || 3600;
      const c = await getClient();
      if (!c) return memCache.set(key, value, ttl);
      await c.set(key, JSON.stringify(value), { EX: ttl });
      return true;
    } catch { return memCache.set(key, value, ttlSeconds || 3600); }
  },

  async del(key) {
    try {
      const c = await getClient();
      if (!c) return memCache.del(key);
      await c.del(key);
      return true;
    } catch { return memCache.del(key); }
  },

  async delPattern(pattern) {
    try {
      const c = await getClient();
      if (!c) return memCache.delPattern(pattern);
      const keys = await c.keys(pattern);
      if (keys.length > 0) await c.del(keys);
      return true;
    } catch { return memCache.delPattern(pattern); }
  },
};

module.exports = { getClient, cache };
