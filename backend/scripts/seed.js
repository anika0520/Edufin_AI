// scripts/seed.js — Seed demo data for FutureFin AI (SQLite)
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { initDB, query, persist } = require("../src/database/connection");

async function seed() {
  console.log("🌱  FutureFin AI — Seeding demo data");
  console.log("─".repeat(40));

  await initDB();

  // Demo user
  const userId = uuidv4();
  const hash = await bcrypt.hash("Demo@1234", 10);

  try {
    await query(
      `INSERT OR IGNORE INTO users (id, email, password_hash, first_name, last_name, nationality, current_country, profile_stage, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        "demo@FutureFin.ai",
        hash,
        "Aarav",
        "Sharma",
        "Indian",
        "India",
        "complete",
        1,
      ],
    );
    console.log("  ✅ Demo user: demo@FutureFin.ai / Demo@1234");
  } catch (e) {
    console.log("  ⚠️  Demo user already exists, skipping");
  }

  // Check if profile already seeded
  const existing = await query(
    "SELECT id FROM student_profiles WHERE user_id = ?",
    [userId],
  );
  if (existing.rows.length > 0) {
    console.log("  ⚠️  Profile already seeded, skipping");
    persist();
    console.log("\nSeed complete!");
    process.exit(0);
  }

  const profileId = uuidv4();
  await query(
    `INSERT OR IGNORE INTO student_profiles
       (id, user_id, highest_education, gpa, gpa_scale, major, institution_name,
        graduation_year, technical_skills, soft_skills, interests,
        work_experience_months, annual_family_income, income_currency,
        savings_available, has_property, has_cosigner,
        target_degree, target_fields, target_countries, target_start_year,
        budget_max, budget_currency, career_goals, risk_appetite, profile_completeness)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      profileId,
      userId,
      "Bachelor's",
      8.2,
      10.0,
      "Computer Science",
      "IIT Bombay",
      2024,
      JSON.stringify([
        "Python",
        "Machine Learning",
        "React",
        "SQL",
        "Data Analysis",
      ]),
      JSON.stringify(["Communication", "Problem Solving", "Leadership"]),
      JSON.stringify(["AI/ML", "Fintech", "Climate Tech"]),
      12,
      800000,
      "INR",
      250000,
      0,
      0,
      "master",
      JSON.stringify(["Computer Science", "Data Science", "AI"]),
      JSON.stringify(["Canada", "Germany", "Singapore"]),
      2025,
      5000000,
      "INR",
      "Become a senior ML engineer at a top tech company",
      "moderate",
      85,
    ],
  );

  await query(
    `INSERT OR IGNORE INTO behavioral_scores (id, user_id) VALUES (?, ?)`,
    [uuidv4(), userId],
  );

  persist();
  console.log(
    "  ✅ Demo profile created (IIT Bombay CS, targets Canada/Germany/Singapore)",
  );
  console.log("  ✅ Behavioral scores initialized");
  console.log("\n─".repeat(40));
  console.log("Seed complete!\n");
  console.log("Login: demo@FutureFin.ai / Demo@1234\n");
  process.exit(0);
}

seed().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
