// src/modules/reality-check/reality-check.service.js
// ⚡ REALITY CHECK SCORE ENGINE — Honest AI, Not Just Optimistic AI
// Tells students: "Your dream has only 32% success probability" — trustworthy + credible

const { query } = require("../../database/connection");
const { cache } = require("../../config/redis");
const aiProvider = require("../../config/ai-provider");
const userIntelligenceService = require("../user-intelligence/user-intelligence.service");
const logger = require("../../utils/logger");

const REALITY_CHECK_PROMPT = `You are FutureFin's Reality Check Engine — an honest, empathetic analyst.
Your job is NOT to be optimistic. Your job is to be ACCURATE and TRUSTWORTHY.
You tell students the truth — even if it's uncomfortable — while being compassionate.

STUDENT PROFILE:
{PROFILE_DATA}

TARGET PLAN:
{TARGET_PLAN}

Generate a comprehensive Reality Check Score. Be brutally honest but constructive.
Think like a trusted senior who truly wants this student to succeed.

Respond ONLY with valid JSON:
{
  "overall_success_probability": 0,
  "overall_risk_level": "low|medium|high|critical",
  "reality_verdict": "🟢 Promising|🟡 Risky|🔴 Highly Risky|⚠️ Reconsider",
  "verdict_explanation": "2-3 honest sentences about overall feasibility",

  "dimension_scores": {
    "academic_fit": {
      "score": 0,
      "label": "Academic Readiness",
      "status": "strong|adequate|weak|critical",
      "insight": "honest 1-sentence insight"
    },
    "financial_feasibility": {
      "score": 0,
      "label": "Financial Feasibility",
      "status": "strong|adequate|weak|critical",
      "insight": "honest 1-sentence insight"
    },
    "career_market_demand": {
      "score": 0,
      "label": "Career Market Demand",
      "status": "strong|adequate|weak|critical",
      "insight": "honest 1-sentence insight"
    },
    "loan_repayment_safety": {
      "score": 0,
      "label": "Loan Repayment Safety",
      "status": "strong|adequate|weak|critical",
      "insight": "honest 1-sentence insight"
    },
    "plan_realism": {
      "score": 0,
      "label": "Plan Realism",
      "status": "strong|adequate|weak|critical",
      "insight": "honest 1-sentence insight"
    }
  },

  "red_flags": [
    {
      "flag": "flag description",
      "severity": "warning|serious|critical",
      "what_it_means": "plain English explanation"
    }
  ],

  "green_lights": [
    {
      "factor": "positive factor",
      "why_it_helps": "plain English"
    }
  ],

  "loan_burden_analysis": {
    "loan_to_income_ratio": 0.0,
    "is_safe_threshold": true,
    "safe_threshold_explanation": "Ideal EMI should be <25% of monthly salary. Yours is X%",
    "emi_stress_level": "comfortable|manageable|stressful|dangerous"
  },

  "probability_breakdown": {
    "get_admission": 0,
    "get_scholarship": 0,
    "graduate_on_time": 0,
    "get_job_in_6months": 0,
    "repay_loan_safely": 0,
    "achieve_career_goal": 0
  },

  "honest_mentor_message": "3-4 sentences. Real talk. Honest but not cruel. Like a trusted elder sibling who's been through this.",
  "top_3_actions": ["actionable step 1", "actionable step 2", "actionable step 3"],
  "confidence_score": 0
}`;

class RealityCheckService {
  async generateRealityCheck(
    userId,
    { universityRecommendationId, loanAmount, targetCountry } = {},
  ) {
    const cacheKey = `reality_check:${userId}:${universityRecommendationId || "general"}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const profile = await userIntelligenceService.getFullProfile(userId);
    if (!profile) throw new Error("Profile not found");

    const profileData = `
Student: ${profile.first_name || "Student"} | From: ${profile.current_country || "India"}
Education: ${profile.highest_education || "Bachelor"} | GPA: ${profile.gpa || "N/A"} | Major: ${profile.major || "N/A"}
Test Scores: ${JSON.stringify(profile.standardized_scores || {})}
Work Experience: ${profile.work_experience_months || 0} months
Family Income: $${profile.annual_family_income || 0}/yr (${profile.family_income_bracket || "middle"} bracket)
Savings: $${profile.savings_available || 0} | Has Cosigner: ${profile.has_cosigner ? "Yes" : "No"}
Risk Appetite: ${profile.risk_appetite || "moderate"}
Profile Completeness: ${profile.profile_completeness || 0}%
    `.trim();

    let targetPlan = `Target Country: ${targetCountry || (profile.target_countries || ["USA"])[0]}`;

    if (universityRecommendationId) {
      const uniRes = await query(
        `SELECT ur.*, u.name, u.country, u.avg_tuition_usd, u.avg_placement_rate, u.avg_starting_salary_usd
         FROM university_recommendations ur JOIN universities u ON u.id = ur.university_id
         WHERE ur.id = $1 AND ur.user_id = $2`,
        [universityRecommendationId, userId],
      );
      if (uniRes.rows.length) {
        const u = uniRes.rows[0];
        targetPlan += `\nUniversity: ${u.name}, ${u.country}
Tuition/yr: $${u.avg_tuition_usd} | Placement Rate: ${u.avg_placement_rate}%
Average Starting Salary: $${u.avg_starting_salary_usd}
Loan Requested: $${loanAmount || 0}`;
      }
    }

    const careerRes = await query(
      "SELECT * FROM career_recommendations WHERE user_id = $1 AND is_active = TRUE ORDER BY rank LIMIT 1",
      [userId],
    );
    if (careerRes.rows.length) {
      const c = careerRes.rows[0];
      targetPlan += `\nTarget Career: ${c.career_title} | Entry Salary: $${c.entry_salary_usd} | Job Market: ${c.yoy_growth_percent || 0}% YoY growth`;
    }

    const result = await aiProvider.complete({
      systemPrompt: REALITY_CHECK_PROMPT.replace(
        "{PROFILE_DATA}",
        profileData,
      ).replace("{TARGET_PLAN}", targetPlan),
      messages: [
        { role: "user", content: "Generate the Reality Check Score now." },
      ],
      temperature: 0.2,
      maxTokens: 2000,
      jsonMode: true,
    });

    const realityCheck = aiProvider.parseJSON(result.content);

    // Log this decision
    await query(
      `INSERT INTO ai_decision_log (user_id, decision_type, input_data, output_data, confidence_score, model_used)
       VALUES ($1, 'reality_check', $2, $3, $4, 'reality_check_engine')`,
      [
        userId,
        JSON.stringify({ universityRecommendationId, loanAmount }),
        JSON.stringify(realityCheck),
        realityCheck.confidence_score,
      ],
    ).catch((e) =>
      logger.warn("Could not log reality check decision:", e.message),
    );

    const finalResult = { realityCheck, generatedAt: new Date().toISOString() };
    await cache.set(cacheKey, finalResult, 3600 * 4);
    return finalResult;
  }
}

module.exports = new RealityCheckService();
