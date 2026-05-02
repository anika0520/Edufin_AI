// src/modules/dropout-risk/dropout-risk.service.js
// ⚡ DROPOUT RISK + FAILURE PREDICTION ENGINE
// Banks LOVE this → Predicts: dropout chance, semester failure, job market failure

const { query } = require("../../database/connection");
const { cache } = require("../../config/redis");
const aiProvider = require("../../config/ai-provider");
const userIntelligenceService = require("../user-intelligence/user-intelligence.service");
const logger = require("../../utils/logger");

const DROPOUT_RISK_PROMPT = `You are FutureFin's Academic & Career Risk Prediction Engine.
Your predictions help banks make smarter lending decisions and help students avoid failure.
Be data-driven, realistic, and honest. This is NOT about being harsh — it's about helping students succeed.

STUDENT PROFILE:
{PROFILE_DATA}

ACADEMIC & FINANCIAL CONTEXT:
{CONTEXT_DATA}

EARLY WARNING SIGNALS TO ANALYZE:
- Academic readiness gaps
- Financial stress indicators
- Motivation and engagement signals
- External pressure factors (family, cultural, economic)
- Historical performance patterns

Generate a comprehensive failure prediction and early warning system.
Respond ONLY with valid JSON:
{
  "overall_risk_score": 0,
  "overall_risk_category": "low|medium|high|critical",
  "risk_summary": "2-sentence honest summary of the student's overall risk profile",

  "dropout_prediction": {
    "dropout_probability": 0,
    "primary_dropout_reasons": ["reason1", "reason2"],
    "dropout_timeline_risk": "first semester|second year|final year|low risk",
    "warning_signs": ["sign1", "sign2"],
    "protective_factors": ["factor1", "factor2"],
    "dropout_prevention_actions": ["action1", "action2", "action3"]
  },

  "academic_failure_prediction": {
    "semester_failure_probability": 0,
    "gpa_at_risk": false,
    "subjects_at_risk": ["subject area 1"],
    "academic_support_needed": ["support type 1", "support type 2"],
    "recovery_difficulty": "easy|moderate|hard|very hard"
  },

  "employment_failure_prediction": {
    "job_search_success_probability": 0,
    "expected_job_search_duration_months": 0,
    "risk_of_underemployment": 0,
    "risk_of_career_mismatch": 0,
    "factors_affecting_employability": ["factor1", "factor2"],
    "employment_boosters": ["booster1", "booster2"]
  },

  "loan_default_prediction": {
    "default_probability_3yr": 0,
    "default_probability_5yr": 0,
    "default_risk_factors": ["factor1", "factor2"],
    "safe_loan_amount_recommendation": 0,
    "repayment_confidence_score": 0
  },

  "early_warning_system": {
    "red_alerts": [
      {
        "alert": "Alert title",
        "severity": "critical|high|medium",
        "description": "What this means",
        "action_required": "What to do NOW"
      }
    ],
    "yellow_warnings": [
      {
        "warning": "Warning title",
        "description": "What to watch for"
      }
    ]
  },

  "bank_risk_assessment": {
    "lending_risk_score": 0,
    "recommended_max_loan_usd": 0,
    "suggested_conditions": ["condition1", "condition2"],
    "monitoring_frequency": "monthly|quarterly|annually",
    "special_provisions_recommended": ["provision1"]
  },

  "intervention_plan": [
    {
      "timeframe": "Before enrollment|Month 1-3|Month 6|Year 2",
      "intervention": "Specific intervention",
      "expected_risk_reduction": "X% reduction in dropout risk"
    }
  ],

  "mentor_message": "Warm, honest 2-3 sentence message acknowledging the risks while empowering the student. Not scary — empowering.",
  "confidence_score": 0
}`;

class DropoutRiskService {
  async predictRisk(userId, { universityRecommendationId, loanAmount } = {}) {
    const cacheKey = `dropout_risk:${userId}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const profile = await userIntelligenceService.getFullProfile(userId);
    if (!profile) throw new Error("Profile not found");

    const [careerRes, roiRes, loanRes, behaviorRes] = await Promise.all([
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
      query("SELECT * FROM behavioral_scores WHERE user_id = $1", [userId]),
    ]);

    const career = careerRes.rows[0];
    const roi = roiRes.rows[0];
    const loan = loanRes.rows[0];
    const behavior = behaviorRes.rows[0];

    const profileData = `
Student: ${profile.first_name || "Student"} | From: ${profile.current_country || "India"}
GPA: ${profile.gpa || "N/A"} on ${profile.gpa_scale || 4.0} scale | Major: ${profile.major || "N/A"}
Highest Education: ${profile.highest_education || "bachelor"}
Work Experience: ${profile.work_experience_months || 0} months
Research Experience: ${profile.research_experience ? "Yes" : "No"} | Publications: ${profile.publications || 0}
Skills: ${(profile.technical_skills || []).slice(0, 5).join(", ")}
Risk Appetite: ${profile.risk_appetite || "moderate"} | Personality: ${profile.personality_type || "N/A"}
Career Goals: ${profile.career_goals || "Not specified"} | Motivation: ${profile.motivation_text || "Not specified"}
Languages: ${JSON.stringify(profile.languages || [])}
    `.trim();

    const contextData = `
Family Income: ${profile.family_income_bracket || "middle"} bracket ($${profile.annual_family_income || 0}/yr)
Savings: $${profile.savings_available || 0} | Has Cosigner: ${profile.has_cosigner ? "Yes" : "No"}
Outstanding Loans: $${profile.outstanding_loans || 0}
Loan Requested: $${loanAmount || loan?.suggested_amount_usd || "N/A"}

Career Match: ${career ? `${career.career_title} (${career.probability_score}% match, ${career.skill_match_score}% skill match)` : "Not assessed"}
Skill Gaps: ${career ? (career.skill_gaps || []).join(", ") : "Not assessed"}

ROI Analysis: ${roi ? `Score: ${roi.roi_score}, Risk: ${roi.risk_category}, Break-even: ${roi.break_even_months} months` : "Not calculated"}

Engagement Score: ${behavior?.engagement_score || "N/A"} | Platform Usage: ${behavior?.funnel_stage || "exploring"}
    `.trim();

    const result = await aiProvider.complete({
      systemPrompt: DROPOUT_RISK_PROMPT.replace(
        "{PROFILE_DATA}",
        profileData,
      ).replace("{CONTEXT_DATA}", contextData),
      messages: [
        {
          role: "user",
          content: "Generate the dropout and failure risk prediction.",
        },
      ],
      temperature: 0.2,
      maxTokens: 2500,
      jsonMode: true,
    });

    const riskReport = aiProvider.parseJSON(result.content);

    const finalResult = {
      riskReport,
      userId,
      generatedAt: new Date().toISOString(),
      disclaimer:
        "This is a probabilistic prediction based on historical data patterns. It is NOT deterministic. Students who are aware of their risks can take action and succeed.",
    };

    await cache.set(cacheKey, finalResult, 3600 * 6);

    // Log for bank/lender insight
    await query(
      `INSERT INTO ai_decision_log (user_id, decision_type, input_data, output_data, confidence_score, model_used)
       VALUES ($1, 'dropout_risk_prediction', $2, $3, $4, 'dropout_risk_engine')`,
      [
        userId,
        JSON.stringify({ universityRecommendationId, loanAmount }),
        JSON.stringify(riskReport),
        riskReport.confidence_score,
      ],
    ).catch((e) =>
      logger.warn("Could not log dropout risk decision:", e.message),
    );

    return finalResult;
  }
}

module.exports = new DropoutRiskService();
