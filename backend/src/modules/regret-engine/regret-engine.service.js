// src/modules/regret-engine/regret-engine.service.js
// ⚡ REGRET MINIMIZATION ENGINE — "5 years later, will you regret this decision?"
// Psychological + Financial → Very unique, not done by competitors

const { query } = require("../../database/connection");
const { cache } = require("../../config/redis");
const aiProvider = require("../../config/ai-provider");
const userIntelligenceService = require("../user-intelligence/user-intelligence.service");
const logger = require("../../utils/logger");

const REGRET_ENGINE_PROMPT = `You are FutureFin's Regret Minimization Engine — inspired by Jeff Bezos's famous "Regret Minimization Framework."
Your job is to answer: "If this student is 80 years old looking back, will they regret this decision?"
Combine psychology, financial outcomes, life satisfaction, and career fulfillment into a regret score.

Be thoughtful, compassionate, and wise. Think like a life coach + financial planner.

STUDENT PROFILE:
{PROFILE_DATA}

DECISION BEING EVALUATED:
{DECISION_DATA}

Generate a comprehensive regret minimization analysis.
Respond ONLY with valid JSON:
{
  "regret_score": 0,
  "regret_level": "very low|low|moderate|high|very high",
  "regret_verdict": "Go for it — you'll regret NOT trying|Proceed with caution|Reconsider — high regret risk",
  "regret_summary": "2-3 sentences answering: Will they regret this decision in 5-10-30 years?",

  "life_dimensions": {
    "financial_regret": {
      "score": 0,
      "label": "Financial Regret Risk",
      "explanation": "Will the financial burden cause regret?",
      "years_of_financial_stress": 0,
      "regret_trigger": "What financial event would cause regret?"
    },
    "career_fulfillment": {
      "score": 0,
      "label": "Career Fulfillment Risk",
      "explanation": "Will this career path feel meaningful?",
      "fulfillment_probability": 0,
      "regret_trigger": "What career event would cause regret?"
    },
    "life_satisfaction": {
      "score": 0,
      "label": "Life Satisfaction",
      "explanation": "Will they feel good about this choice 10 years later?",
      "life_quality_score": 0,
      "regret_trigger": "What life event would cause regret?"
    },
    "opportunity_cost_regret": {
      "score": 0,
      "label": "Opportunity Cost Regret",
      "explanation": "Will they regret not taking a different path?",
      "alternative_paths_missed": ["path1", "path2"],
      "regret_trigger": "What missed opportunity would sting most?"
    },
    "social_regret": {
      "score": 0,
      "label": "Social & Family Impact",
      "explanation": "How will this decision affect relationships and social life?",
      "family_impact": "positive|neutral|stressful",
      "regret_trigger": "What social factor could cause regret?"
    }
  },

  "5_year_scenarios": [
    {
      "scenario": "Best case",
      "probability": 0,
      "life_at_5_years": "What does life look like?",
      "regret_score": 0,
      "stress_level": "low|medium|high",
      "satisfaction_score": 0
    },
    {
      "scenario": "Most likely case",
      "probability": 0,
      "life_at_5_years": "What does life look like?",
      "regret_score": 0,
      "stress_level": "low|medium|high",
      "satisfaction_score": 0
    },
    {
      "scenario": "Worst case",
      "probability": 0,
      "life_at_5_years": "What does life look like?",
      "regret_score": 0,
      "stress_level": "low|medium|high",
      "satisfaction_score": 0
    }
  ],

  "regret_minimization_actions": [
    {
      "action": "Specific action to minimize future regret",
      "why_it_helps": "How this reduces regret risk",
      "when_to_do": "Before enrollment|Year 1|After graduation"
    }
  ],

  "bezos_test": {
    "question": "At 80, will you regret NOT taking this path?",
    "answer": "yes|no|maybe",
    "explanation": "1-2 sentences of wisdom on this",
    "verdict": "The regret of NOT trying > The regret of trying and failing|The risks don't justify the attempt"
  },

  "stress_vs_reward_balance": {
    "years_of_high_stress": 0,
    "years_of_high_reward": 0,
    "balance_verdict": "Worth it|Borderline|Not worth it given the stress",
    "balance_explanation": "plain English"
  },

  "mentor_wisdom": "3-4 sentences of genuine life wisdom. Not financial advice — life advice. What would a wise elder tell this student?",
  "confidence_score": 0
}`;

class RegretEngineService {
  async analyzeRegret(
    userId,
    { decisionType, decisionDetails, universityRecommendationId } = {},
  ) {
    const cacheKey = `regret_analysis:${userId}:${decisionType}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const profile = await userIntelligenceService.getFullProfile(userId);
    if (!profile) throw new Error("Profile not found");

    const [careerRes, roiRes] = await Promise.all([
      query(
        "SELECT * FROM career_recommendations WHERE user_id = $1 AND is_active = TRUE ORDER BY rank LIMIT 1",
        [userId],
      ),
      query(
        "SELECT * FROM roi_analyses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        [userId],
      ),
    ]);

    const career = careerRes.rows[0];
    const roi = roiRes.rows[0];

    const profileData = `
Student: ${profile.first_name || "Student"} | Age: ~22 | From: ${profile.current_country || "India"}
Personality: ${profile.personality_type || "N/A"} | Risk Appetite: ${profile.risk_appetite || "moderate"}
Career Goals: ${profile.career_goals || "Technology/Business career"}
Motivation: ${profile.motivation_text || "Career growth and financial stability"}
Values & Interests: ${(profile.interests || []).join(", ") || "Technology, learning, growth"}
Family Situation: ${profile.family_income_bracket || "middle"} income family
Work Experience: ${profile.work_experience_months || 0} months
Career Personality: ${profile.career_personality_summary || "Analytical and ambitious"}
    `.trim();

    const decisionData = `
Decision Type: ${decisionType || "Pursuing Masters abroad"}
Decision Details: ${JSON.stringify(decisionDetails || {})}

Target Career: ${career ? career.career_title : "Not assessed"} | Salary Potential: $${career?.senior_salary_usd || 0}
Financial Investment: $${roi?.total_cost_usd || 0} | ROI Score: ${roi?.roi_score || "N/A"}
Risk Category: ${roi?.risk_category || "unknown"} | Worth It Flag: ${roi?.worth_it_flag || "unknown"}
Break-even: ${roi?.break_even_months || "N/A"} months
    `.trim();

    const result = await aiProvider.complete({
      systemPrompt: REGRET_ENGINE_PROMPT.replace(
        "{PROFILE_DATA}",
        profileData,
      ).replace("{DECISION_DATA}", decisionData),
      messages: [
        {
          role: "user",
          content: "Analyze the regret minimization score for this decision.",
        },
      ],
      temperature: 0.4,
      maxTokens: 2500,
      jsonMode: true,
    });

    const regretAnalysis = aiProvider.parseJSON(result.content);

    const finalResult = {
      regretAnalysis,
      decisionType,
      generatedAt: new Date().toISOString(),
    };

    await cache.set(cacheKey, finalResult, 3600 * 6);
    return finalResult;
  }
}

module.exports = new RegretEngineService();
