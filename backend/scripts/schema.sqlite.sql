-- scripts/schema.sqlite.sql
-- SQLite version of the FutureFin AI schema
-- Run: node scripts/migrate.js

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    date_of_birth TEXT,
    nationality TEXT,
    current_country TEXT,
    profile_stage TEXT DEFAULT 'basic',
    onboarding_completed INTEGER DEFAULT 0,
    email_verified INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    last_login_at TEXT,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- ── Refresh tokens ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked INTEGER DEFAULT 0,
    fingerprint TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rt_user ON refresh_tokens(user_id, revoked);

-- ── Student profiles ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_profiles (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Academic
    highest_education TEXT,
    gpa REAL,
    gpa_scale REAL DEFAULT 10.0,
    standardized_scores TEXT,      -- JSON
    major TEXT,
    institution_name TEXT,
    graduation_year INTEGER,
    research_experience INTEGER DEFAULT 0,
    publications INTEGER DEFAULT 0,
    -- Skills / interests
    technical_skills TEXT,         -- JSON array
    soft_skills TEXT,              -- JSON array
    languages TEXT,                -- JSON array
    interests TEXT,                -- JSON array
    extracurriculars TEXT,         -- JSON array
    certifications TEXT,           -- JSON array
    work_experience_months INTEGER DEFAULT 0,
    work_experience_summary TEXT,
    -- Financial
    annual_family_income REAL,
    income_currency TEXT DEFAULT 'INR',
    family_income_bracket TEXT,
    savings_available REAL,
    has_property INTEGER DEFAULT 0,
    property_value REAL,
    outstanding_loans REAL,
    has_cosigner INTEGER DEFAULT 0,
    cosigner_income REAL,
    -- Goals
    target_degree TEXT,
    target_fields TEXT,            -- JSON array
    target_countries TEXT,         -- JSON array
    target_start_year INTEGER,
    budget_min REAL,
    budget_max REAL,
    budget_currency TEXT DEFAULT 'INR',
    career_goals TEXT,
    motivation_text TEXT,
    risk_appetite TEXT DEFAULT 'moderate',
    -- Computed
    profile_completeness INTEGER DEFAULT 0,
    ai_readiness_score INTEGER DEFAULT 0,
    last_ai_analysis_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sp_user ON student_profiles(user_id);

-- ── Career recommendations ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS career_recommendations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    career_title TEXT NOT NULL,
    match_score INTEGER,
    growth_potential TEXT,
    avg_salary_usd REAL,
    avg_salary_inr REAL,
    required_skills TEXT,          -- JSON
    skill_gaps TEXT,               -- JSON
    recommended_certifications TEXT, -- JSON
    top_hiring_companies TEXT,     -- JSON
    top_hiring_locations TEXT,     -- JSON
    top_recruiters TEXT,           -- JSON
    rationale TEXT,
    rank INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cr_user ON career_recommendations(user_id, is_active, rank);

-- ── University recommendations ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS university_recommendations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    university_name TEXT NOT NULL,
    country TEXT,
    program_name TEXT,
    degree_type TEXT,
    duration_years REAL,
    tuition_usd REAL,
    tuition_inr REAL,
    living_cost_usd REAL,
    total_cost_usd REAL,
    scholarship_availability INTEGER DEFAULT 0,
    financial_aid_availability INTEGER DEFAULT 0,
    admission_chance INTEGER,
    qs_ranking INTEGER,
    program_ranking INTEGER,
    field_rankings TEXT,           -- JSON
    key_factors TEXT,              -- JSON
    pros TEXT,                     -- JSON
    cons TEXT,                     -- JSON
    roi_score REAL,
    worth_it_flag INTEGER DEFAULT 0,
    rank INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ur_user ON university_recommendations(user_id, is_active);

-- ── Loan evaluations ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loan_evaluations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_amount REAL,
    requested_currency TEXT DEFAULT 'INR',
    tuition REAL,
    living_cost REAL,
    total_cost_usd REAL,
    total_cost_inr REAL,
    eligible_amount_usd REAL,
    eligible_amount_inr REAL,
    interest_rate_percent REAL,
    loan_tenure_months INTEGER,
    monthly_emi_usd REAL,
    monthly_emi_inr REAL,
    annual_emi_inr REAL,
    total_repayment_inr REAL,
    total_interest_inr REAL,
    dti_ratio REAL,
    emi_as_pct_salary REAL,
    financial_stress_level TEXT,
    risk_score INTEGER,
    approval_probability TEXT,
    is_loan_safe INTEGER DEFAULT 0,
    rejection_reasons TEXT,        -- JSON
    improvement_suggestions TEXT,  -- JSON
    negotiation_tactics TEXT,      -- JSON
    alternative_financing TEXT,    -- JSON
    full_strategy TEXT,
    salary_timeline_usd TEXT,      -- JSON
    salary_timeline_inr TEXT,      -- JSON
    break_even_months INTEGER,
    payback_years REAL,
    roi_multiple REAL,
    net_present_value_usd REAL,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_le_user ON loan_evaluations(user_id);

-- ── Future simulations ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS future_simulations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    simulation_name TEXT,
    input_parameters TEXT,         -- JSON
    country TEXT,
    university TEXT,
    program TEXT,
    total_cost_inr REAL,
    expected_salary_inr REAL,
    job_delay_months INTEGER DEFAULT 0,
    salary_variance_percent REAL DEFAULT 0,
    monthly_emi_inr REAL,
    net_worth_5yr_inr REAL,
    stress_index REAL,
    verdict TEXT,
    message TEXT,
    salary_growth TEXT,            -- JSON
    emi_timeline TEXT,             -- JSON
    life_dimensions TEXT,          -- JSON
    five_year_scenarios TEXT,      -- JSON
    full_analysis TEXT,
    uncertainty_flags TEXT,        -- JSON
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fs_user ON future_simulations(user_id, created_at);

-- ── Digital twin ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS digital_twins (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    twin_data TEXT,                -- JSON (full twin state)
    current_state TEXT,            -- JSON
    financial_twin TEXT,           -- JSON
    career_twin TEXT,              -- JSON
    risk_profile TEXT,             -- JSON
    overall_score INTEGER DEFAULT 0,
    financial_score INTEGER DEFAULT 0,
    career_score INTEGER DEFAULT 0,
    risk_score INTEGER DEFAULT 0,
    reality_check_score INTEGER DEFAULT 0,
    last_updated_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
);

-- ── Twin events ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS twin_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_details TEXT,            -- JSON
    score_changes TEXT,            -- JSON
    dimension_scores TEXT,         -- JSON
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_te_user ON twin_events(user_id, created_at);

-- ── Decision reports ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decision_reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    verdict TEXT,
    verdict_color TEXT,
    confidence_score INTEGER,
    headline TEXT,
    explanation TEXT,
    suggested_action TEXT,
    key_reasons TEXT,              -- JSON
    conditions TEXT,               -- JSON
    action_timeline TEXT,          -- JSON
    alternative_paths TEXT,        -- JSON
    parent_summary TEXT,
    student_message TEXT,
    overall_score INTEGER,
    career_score INTEGER,
    financial_score INTEGER,
    risk_score INTEGER,
    reality_check_score INTEGER,
    full_report TEXT,              -- JSON
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dr_user ON decision_reports(user_id, created_at);

-- ── Dropout risk assessments ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dropout_risk_assessments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    risk_score INTEGER,
    risk_category TEXT,
    dropout_probability REAL,
    key_risk_factors TEXT,         -- JSON
    red_alerts TEXT,               -- JSON
    green_lights TEXT,             -- JSON
    probability_breakdown TEXT,    -- JSON
    loan_burden_analysis TEXT,     -- JSON
    intervention_plan TEXT,        -- JSON
    top_3_actions TEXT,            -- JSON
    full_report TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dra_user ON dropout_risk_assessments(user_id);

-- ── Regret analyses ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS regret_analyses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    regret_score REAL,
    primary_scenario TEXT,
    best_case TEXT,
    worst_case TEXT,
    most_likely TEXT,
    key_milestones TEXT,           -- JSON
    key_influencing_factors TEXT,  -- JSON
    scenarios TEXT,                -- JSON
    full_analysis TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ra_user ON regret_analyses(user_id);

-- ── Reality checks ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reality_checks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reality_score INTEGER,
    verdict TEXT,
    top_concerns TEXT,             -- JSON
    hidden_strengths TEXT,         -- JSON
    full_report TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rc_user ON reality_checks(user_id);

-- ── Mentor sessions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mentor_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_type TEXT DEFAULT 'general',
    topic TEXT,
    is_active INTEGER DEFAULT 1,
    message_count INTEGER DEFAULT 0,
    last_message_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ms_user ON mentor_sessions(user_id);

-- ── Mentor messages ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mentor_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES mentor_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    context_used TEXT,             -- JSON
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mm_session ON mentor_messages(session_id, created_at);

-- ── Behavioral scores ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS behavioral_scores (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    engagement_score INTEGER DEFAULT 50,
    risk_literacy_score INTEGER DEFAULT 50,
    financial_awareness_score INTEGER DEFAULT 50,
    decision_readiness_score INTEGER DEFAULT 50,
    overall_behavioral_score INTEGER DEFAULT 50,
    nudge_type TEXT DEFAULT 'encourager',
    hidden_strengths TEXT,         -- JSON
    topics_detected TEXT,          -- JSON
    last_updated TEXT DEFAULT (datetime('now'))
);

-- ── Behavioral events ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS behavioral_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data TEXT,               -- JSON
    page TEXT,
    session_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_be_user ON behavioral_events(user_id, event_type, created_at);

-- ── AI audit log ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    correlation_id TEXT,
    action TEXT NOT NULL,
    agent TEXT,
    model_used TEXT,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    pii_redacted INTEGER DEFAULT 1,
    success INTEGER DEFAULT 1,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_aal_user ON ai_audit_log(user_id, created_at);

-- ── User consents ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_consents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL,
    granted INTEGER NOT NULL DEFAULT 1,
    ip_address TEXT,
    granted_at TEXT DEFAULT (datetime('now')),
    revoked_at TEXT
);
