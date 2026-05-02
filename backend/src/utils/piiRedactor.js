// src/utils/piiRedactor.js — PII Redaction Layer v2
const logger = require('./logger');

const EMAIL_RE    = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE    = /(\+91[\-\s]?)?[6-9]\d{9}/g;
const PAN_RE      = /[A-Z]{5}[0-9]{4}[A-Z]{1}/g;
const AADHAR_RE   = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;
const PASSPORT_RE = /[A-Z][0-9]{7}/g;
const IFSC_RE     = /[A-Z]{4}0[A-Z0-9]{6}/g;
const ACCOUNT_RE  = /\b\d{9,18}\b/g;

function redactString(text) {
  if (typeof text !== 'string') return { redacted: text, log: [] };
  const log = [];
  let out = text;
  const replace = (re, label, replacement) => {
    const matches = out.match(re);
    if (matches) { log.push(label + ': ' + matches.length); out = out.replace(re, replacement); }
  };
  replace(EMAIL_RE,    'email',        '[EMAIL_REDACTED]');
  replace(PAN_RE,      'PAN',          '[PAN_REDACTED]');
  replace(AADHAR_RE,   'Aadhaar',      '[AADHAAR_REDACTED]');
  replace(PASSPORT_RE, 'passport',     '[PASSPORT_REDACTED]');
  replace(IFSC_RE,     'IFSC',         '[IFSC_REDACTED]');
  replace(ACCOUNT_RE,  'bank-account', '[ACCOUNT_REDACTED]');
  replace(PHONE_RE,    'phone',        '[PHONE_REDACTED]');
  return { redacted: out, log };
}

function incomeBracket(income) {
  const n = parseFloat(income);
  if (n < 300000)  return 'low (<₹3L)';
  if (n < 600000)  return 'lower-middle (₹3-6L)';
  if (n < 1200000) return 'middle (₹6-12L)';
  if (n < 2500000) return 'upper-middle (₹12-25L)';
  return 'high (>₹25L)';
}

function redactProfile(profile) {
  if (!profile || typeof profile !== 'object') return profile;
  const out = { ...profile };
  const redactedFields = [];

  if (out.first_name || out.last_name || out.name) {
    redactedFields.push('name');
    out.first_name = '[STUDENT_FIRST]';
    out.last_name  = '[STUDENT_LAST]';
    out.name       = '[STUDENT_NAME]';
  }
  if (out.email) { redactedFields.push('email'); out.email = '[EMAIL_REDACTED]'; }
  if (out.phone) { redactedFields.push('phone'); out.phone = '[PHONE_REDACTED]'; }

  for (const field of ['work_experience_summary', 'motivation_text', 'career_goals']) {
    if (out[field]) {
      const str = typeof out[field] === 'string' ? out[field] : JSON.stringify(out[field]);
      const { redacted, log } = redactString(str);
      if (log.length) { redactedFields.push(field); try { out[field] = JSON.parse(redacted); } catch { out[field] = redacted; } }
    }
  }

  if (out.annual_family_income) {
    out.annual_family_income_bracket = incomeBracket(out.annual_family_income);
    delete out.annual_family_income;
    redactedFields.push('annual_family_income → bracket');
  }

  if (redactedFields.length) logger.info('[PII] Redacted before LLM call:', { fields: redactedFields });
  return out;
}

function sanitizePromptInput(input) {
  if (typeof input !== 'string') return input;
  let out = input
    .replace(/```[\s\S]*?```/g, '[CODE_BLOCK]')
    .replace(/\bignore\s+(all\s+)?previous\s+instructions?\b/gi, '[FILTERED]')
    .replace(/\bact\s+as\s+(if\s+you\s+are|a)\b/gi, '[FILTERED]')
    .replace(/\bsystem\s+prompt\b/gi, '[FILTERED]')
    .replace(/\byou\s+are\s+now\b/gi, '[FILTERED]')
    .replace(/\s{3,}/g, '  ')
    .trim();
  if (out.length > 2000) { out = out.substring(0, 2000) + ' [TRUNCATED]'; }
  return out;
}

function detectInjection(text) {
  if (typeof text !== 'string') return { safe: true };
  const dangerous = [
    /ignore\s+(all\s+)?previous\s+instructions?/i,
    /you\s+are\s+(now|a|an)\s+/i,
    /act\s+as\s+(?:if\s+)?(?:you\s+(?:are|were)|a[n]?\s)/i,
    /\bDAN\b/,
    /forget\s+(all\s+)?your\s+(previous\s+)?instructions/i,
    /system:\s*\[/i,
    /<\|im_start\|>/i,
  ];
  for (const re of dangerous) {
    if (re.test(text)) return { safe: false, reason: 'Matched: ' + re.source };
  }
  return { safe: true };
}

module.exports = { redactProfile, redactString, sanitizePromptInput, detectInjection, incomeBracket };
