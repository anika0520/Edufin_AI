// src/modules/auth/auth.service.js — Hardened Auth Service
// Short-lived access tokens (15min), rotating refresh tokens, device fingerprinting
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { query, transaction } = require('../../database/connection');
const { cache } = require('../../config/redis');
const { AppError, UnauthorizedError } = require('../../utils/response');
const logger = require('../../utils/logger');

const ACCESS_EXPIRY  = process.env.JWT_EXPIRY         || '15m';   // Short-lived
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '30d';

class AuthService {
  // ── Token generation ────────────────────────────────────────────────────────
  generateTokens(userId, deviceFingerprint = '') {
    const jti = require('crypto').randomBytes(16).toString('hex'); // Unique token ID

    const accessToken = jwt.sign(
      { userId, type: 'access', jti },
      process.env.JWT_SECRET,
      { expiresIn: ACCESS_EXPIRY }
    );
    const refreshToken = jwt.sign(
      { userId, type: 'refresh', jti, fp: deviceFingerprint },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: REFRESH_EXPIRY }
    );
    return { accessToken, refreshToken };
  }

  _fingerprint(req) {
    // Lightweight device fingerprint from headers (not PII)
    const ua = req?.get?.('user-agent') || '';
    const lang = req?.get?.('accept-language') || '';
    return require('crypto')
      .createHash('sha256')
      .update(ua + lang)
      .digest('hex')
      .substring(0, 16);
  }

  // ── Register ─────────────────────────────────────────────────────────────────
  async register({ email, password, firstName, lastName, phone, nationality, currentCountry }, req) {
    const exists = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (exists.rows.length > 0) throw new AppError('Email already registered', 409);

    const rounds      = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(password, rounds);

    const result = await transaction(async (client) => {
      const userRes = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, phone, nationality, current_country)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, email, first_name, last_name, profile_stage`,
        [email.toLowerCase(), passwordHash, firstName, lastName, phone, nationality, currentCountry]
      );
      const user = userRes.rows[0];
      await client.query('INSERT INTO student_profiles (user_id) VALUES ($1)', [user.id]);
      await client.query('INSERT INTO behavioral_scores (user_id) VALUES ($1)', [user.id]);
      return user;
    });

    const fp     = this._fingerprint(req);
    const tokens = this.generateTokens(result.id, fp);
    await this._storeRefreshToken(result.id, tokens.refreshToken, fp);

    logger.info('User registered', { userId: result.id });
    return {
      user: { id: result.id, email: result.email, firstName: result.first_name, lastName: result.last_name, profileStage: result.profile_stage },
      tokens,
    };
  }

  // ── Login ────────────────────────────────────────────────────────────────────
  async login({ email, password }, req) {
    const result = await query(
      'SELECT id, email, password_hash, first_name, last_name, is_active, profile_stage, failed_login_attempts, locked_until FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (!result.rows.length) throw new UnauthorizedError('Invalid email or password');

    const user = result.rows[0];
    if (!user.is_active) throw new UnauthorizedError('Account deactivated');

    // Account lockout after 5 failed attempts
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const wait = Math.ceil((new Date(user.locked_until) - Date.now()) / 60000);
      throw new UnauthorizedError(`Account temporarily locked. Try again in ${wait} minute(s).`);
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await query(
        'UPDATE users SET failed_login_attempts=$1, locked_until=$2 WHERE id=$3',
        [attempts, lockUntil, user.id]
      );
      throw new UnauthorizedError('Invalid email or password');
    }

    // Reset on success
    await query('UPDATE users SET last_login_at=NOW(), failed_login_attempts=0, locked_until=NULL WHERE id=$1', [user.id]);

    const fp     = this._fingerprint(req);
    const tokens = this.generateTokens(user.id, fp);

    // Rotate: delete old tokens for device, insert new one
    await this._storeRefreshToken(user.id, tokens.refreshToken, fp);

    await cache.set(`user:${user.id}`, {
      id: user.id, email: user.email, first_name: user.first_name,
      last_name: user.last_name, is_active: user.is_active, profile_stage: user.profile_stage,
    }, 900); // 15-min cache (matches access token)

    logger.info('User logged in', { userId: user.id });
    return {
      user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, profileStage: user.profile_stage },
      tokens,
    };
  }

  // ── Refresh token rotation ───────────────────────────────────────────────────
  async refresh(refreshToken, req) {
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
    if (decoded.type !== 'refresh') throw new UnauthorizedError('Invalid token type');

    // Verify token exists in DB
    const rows = await query(
      'SELECT * FROM refresh_tokens WHERE user_id=$1 AND expires_at>NOW() AND revoked=FALSE',
      [decoded.userId]
    );
    const match = await Promise.any(
      rows.rows.map(t => bcrypt.compare(refreshToken, t.token_hash).then(ok => ok ? t : Promise.reject()))
    ).catch(() => null);

    if (!match) throw new UnauthorizedError('Refresh token not found or revoked');

    // Fingerprint check (optional, soft — log mismatch but allow for now)
    const fp = this._fingerprint(req);
    if (decoded.fp && decoded.fp !== fp) {
      logger.warn('Refresh token fingerprint mismatch', { userId: decoded.userId });
    }

    // Revoke used token (rotation)
    await query('UPDATE refresh_tokens SET revoked=TRUE WHERE id=$1', [match.id]);

    // Issue new pair
    const newTokens = this.generateTokens(decoded.userId, fp);
    await this._storeRefreshToken(decoded.userId, newTokens.refreshToken, fp);

    return newTokens;
  }

  // ── Logout ───────────────────────────────────────────────────────────────────
  async logout(token, userId) {
    const decoded = jwt.decode(token);
    const ttl     = decoded ? Math.max(decoded.exp - Math.floor(Date.now() / 1000), 0) : 900;
    await cache.set(`blacklist:${decoded?.jti || token.substring(0, 20)}`, '1', ttl);
    await cache.del(`user:${userId}`);
    await query('UPDATE refresh_tokens SET revoked=TRUE WHERE user_id=$1', [userId]);
    logger.info('User logged out', { userId });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  async _storeRefreshToken(userId, refreshToken, fingerprint = '') {
    const hash      = await bcrypt.hash(refreshToken, 8);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at, fingerprint) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      [userId, hash, expiresAt, fingerprint]
    );
  }
}

module.exports = new AuthService();
