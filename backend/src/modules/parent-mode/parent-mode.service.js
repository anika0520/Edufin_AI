// src/modules/parent-mode/parent-mode.service.js
// ⚡ PARENT MODE — Genius for India 🇮🇳
// Simplifies complex AI output into what parents ACTUALLY care about:
// risk, safety, financial security, timeline, family impact

const { query } = require("../../database/connection");
const { cache } = require("../../config/redis");
const aiProvider = require("../../config/ai-provider");
const userIntelligenceService = require("../user-intelligence/user-intelligence.service");
const logger = require("../../utils/logger");

const PARENT_MODE_PROMPT = `You are FutureFin's Parent Communication Engine.
Indian parents (and parents globally) need to understand their child's education plan in SIMPLE language.
They care about: safety, risk, money, timeline, and their child's future.
They don't care about: ROI score, EMI optimization, credit proxies, or technical jargon.

STUDENT'S FULL ANALYSIS:
{STUDENT_DATA}

FAMILY CONTEXT:
{FAMILY_DATA}

Translate all the complex AI analysis into a parent-friendly report.
Use simple, warm, respectful language. Think like you are talking to the student's parents directly.
In India, parents want: safety, honour, financial security, and realistic expectations.

Respond ONLY with valid JSON:
{
  "parent_report_title": "Report for Parents of {student_name}",
  "greeting": "Warm 1-sentence greeting to parents",

  "plan_summary": {
    "what_child_wants": "Simple 2-3 sentence explanation of the student's plan — like you're telling parents over chai",
    "total_investment_needed": "₹X lakhs / $Y USD over Z years",
    "monthly_family_burden": "₹X per month for Z months",
    "when_loan_repayment_starts": "Repayment starts after graduation, approx in YYYY",
    "when_family_burden_ends": "Family financial burden ends by YYYY"
  },

  "is_it_safe": {
    "overall_safety": "Safe|Mostly Safe|Risky|Very Risky",
    "safety_explanation": "2-3 sentences in simple language about whether this plan is financially safe",
    "biggest_risk": "The main thing that could go wrong — plain language",
    "how_to_make_it_safer": "1-2 practical things parents can do to make the plan safer"
  },

  "money_questions_answered": [
    {
      "question": "How much money do we need?",
      "answer": "Simple direct answer"
    },
    {
      "question": "When will our child earn money?",
      "answer": "Simple direct answer"
    },
    {
      "question": "Is the loan safe?",
      "answer": "Simple direct answer"
    },
    {
      "question": "What if our child doesn't get a job?",
      "answer": "Simple direct answer about contingency"
    },
    {
      "question": "Will our savings be at risk?",
      "answer": "Simple direct answer"
    }
  ],

  "child_career_outlook": {
    "career_path": "Your child is working toward becoming a [Career Title]",
    "earning_potential": "After graduation, your child could earn ₹X lakhs (or $Y USD) per year",
    "job_market": "Job market outlook in plain language",
    "pride_factor": "One sentence about why this is a good career choice — for parent pride"
  },

  "risk_traffic_light": {
    "financial_risk": "green|yellow|red",
    "career_risk": "green|yellow|red",
    "loan_risk": "green|yellow|red",
    "overall_risk": "green|yellow|red",
    "traffic_light_explanation": "Green = Safe. Yellow = Watch carefully. Red = Needs attention."
  },

  "parent_action_items": [
    {
      "action": "What parents should do or ask",
      "why": "Why this matters",
      "priority": "Important|Nice to have"
    }
  ],

  "loan_safety_for_parents": {
    "loan_amount": "$X USD (₹Y lakhs approx)",
    "monthly_emi_after_graduation": "₹X per month (only after child starts earning)",
    "loan_is_safe_if": "The loan is safe as long as [plain condition]",
    "recommendation": "1 honest sentence recommendation for parents about the loan"
  },

  "reassurance_message": "2-3 sentences directly to parents. Warm, reassuring, honest. Acknowledge their concern. Like a trusted advisor speaking.",
  "when_to_be_worried": "If X happens, please seek additional advice. Do not panic about Y — it's normal.",
  "confidence_score": 0
}`;

class ParentModeService {
  async generateParentReport(
    userId,
    { language = "english", currency = "USD", includeHindi = false } = {},
  ) {
    const cacheKey = `parent_report:${userId}:${language}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const profile = await userIntelligenceService.getFullProfile(userId);
    if (!profile) throw new Error("Profile not found");

    const [careerRes, roiRes, loanRes, realityRes] = await Promise.all([
      query(
        "SELECT * FROM career_recommendations WHERE user_id = $1 AND is_active = TRUE ORDER BY rank LIMIT 1",
        [userId],
      ),
      query(
        "SELECT * FROM roi_analyses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        [userId],
      ),
      query(
        "SELECT * FROM loan_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        [userId],
      ),
      query(
        `SELECT output_data FROM ai_decision_log WHERE user_id = $1 AND decision_type = 'reality_check' ORDER BY created_at DESC LIMIT 1`,
        [userId],
      ),
    ]);

    const career = careerRes.rows[0];
    const roi = roiRes.rows[0];
    const loan = loanRes.rows[0];
    const reality = realityRes.rows[0]?.output_data;

    // Convert USD to INR (approx)
    const usdToInr = 83;

    const studentData = `
Student Name: ${profile.first_name || "Student"} ${profile.last_name || ""}
Study Plan: Wants to study ${profile.target_degree || "Master"} in ${(profile.target_countries || ["USA"]).join(" or ")}
Field: ${profile.major || "Technology"} → Career: ${career?.career_title || "Technology Professional"}
Duration: ~2 years

Financial Plan:
- Total Cost: $${roi?.total_cost_usd || 0} (₹${Math.round((roi?.total_cost_usd || 0) * usdToInr)} lakhs approx)
- Loan Amount: $${loan?.suggested_amount_usd || 0} (₹${Math.round((loan?.suggested_amount_usd || 0) * usdToInr)} approx)
- Loan Eligibility Score: ${loan?.eligibility_score || "N/A"}%
- Loan Risk: ${loan?.risk_category || "N/A"}
- Break-even Timeline: ${roi?.break_even_months || "N/A"} months after graduation

Career Outcome:
- Expected Entry Salary: $${career?.entry_salary_usd || 0} (₹${Math.round((career?.entry_salary_usd || 0) * usdToInr)} approx)
- 5-Year Salary: $${roi?.year5_salary_usd || 0}
- Job Market Growth: ${career?.yoy_growth_percent || 0}% per year
- ROI Score: ${roi?.roi_score || "N/A"}/100
- Risk Level: ${roi?.risk_category || "N/A"}
- Is it worth it: ${roi?.worth_it_flag ? "Yes" : "Borderline"}

Reality Check: ${reality ? JSON.stringify(reality).substring(0, 200) : "Not yet assessed"}
    `.trim();

    const familyData = `
Family Income: $${profile.annual_family_income || 0}/yr (${profile.family_income_bracket || "middle"} income)
Current Savings: $${profile.savings_available || 0}
Has Property: ${profile.has_property ? "Yes" : "No"}
Has Cosigner: ${profile.has_cosigner ? "Yes" : "No"}
Outstanding Debts: $${profile.outstanding_loans || 0}
Monthly Family Burden Estimate: $${Math.round((loan?.suggested_amount_usd || 0) / 120)} (during study period)
    `.trim();

    const result = await aiProvider.complete({
      systemPrompt: PARENT_MODE_PROMPT.replace("{STUDENT_DATA}", studentData)
        .replace("{FAMILY_DATA}", familyData)
        .replace(
          "{student_name}",
          `${profile.first_name || "Student"} ${profile.last_name || ""}`,
        ),
      messages: [{ role: "user", content: "Generate the parent report now." }],
      temperature: 0.3,
      maxTokens: 2500,
      jsonMode: true,
    });

    const parentReport = aiProvider.parseJSON(result.content);

    // Add currency conversions
    parentReport.currency_note = `1 USD ≈ ₹${usdToInr} (approximate, check current rate)`;
    parentReport.generated_for = `${profile.first_name || "Student"} ${profile.last_name || ""}`;
    parentReport.generated_at = new Date().toISOString();
    parentReport.disclaimer =
      "This report is AI-generated based on available data. Please consult a financial advisor for final decisions.";

    const finalResult = { parentReport };
    await cache.set(cacheKey, finalResult, 3600 * 6);
    return finalResult;
  }
}

module.exports = new ParentModeService();
