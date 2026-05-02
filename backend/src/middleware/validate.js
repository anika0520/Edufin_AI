// src/middleware/validate.js — Strict Input Validation
// Wraps Joi validation + prompt injection detection in a clean middleware factory.

const Joi = require('joi');
const { sanitizePromptInput, detectInjection } = require('../utils/piiRedactor');
const logger = require('../utils/logger');

/**
 * validateBody(schema) — Express middleware factory.
 * Validates req.body against a Joi schema and sanitizes all string fields.
 */
function validateBody(schema) {
  return (req, res, next) => {
    // Sanitize all string fields first
    req.body = deepSanitize(req.body);

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false,
    });

    if (error) {
      const messages = error.details.map((d) => d.message);
      logger.warn('Validation failed', { path: req.path, errors: messages, userId: req.userId });
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages,
      });
    }

    req.body = value;
    next();
  };
}

/**
 * validateQuery(schema) — same but for query params.
 */
function validateQuery(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: error.details.map((d) => d.message),
      });
    }

    req.query = value;
    next();
  };
}

/**
 * Recursively sanitize all strings in an object to prevent prompt injection.
 */
function deepSanitize(obj) {
  if (typeof obj === 'string') {
    const check = detectInjection(obj);
    if (!check.safe) {
      logger.warn('[Security] Injection pattern detected and neutralized', { reason: check.reason });
    }
    return sanitizePromptInput(obj);
  }
  if (Array.isArray(obj)) return obj.map(deepSanitize);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = deepSanitize(v);
    return out;
  }
  return obj;
}

// ─── Reusable Joi schema fragments ───────────────────────────────────────────

const uuid = () => Joi.string().uuid({ version: 'uuidv4' });
const safeString = (max = 500) => Joi.string().trim().max(max);
const currency = () => Joi.number().min(0).max(1e10);
const percentage = () => Joi.number().min(0).max(100);

// ─── Profile Schema ───────────────────────────────────────────────────────────

const profileSchema = Joi.object({
  // Academic
  highest_education: Joi.string().valid('high_school', 'bachelor', 'master', 'phd', 'diploma').optional(),
  gpa: Joi.number().min(0).max(10).optional(),
  gpa_scale: Joi.number().valid(4.0, 5.0, 7.0, 10.0).optional(),
  major: safeString(200).optional(),
  institution_name: safeString(300).optional(),
  graduation_year: Joi.number().integer().min(1990).max(2035).optional(),
  standardized_scores: Joi.object({
    SAT: Joi.number().min(400).max(1600).optional(),
    GRE: Joi.number().min(260).max(340).optional(),
    GMAT: Joi.number().min(200).max(800).optional(),
    IELTS: Joi.number().min(0).max(9).optional(),
    TOEFL: Joi.number().min(0).max(120).optional(),
  }).optional(),

  // Skills
  technical_skills: Joi.array().items(safeString(100)).max(30).optional(),
  soft_skills: Joi.array().items(safeString(100)).max(20).optional(),
  interests: Joi.array().items(safeString(100)).max(20).optional(),
  certifications: Joi.array().items(safeString(200)).max(20).optional(),
  work_experience_months: Joi.number().integer().min(0).max(600).optional(),
  work_experience_summary: safeString(1000).optional(),

  // Financial
  annual_family_income: currency().optional(),
  income_currency: Joi.string().valid('INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD').optional(),
  savings_available: currency().optional(),
  has_property: Joi.boolean().optional(),
  property_value: currency().optional(),
  outstanding_loans: currency().optional(),
  has_cosigner: Joi.boolean().optional(),
  cosigner_income: currency().optional(),

  // Goals
  target_degree: Joi.string().valid('master', 'phd', 'mba', 'diploma', 'bachelor', 'certificate').optional(),
  target_fields: Joi.array().items(safeString(100)).max(10).optional(),
  target_countries: Joi.array().items(safeString(100)).max(10).optional(),
  target_start_year: Joi.number().integer().min(2024).max(2035).optional(),
  budget_min: currency().optional(),
  budget_max: currency().optional(),
  budget_currency: Joi.string().valid('INR', 'USD', 'EUR', 'GBP').optional(),
  career_goals: safeString(1000).optional(),
  motivation_text: safeString(1000).optional(),
  risk_appetite: Joi.string().valid('conservative', 'moderate', 'aggressive').optional(),
});

// ─── Auth Schemas ─────────────────────────────────────────────────────────────

const registerSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).lowercase().required(),
  password: Joi.string()
    .min(8).max(128)
    .pattern(/[A-Z]/, 'uppercase')
    .pattern(/[0-9]/, 'number')
    .required()
    .messages({
      'string.pattern.name': 'Password must contain at least one {{#name}} character',
    }),
  firstName: Joi.string().trim().min(1).max(100).required(),
  lastName: Joi.string().trim().min(1).max(100).required(),
  phone: Joi.string().pattern(/^\+?[\d\s\-()]{7,20}$/).optional(),
  nationality: safeString(100).optional(),
  currentCountry: safeString(100).optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).lowercase().required(),
  password: Joi.string().max(256).required(),
});

// ─── Analysis Schema ──────────────────────────────────────────────────────────

const analyzeSchema = Joi.object({
  forceRefresh: Joi.boolean().optional(),
  requestedLoanAmount: currency().optional(),
  tuitionUsd: currency().optional(),
  livingCostUsd: currency().optional(),
  programDurationYears: Joi.number().min(0.5).max(6).optional(),
  targetCountry: safeString(100).optional(),
  targetUniversity: safeString(300).optional(),
  targetProgram: safeString(300).optional(),
  preferredCurrency: Joi.string().valid('INR', 'USD', 'EUR', 'GBP').optional(),
  includeTaxAnalysis: Joi.boolean().optional(),
  includeAlternatives: Joi.boolean().optional(),
});

// ─── Simulation Schema ────────────────────────────────────────────────────────

const simulationSchema = Joi.object({
  country: safeString(100).required(),
  university: safeString(300).required(),
  program: safeString(300).required(),
  totalCostInr: currency().required(),
  salaryVariance: Joi.number().min(-50).max(100).optional(),
  jobDelayMonths: Joi.number().integer().min(0).max(24).optional(),
  expectedSalaryInr: currency().optional(),
  loanAmountInr: currency().optional(),
});

// ─── Mentor Chat Schema ───────────────────────────────────────────────────────

const mentorChatSchema = Joi.object({
  message: safeString(500).required(),
  context: Joi.object({
    history: Joi.array().items(
      Joi.object({ role: Joi.string(), content: safeString(1000) })
    ).max(10).optional(),
  }).optional(),
});

// ─── Loan Schema ──────────────────────────────────────────────────────────────

const loanAssessSchema = Joi.object({
  requestedAmount: currency().min(1000).required(),
  currency: Joi.string().valid('INR', 'USD').optional(),
  tuition: currency().optional(),
  livingCost: currency().optional(),
  programDurationYears: Joi.number().min(0.5).max(6).optional(),
});

module.exports = {
  validateBody,
  validateQuery,
  deepSanitize,
  // Schemas
  profileSchema,
  registerSchema,
  loginSchema,
  analyzeSchema,
  simulationSchema,
  mentorChatSchema,
  loanAssessSchema,
};
