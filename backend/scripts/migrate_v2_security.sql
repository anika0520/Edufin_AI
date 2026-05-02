-- scripts/migrate_v2_security.sql
-- Run ONCE in production to add v2.0 security columns
-- Safe to run multiple times (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)

-- ── Auth hardening ────────────────────────────────────────────────────────────

-- Account lockout
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until          TIMESTAMP;

-- Refresh token hardening: revocation flag + device fingerprint
ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS revoked     BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(64) DEFAULT '';

-- Index for fast lookup of active (non-revoked) tokens per user
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active
  ON refresh_tokens (user_id, expires_at, revoked)
  WHERE revoked = FALSE;

-- ── AI audit trail ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_audit_log (
  id            UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID      REFERENCES users(id) ON DELETE SET NULL,
  correlation_id VARCHAR(64),
  action        VARCHAR(100) NOT NULL,
  agent         VARCHAR(50),
  model_used    VARCHAR(100),
  prompt_tokens INTEGER   DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  cost_usd      DECIMAL(10,6) DEFAULT 0,
  pii_redacted  BOOLEAN   DEFAULT TRUE,
  success       BOOLEAN   DEFAULT TRUE,
  error_message TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_audit_user   ON ai_audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_audit_action ON ai_audit_log (action, created_at DESC);

-- ── Data retention (soft delete support) ─────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMP;

-- ── Consent management ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_consents (
  id          UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type VARCHAR(50) NOT NULL,   -- 'analytics' | 'marketing' | 'data_processing' | 'ai_training'
  granted     BOOLEAN   NOT NULL DEFAULT TRUE,
  ip_address  VARCHAR(45),
  granted_at  TIMESTAMP DEFAULT NOW(),
  revoked_at  TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_consents_type
  ON user_consents (user_id, consent_type)
  WHERE revoked_at IS NULL;

-- ── Performance indexes for growing tables ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_simulations_user_created
  ON future_simulations (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_career_recs_user_active
  ON career_recommendations (user_id, is_active, rank);
CREATE INDEX IF NOT EXISTS idx_behavioral_user_time
  ON behavioral_events (user_id, event_type, created_at DESC);

-- Partial index — only index incomplete profiles (frequent query pattern)
CREATE INDEX IF NOT EXISTS idx_profiles_incomplete
  ON student_profiles (user_id)
  WHERE profile_completeness < 80;

RAISE NOTICE 'v2.0 security migration complete.';
