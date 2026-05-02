// src/database/connection.js — SQLite via sql.js (pure JS, no native build)
// Drop-in replacement for PostgreSQL. Same query()/transaction() API.
"use strict";

require("dotenv").config();
const path = require("path");
const fs = require("fs");
const initSqlJs = require("sql.js");
const { v4: uuidv4 } = require("uuid");
const logger = require("../utils/logger");

const DB_PATH =
  process.env.SQLITE_PATH ||
  path.join(__dirname, "../../data/FutureFin.sqlite");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let _db = null;
let _SQL = null;

async function initDB() {
  if (_db) return _db;
  _SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    _db = new _SQL.Database(fs.readFileSync(DB_PATH));
    logger.info("[SQLite] Loaded: " + DB_PATH);
  } else {
    _db = new _SQL.Database();
    logger.info("[SQLite] New database → " + DB_PATH);
  }
  _db.run("PRAGMA foreign_keys=ON;");
  _db.run("PRAGMA synchronous=NORMAL;");
  return _db;
}

function persist() {
  if (!_db) return;
  try {
    fs.writeFileSync(DB_PATH, Buffer.from(_db.export()));
  } catch (e) {
    logger.error("[SQLite] persist error:", e.message);
  }
}
setInterval(persist, 30000);
process.on("exit", persist);
process.on("SIGINT", () => {
  persist();
  process.exit(0);
});
process.on("SIGTERM", () => {
  persist();
  process.exit(0);
});

// $1,$2,... → ?
function convertSQL(sql) {
  return sql.replace(/\$\d+/g, "?");
}

// JSON columns stored as TEXT in SQLite
const JSON_COLS = new Set([
  "standardized_scores",
  "languages",
  "key_milestones",
  "key_influencing_factors",
  "programs",
  "field_rankings",
  "key_factors",
  "scenarios",
  "twin_data",
  "current_state",
  "financial_twin",
  "career_twin",
  "risk_profile",
  "score_changes",
  "dimension_scores",
  "red_flags",
  "green_lights",
  "probability_breakdown",
  "loan_burden_analysis",
  "top_3_actions",
  "full_report",
  "red_alerts",
  "intervention_plan",
  "negotiation_tactics",
  "alternative_financing",
  "full_strategy",
  "life_dimensions",
  "five_year_scenarios",
  "full_analysis",
  "input_parameters",
  "result",
  "context_used",
  "properties",
  "input_data",
  "output_data",
  "rejection_reasons",
  "improvement_suggestions",
  "pros",
  "cons",
  "uncertainty_flags",
  "top_hiring_companies",
  "top_hiring_locations",
  "top_recruiters",
  "required_skills",
  "skill_gaps",
  "recommended_certifications",
  "available_fields",
  "target_fields",
  "target_countries",
  "technical_skills",
  "soft_skills",
  "interests",
  "extracurriculars",
  "certifications",
  "hidden_strengths",
  "nudge_type",
  "topics_detected",
  "salary_timeline_usd",
  "salary_timeline_inr",
]);
const BOOL_COLS = new Set([
  "is_active",
  "has_property",
  "has_cosigner",
  "onboarding_completed",
  "email_verified",
  "revoked",
  "scholarship_availability",
  "financial_aid_availability",
  "worth_it_flag",
  "is_loan_safe",
  "research_experience",
]);

function parseRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) {
      out[k] = v;
      continue;
    }
    if (BOOL_COLS.has(k)) {
      out[k] = v === 1 || v === true;
      continue;
    }
    if (typeof v === "string" && JSON_COLS.has(k)) {
      try {
        out[k] = JSON.parse(v);
      } catch {
        out[k] = v;
      }
      continue;
    }
    out[k] = v;
  }
  return out;
}

function ser(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "object") return JSON.stringify(v);
  return v;
}

async function query(sql, params = []) {
  const db = await initDB();

  // Strip PostgreSQL-only syntax
  let q = convertSQL(sql.trim())
    .replace(/uuid_generate_v4\(\)/gi, `'${uuidv4()}'`)
    .replace(/NOW\(\)/gi, "datetime('now')")
    .replace(/CURRENT_TIMESTAMP/gi, "datetime('now')")
    .replace(/::text/gi, "")
    .replace(/::jsonb/gi, "")
    .replace(/::json/gi, "")
    .replace(/::integer/gi, "")
    .replace(/::numeric/gi, "")
    .replace(/::boolean/gi, "")
    .replace(/::varchar(\(\d+\))?/gi, "")
    .replace(/::uuid/gi, "")
    .replace(/ILIKE/gi, "LIKE")
    .replace(/ON CONFLICT DO NOTHING/gi, "OR IGNORE")
    .replace(/ON CONFLICT \([^)]+\) DO NOTHING/gi, "OR IGNORE")
    .replace(/ON CONFLICT \([^)]+\) DO UPDATE SET/gi, "OR REPLACE SET");

  const serialized = params.map(ser);
  const upper = q.trimStart().slice(0, 6).toUpperCase();
  const isSelect =
    upper === "SELECT" || q.trimStart().toUpperCase().startsWith("WITH");

  try {
    if (isSelect) {
      const stmt = db.prepare(q);
      stmt.bind(serialized);
      const rows = [];
      while (stmt.step()) rows.push(parseRow(stmt.getAsObject()));
      stmt.free();
      return { rows, rowCount: rows.length };
    }

    // Check for RETURNING clause
    const retMatch =
      q.match(/RETURNING\s+\*/i) || q.match(/RETURNING\s+[\w,\s]+$/i);
    const tableMatch = q.match(/(?:INTO|UPDATE|FROM)\s+(\w+)/i);

    db.run(q, serialized);
    const changed = db.getRowsModified();

    if (retMatch && tableMatch) {
      const table = tableMatch[1];
      const rowid = db.exec("SELECT last_insert_rowid()")[0]?.values?.[0]?.[0];
      if (rowid) {
        const s = db.prepare(`SELECT * FROM ${table} WHERE rowid = ?`);
        s.bind([rowid]);
        const rows = [];
        while (s.step()) rows.push(parseRow(s.getAsObject()));
        s.free();
        return { rows, rowCount: rows.length };
      }
    }
    return { rows: [], rowCount: changed };
  } catch (e) {
    logger.error("[SQLite] Query error:", {
      sql: q.substring(0, 150),
      err: e.message,
    });
    throw e;
  }
}

async function transaction(callback) {
  const db = await initDB();
  const client = { query: async (s, p = []) => query(s, p), release: () => {} };
  db.run("BEGIN");
  try {
    const result = await callback(client);
    db.run("COMMIT");
    persist();
    return result;
  } catch (e) {
    try {
      db.run("ROLLBACK");
    } catch {}
    throw e;
  }
}

async function getClient() {
  await initDB();
  return { query: async (s, p = []) => query(s, p), release: () => {} };
}
function getPool() {
  return { query };
}
async function testConnection() {
  try {
    await initDB();
    const r = await query("SELECT 1 AS ok");
    return r.rows[0]?.ok === 1;
  } catch {
    return false;
  }
}

module.exports = {
  query,
  transaction,
  getClient,
  getPool,
  testConnection,
  initDB,
  persist,
};
