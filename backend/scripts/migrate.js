// scripts/migrate.js — Run SQLite schema (safe to run multiple times)
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const { initDB, query, persist } = require("../src/database/connection");

async function migrate() {
  console.log("🗄️  FutureFin AI — SQLite Migration");
  console.log("─".repeat(40));

  await initDB();

  const schemaPath = path.join(__dirname, "schema.sqlite.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");

  // Split on semicolons, run each statement
  const statements = sql
    .split(";")
    .map((s) => s.replace(/--[^\n]*/g, "").trim())
    .filter((s) => s.length > 0);

  let ok = 0,
    skip = 0;
  for (const stmt of statements) {
    try {
      await query(stmt);
      ok++;
    } catch (e) {
      if (e.message.includes("already exists")) {
        skip++;
        continue;
      }
      console.error("  ✗ Error:", e.message, "\n  SQL:", stmt.substring(0, 80));
    }
  }

  persist();
  console.log(`  ✅ ${ok} statements applied, ${skip} skipped (already exist)`);
  console.log("─".repeat(40));
  console.log("Migration complete!\n");
  process.exit(0);
}

migrate().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
