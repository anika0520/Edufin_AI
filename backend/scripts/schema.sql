-- ============================================================
-- EduFin AI Platform - Complete Database Schema
-- PostgreSQL 14+
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS & AUTHENTICATION
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    date_of_birth DATE,
    nationality VARCHAR(100),
    current_country VARCHAR(100),
    profile_stage VARCHAR(50) DEFAULT 'basic', -- basic | academic | financial | complete
    onboarding_completed BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    fingerprint VARCHAR(64) DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- STUDENT PROFILES (USER INTELLIGENCE ENGINE)
-- ============================================================

CREATE TABLE IF NOT EXISTS student_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Academic Background
    highest_education VARCHAR(100),          -- high_school | bachelor | master
    gpa DECIMAL(3,2),                        -- 0.00 - 4.00 scale
    gpa_scale DECIMAL(3,1) DEFAULT 4.0,
    standardized_scores JSONB DEFAULT '{}',  -- {SAT: 1400, GRE: 320, GMAT: 680, IELTS: 7.5}
    major VARCHAR(200),
    institution_name VARCHAR(300),
    graduation_year INTEGER,
    research_experience TEXT,
    publications INTEGER DEFAULT 0,

    -- Skills & Interests
    technical_skills TEXT[],
    soft_skills TEXT[],
    languages JSONB DEFAULT '[]',            -- [{lang: "Hindi", level: "native"}, ...]
    interests TEXT[],
    extracurriculars TEXT[],
    certifications TEXT[],
    work_experience_months INTEGER DEFAULT 0,
    work_experience_summary TEXT,

    -- Financial Background
    annual_family_income DECIMAL(15,2),
    income_currency VARCHAR(10) DEFAULT 'USD',
    family_income_bracket VARCHAR(50),       -- low | lower_middle | middle | upper_middle | high
    savings_available DECIMAL(15,2),
    has_property BOOLEAN DEFAULT FALSE,
    property_value DECIMAL(15,2),
    outstanding_loans DECIMAL(15,2) DEFAULT 0,
    credit_score_proxy INTEGER,              -- Computed from income/assets (0-850 range)
    has_cosigner BOOLEAN DEFAULT FALSE,
    cosigner_income DECIMAL(15,2),

    -- Goals & Preferences
    target_degree VARCHAR(100),              -- master | phd | mba | diploma
    target_fields TEXT[],                    -- ['computer science', 'data science']
    target_countries TEXT[],
    target_start_year INTEGER,
    budget_min DECIMAL(15,2),
    budget_max DECIMAL(15,2),
    budget_currency VARCHAR(10) DEFAULT 'USD',
    career_goals TEXT,
    motivation_text TEXT,

    -- AI-Generated Profile (computed, stored for efficiency)
    profile_vector_id VARCHAR(255),          -- ChromaDB vector ID
    personality_type VARCHAR(50),            -- RIASEC codes: R|I|A|S|E|C combinations
    risk_appetite VARCHAR(20),               -- conservative | moderate | aggressive
    hidden_strengths TEXT[],
    career_personality_summary TEXT,
    profile_completeness INTEGER DEFAULT 0, -- 0-100%
    ai_profile_generated_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- CAREER RECOMMENDATIONS (CAREER ENGINE)
-- ============================================================

CREATE TABLE IF NOT EXISTS career_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    career_title VARCHAR(200) NOT NULL,
    career_field VARCHAR(200),
    rank INTEGER NOT NULL,                   -- 1 = top recommendation

    -- Probability & Scoring
    probability_score DECIMAL(5,2),          -- 0-100%
    market_demand_score DECIMAL(5,2),        -- 0-100
    salary_potential_score DECIMAL(5,2),
    skill_match_score DECIMAL(5,2),
    overall_score DECIMAL(5,2),

    -- Salary Data
    entry_salary_usd DECIMAL(12,2),
    mid_salary_usd DECIMAL(12,2),
    senior_salary_usd DECIMAL(12,2),
    salary_growth_rate_annual DECIMAL(5,2),

    -- Roadmap
    time_to_achieve_months INTEGER,
    key_milestones JSONB DEFAULT '[]',       -- [{month: 6, milestone: "Land first job"}, ...]
    required_skills TEXT[],
    skill_gaps TEXT[],                        -- What student currently lacks
    recommended_certifications TEXT[],

    -- Market Data
    global_job_openings INTEGER,
    yoy_growth_percent DECIMAL(5,2),
    top_hiring_companies TEXT[],
    top_hiring_locations TEXT[],
    automation_risk VARCHAR(20),             -- low | medium | high

    -- Explainability
    confidence_score DECIMAL(5,2),
    reasoning TEXT,
    key_influencing_factors JSONB DEFAULT '[]',

    recommendation_version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- UNIVERSITIES (UNIVERSITY RECOMMENDATION ENGINE)
-- ============================================================

CREATE TABLE IF NOT EXISTS universities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(300) NOT NULL,
    country VARCHAR(100) NOT NULL,
    city VARCHAR(100),
    website VARCHAR(300),
    type VARCHAR(50),                        -- public | private | research | liberal_arts

    -- Rankings
    qs_ranking INTEGER,
    times_ranking INTEGER,
    arwu_ranking INTEGER,
    country_ranking INTEGER,
    field_rankings JSONB DEFAULT '{}',       -- {'CS': 15, 'MBA': 30}

    -- Programs
    programs JSONB DEFAULT '[]',             -- [{name, degree, duration_months, tuition_usd}]
    available_fields TEXT[],

    -- Financials (USD)
    avg_tuition_usd DECIMAL(12,2),
    avg_living_cost_usd_monthly DECIMAL(10,2),
    scholarship_availability BOOLEAN DEFAULT TRUE,
    avg_scholarship_percent DECIMAL(5,2),
    financial_aid_availability BOOLEAN DEFAULT TRUE,

    -- Outcomes
    avg_placement_rate DECIMAL(5,2),
    avg_starting_salary_usd DECIMAL(12,2),
    median_salary_5yr_usd DECIMAL(12,2),
    top_recruiters TEXT[],
    alumni_network_size INTEGER,

    -- Admission Requirements
    min_gpa DECIMAL(3,2),
    min_ielts DECIMAL(3,1),
    min_toefl INTEGER,
    min_gre INTEGER,
    min_gmat INTEGER,
    acceptance_rate DECIMAL(5,2),

    -- AI data
    vector_id VARCHAR(255),
    data_updated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS university_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    university_id UUID NOT NULL REFERENCES universities(id),
    career_recommendation_id UUID REFERENCES career_recommendations(id),

    rank INTEGER NOT NULL,
    category VARCHAR(50),                    -- reach | match | safety

    -- Predictions
    admit_probability DECIMAL(5,2),
    expected_roi_score DECIMAL(5,2),
    fit_score DECIMAL(5,2),

    -- Financial Projections
    total_cost_usd DECIMAL(15,2),
    expected_scholarship_usd DECIMAL(12,2),
    net_cost_usd DECIMAL(15,2),
    expected_starting_salary_usd DECIMAL(12,2),
    break_even_months INTEGER,

    -- Explainability
    confidence_score DECIMAL(5,2),
    reasoning TEXT,
    pros TEXT[],
    cons TEXT[],
    key_factors JSONB DEFAULT '[]',

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- ROI & FINANCIAL INTELLIGENCE
-- ============================================================

CREATE TABLE IF NOT EXISTS roi_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    university_recommendation_id UUID REFERENCES university_recommendations(id),

    -- Cost Breakdown
    tuition_total_usd DECIMAL(15,2),
    living_cost_total_usd DECIMAL(15,2),
    misc_costs_usd DECIMAL(15,2),           -- books, travel, health insurance
    total_cost_usd DECIMAL(15,2),
    loan_amount_usd DECIMAL(15,2),
    self_funding_usd DECIMAL(15,2),

    -- Income Projections (10-year)
    year1_salary_usd DECIMAL(12,2),
    year3_salary_usd DECIMAL(12,2),
    year5_salary_usd DECIMAL(12,2),
    year10_salary_usd DECIMAL(12,2),
    cumulative_10yr_earnings_usd DECIMAL(15,2),

    -- ROI Metrics
    roi_score DECIMAL(5,2),                 -- 0-100
    break_even_months INTEGER,
    net_present_value_usd DECIMAL(15,2),
    internal_rate_of_return DECIMAL(5,2),   -- %
    payback_period_years DECIMAL(4,1),

    -- Risk Assessment
    risk_score DECIMAL(5,2),                -- 0-100 (higher = riskier)
    risk_category VARCHAR(20),              -- low | medium | high
    worth_it_flag BOOLEAN,                  -- The key decision flag
    worth_it_reasoning TEXT,

    -- Adjustments
    inflation_rate_assumed DECIMAL(4,2) DEFAULT 3.0,
    country_tax_rate DECIMAL(5,2),
    currency_target VARCHAR(10) DEFAULT 'USD',

    -- Scenario Simulations (stored as JSON)
    scenarios JSONB DEFAULT '[]',

    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- LOAN ELIGIBILITY ENGINE
-- ============================================================

CREATE TABLE IF NOT EXISTS loan_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    university_recommendation_id UUID REFERENCES university_recommendations(id),
    roi_analysis_id UUID REFERENCES roi_analyses(id),

    -- Application Status
    status VARCHAR(50) DEFAULT 'assessment', -- assessment | pre_approved | under_review | approved | rejected | disbursed

    -- Requested
    requested_amount_usd DECIMAL(15,2),
    requested_currency VARCHAR(10) DEFAULT 'USD',
    loan_purpose TEXT,

    -- AI Eligibility Assessment
    eligibility_score DECIMAL(5,2),         -- 0-100%
    max_approved_amount_usd DECIMAL(15,2),
    suggested_amount_usd DECIMAL(15,2),
    interest_rate_min DECIMAL(5,2),
    interest_rate_max DECIMAL(5,2),
    interest_rate_offered DECIMAL(5,2),
    loan_term_months INTEGER,
    emi_estimated_usd DECIMAL(10,2),

    -- Risk Classification
    risk_category VARCHAR(20),              -- low | medium | high
    risk_score DECIMAL(5,2),
    credit_score_proxy INTEGER,

    -- AI Credit Proxies (since students lack credit history)
    career_trajectory_score DECIMAL(5,2),
    university_roi_score DECIMAL(5,2),
    family_income_score DECIMAL(5,2),
    academic_strength_score DECIMAL(5,2),
    cosigner_boost DECIMAL(5,2),

    -- Explainability
    eligibility_reasoning TEXT,
    rejection_reasons TEXT[],
    improvement_suggestions TEXT[],
    confidence_score DECIMAL(5,2),
    key_factors JSONB DEFAULT '[]',

    -- Collateral / Guarantor
    collateral_type VARCHAR(100),
    collateral_value_usd DECIMAL(15,2),
    guarantor_name VARCHAR(200),
    guarantor_income_usd DECIMAL(12,2),

    assessment_completed_at TIMESTAMP,
    submitted_at TIMESTAMP,
    decision_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- AI MENTOR CHATBOT (RAG + Memory)
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_name VARCHAR(200),
    topic VARCHAR(100),                      -- career | loan | university | general | emotional
    is_active BOOLEAN DEFAULT TRUE,
    message_count INTEGER DEFAULT 0,
    total_tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    last_message_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,               -- user | assistant | system
    content TEXT NOT NULL,
    tokens_used INTEGER,
    context_used JSONB DEFAULT '{}',         -- What context was injected
    sentiment VARCHAR(20),                   -- positive | neutral | negative | anxious
    topics_detected TEXT[],
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- BEHAVIORAL ENGINE
-- ============================================================

CREATE TABLE IF NOT EXISTS behavioral_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(100),                 -- Browser session identifier
    event_type VARCHAR(100) NOT NULL,        -- page_view | button_click | form_start | form_abandon | time_spent | scroll
    page VARCHAR(200),
    element_id VARCHAR(200),
    properties JSONB DEFAULT '{}',           -- {duration_seconds, scroll_percent, etc.}
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS behavioral_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Conversion Scores (updated periodically)
    loan_intent_score DECIMAL(5,2) DEFAULT 0, -- 0-100: likelihood to apply for loan
    engagement_score DECIMAL(5,2) DEFAULT 0,  -- 0-100: overall engagement level
    readiness_score DECIMAL(5,2) DEFAULT 0,   -- 0-100: readiness to apply

    -- Behavioral Signals
    total_sessions INTEGER DEFAULT 0,
    avg_session_duration_seconds INTEGER DEFAULT 0,
    total_pages_viewed INTEGER DEFAULT 0,
    loan_page_visits INTEGER DEFAULT 0,
    calculator_interactions INTEGER DEFAULT 0,
    profile_completion_rate DECIMAL(5,2) DEFAULT 0,
    last_active_at TIMESTAMP,

    -- Funnel Position
    funnel_stage VARCHAR(50) DEFAULT 'awareness', -- awareness | interest | consideration | intent | application
    drop_off_point VARCHAR(200),
    consecutive_inactive_days INTEGER DEFAULT 0,

    computed_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nudges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nudge_type VARCHAR(100) NOT NULL,        -- email | in_app | sms
    trigger_reason VARCHAR(200) NOT NULL,
    message_title VARCHAR(300),
    message_body TEXT,
    cta_text VARCHAR(100),
    cta_url VARCHAR(500),
    priority VARCHAR(20) DEFAULT 'normal',   -- low | normal | high | urgent
    status VARCHAR(50) DEFAULT 'pending',    -- pending | sent | clicked | dismissed
    sent_at TIMESTAMP,
    clicked_at TIMESTAMP,
    dismissed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- SCENARIO SIMULATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS simulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    simulation_type VARCHAR(100) NOT NULL,   -- university_change | salary_drop | loan_amount | career_change
    input_parameters JSONB NOT NULL,
    result JSONB NOT NULL,
    baseline_roi_score DECIMAL(5,2),
    simulated_roi_score DECIMAL(5,2),
    recommendation TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- AUDIT & EXPLAINABILITY LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_decision_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    decision_type VARCHAR(100) NOT NULL,     -- career_rec | university_rec | loan_eligibility | roi
    decision_id UUID,                        -- Reference to actual record
    model_used VARCHAR(100),
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    confidence_score DECIMAL(5,2),
    reasoning TEXT,
    key_factors JSONB DEFAULT '[]',
    uncertainty_flags TEXT[],
    processing_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_student_profiles_user_id ON student_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_career_recs_user_id ON career_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_university_recs_user_id ON university_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_loan_apps_user_id ON loan_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_loan_apps_status ON loan_applications(status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_behavioral_events_user_id ON behavioral_events(user_id);
CREATE INDEX IF NOT EXISTS idx_behavioral_events_created_at ON behavioral_events(created_at);
CREATE INDEX IF NOT EXISTS idx_behavioral_scores_user_id ON behavioral_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_nudges_user_id ON nudges(user_id);
CREATE INDEX IF NOT EXISTS idx_nudges_status ON nudges(status);
CREATE INDEX IF NOT EXISTS idx_ai_decision_log_user_id ON ai_decision_log(user_id);
CREATE INDEX IF NOT EXISTS idx_universities_country ON universities(country);
CREATE INDEX IF NOT EXISTS idx_universities_qs_ranking ON universities(qs_ranking);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_student_profiles_updated_at BEFORE UPDATE ON student_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_loan_applications_updated_at BEFORE UPDATE ON loan_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_behavioral_scores_updated_at BEFORE UPDATE ON behavioral_scores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- FutureFin v2.0 — NEW ENGINE TABLES
-- ============================================================

-- Digital Twin State (persisted between sessions)
CREATE TABLE IF NOT EXISTS digital_twins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    twin_data JSONB NOT NULL DEFAULT '{}',
    current_state JSONB NOT NULL DEFAULT '{}',
    financial_twin JSONB NOT NULL DEFAULT '{}',
    career_twin JSONB NOT NULL DEFAULT '{}',
    risk_profile JSONB NOT NULL DEFAULT '{}',
    overall_potential_score DECIMAL(5,2) DEFAULT 0,
    financial_health_score DECIMAL(5,2) DEFAULT 0,
    career_readiness_score DECIMAL(5,2) DEFAULT 0,
    risk_exposure_score DECIMAL(5,2) DEFAULT 0,
    events_applied INTEGER DEFAULT 0,
    last_event VARCHAR(200),
    last_updated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Twin Events Log
CREATE TABLE IF NOT EXISTS digital_twin_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_details JSONB DEFAULT '{}',
    score_changes JSONB DEFAULT '[]',
    twin_reaction TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Reality Check Scores
CREATE TABLE IF NOT EXISTS reality_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    overall_success_probability DECIMAL(5,2),
    overall_risk_level VARCHAR(20),
    reality_verdict VARCHAR(100),
    dimension_scores JSONB DEFAULT '{}',
    red_flags JSONB DEFAULT '[]',
    green_lights JSONB DEFAULT '[]',
    probability_breakdown JSONB DEFAULT '{}',
    loan_burden_analysis JSONB DEFAULT '{}',
    top_3_actions JSONB DEFAULT '[]',
    confidence_score DECIMAL(5,2),
    full_report JSONB NOT NULL DEFAULT '{}',
    university_recommendation_id UUID REFERENCES university_recommendations(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Dropout Risk Predictions
CREATE TABLE IF NOT EXISTS dropout_risk_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    overall_risk_score DECIMAL(5,2),
    overall_risk_category VARCHAR(20),
    dropout_probability DECIMAL(5,2),
    semester_failure_probability DECIMAL(5,2),
    job_search_success_probability DECIMAL(5,2),
    loan_default_probability_3yr DECIMAL(5,2),
    loan_default_probability_5yr DECIMAL(5,2),
    bank_lending_risk_score DECIMAL(5,2),
    recommended_max_loan_usd DECIMAL(15,2),
    red_alerts JSONB DEFAULT '[]',
    intervention_plan JSONB DEFAULT '[]',
    full_report JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Loan Negotiation Strategies
CREATE TABLE IF NOT EXISTS loan_negotiations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_amount_usd DECIMAL(15,2),
    recommended_amount_usd DECIMAL(15,2),
    risk_reduction_percent DECIMAL(5,2),
    recommended_interest_rate DECIMAL(5,2),
    recommended_term_months INTEGER,
    recommended_emi_usd DECIMAL(12,2),
    emi_as_percent_salary DECIMAL(5,2),
    total_savings_vs_requested_usd DECIMAL(15,2),
    is_loan_safe BOOLEAN,
    negotiation_tactics JSONB DEFAULT '[]',
    alternative_financing JSONB DEFAULT '[]',
    full_strategy JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Regret Analyses
CREATE TABLE IF NOT EXISTS regret_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    decision_type VARCHAR(100),
    regret_score DECIMAL(5,2),
    regret_level VARCHAR(30),
    regret_verdict TEXT,
    bezos_test_answer VARCHAR(20),
    stress_years DECIMAL(5,2),
    reward_years DECIMAL(5,2),
    life_dimensions JSONB DEFAULT '{}',
    five_year_scenarios JSONB DEFAULT '[]',
    full_analysis JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Parent Reports
CREATE TABLE IF NOT EXISTS parent_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    language VARCHAR(20) DEFAULT 'english',
    overall_safety VARCHAR(20),
    traffic_light_overall VARCHAR(10),
    total_investment_summary TEXT,
    is_loan_safe BOOLEAN,
    full_report JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_digital_twins_user_id ON digital_twins(user_id);
CREATE INDEX IF NOT EXISTS idx_digital_twin_events_user_id ON digital_twin_events(user_id);
CREATE INDEX IF NOT EXISTS idx_reality_checks_user_id ON reality_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_dropout_risk_user_id ON dropout_risk_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_loan_negotiations_user_id ON loan_negotiations(user_id);
CREATE INDEX IF NOT EXISTS idx_regret_analyses_user_id ON regret_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_parent_reports_user_id ON parent_reports(user_id);

-- Add input_data / output_data columns to ai_decision_log if not present
ALTER TABLE ai_decision_log ADD COLUMN IF NOT EXISTS input_data JSONB DEFAULT '{}';
ALTER TABLE ai_decision_log ADD COLUMN IF NOT EXISTS output_data JSONB DEFAULT '{}';

