// src/modules/career/career.service.js
const { query } = require('../../database/connection');
const { cache } = require('../../config/redis');
const aiProvider = require('../../config/ai-provider');
const userIntelligenceService = require('../user-intelligence/user-intelligence.service');
const logger = require('../../utils/logger');

const CAREER_RECOMMENDATION_PROMPT = `You are an expert career counselor, labor economist, and AI career strategist.

Based on this student profile, recommend the top 3 career paths. Use real market data knowledge up to your training cutoff.

STUDENT PROFILE:
{PROFILE_SUMMARY}

INSTRUCTIONS:
- Consider market demand, salary potential, skill match, and student personality
- Be specific and realistic - no vague recommendations
- Include skill gap analysis based on what student currently has vs what's needed
- Provide concrete salary data in USD

Respond ONLY with valid JSON (no markdown):
{
  "careers": [
    {
      "rank": 1,
      "career_title": "e.g., Machine Learning Engineer",
      "career_field": "e.g., Artificial Intelligence",
      "probability_score": 85,
      "market_demand_score": 90,
      "salary_potential_score": 88,
      "skill_match_score": 72,
      "overall_score": 84,
      "entry_salary_usd": 95000,
      "mid_salary_usd": 145000,
      "senior_salary_usd": 220000,
      "salary_growth_rate_annual": 8.5,
      "time_to_achieve_months": 18,
      "key_milestones": [
        {"month": 6, "milestone": "Complete ML specialization + 2 projects"},
        {"month": 12, "milestone": "Land junior ML role"},
        {"month": 18, "milestone": "Full ML Engineer position"}
      ],
      "required_skills": ["Python", "TensorFlow/PyTorch", "Statistics", "MLOps", "SQL"],
      "skill_gaps": ["MLOps", "Distributed computing", "Production ML systems"],
      "recommended_certifications": ["Google ML Engineer", "AWS ML Specialty"],
      "global_job_openings": 85000,
      "yoy_growth_percent": 22.0,
      "top_hiring_companies": ["Google", "Meta", "Amazon", "OpenAI", "Anthropic"],
      "top_hiring_locations": ["San Francisco", "New York", "London", "Singapore"],
      "automation_risk": "low",
      "confidence_score": 82,
      "reasoning": "Given your strong CS background and interest in AI, and with Python skills...",
      "key_influencing_factors": ["CS degree", "Python proficiency", "Research interest in AI"]
    }
  ],
  "overall_confidence": 80,
  "recommendation_summary": "Brief 2-sentence summary of why these careers suit this student"
}`;

const MULTI_AGENT_SYNTHESIS_PROMPT = `You are the SYNTHESIS AGENT coordinating inputs from Career, Finance, and Risk agents.

CAREER AGENT OUTPUT: {CAREER_DATA}
FINANCE AGENT CONTEXT: {FINANCE_DATA}
RISK AGENT ASSESSMENT: {RISK_DATA}

Provide final synthesized career recommendations adjusting for financial feasibility and risk tolerance.
Respond in the same JSON format as the career recommendations, but with adjustments and a synthesis_note field.`;

class CareerService {
  async getRecommendations(userId, forceRefresh = false) {
    const cacheKey = `career_recs:${userId}`;
    if (!forceRefresh) {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    }

    const profile = await userIntelligenceService.getFullProfile(userId);
    if (!profile) throw new Error('Student profile not found');

    if ((profile.profile_completeness || 0) < 20) {
      throw new Error('Please complete at least 20% of your profile first');
    }

    const profileSummary = this._buildCareerProfileSummary(profile);

    // Career Agent
    const careerResult = await aiProvider.complete({
      systemPrompt: CAREER_RECOMMENDATION_PROMPT.replace('{PROFILE_SUMMARY}', profileSummary),
      messages: [{ role: 'user', content: 'Generate career recommendations for this student profile.' }],
      temperature: 0.4,
      maxTokens: 2500,
      jsonMode: true,
    });

    const careerData = aiProvider.parseJSON(careerResult.content);

    // Finance context for multi-agent
    const financeContext = {
      annual_family_income: profile.annual_family_income,
      income_bracket: profile.family_income_bracket,
      budget_max: profile.budget_max,
      risk_appetite: profile.risk_appetite,
    };

    // Risk Agent assessment
    const riskContext = {
      outstanding_loans: profile.outstanding_loans,
      has_cosigner: profile.has_cosigner,
      risk_appetite: profile.risk_appetite,
    };

    // Multi-agent synthesis (simplified for efficiency)
    const finalCareerData = await this._synthesize(careerData, financeContext, riskContext);

    // Persist recommendations
    const saved = await this._saveRecommendations(userId, finalCareerData.careers, careerResult.model);

    const result = {
      careers: saved,
      summary: finalCareerData.recommendation_summary,
      overallConfidence: finalCareerData.overall_confidence,
      aiModel: careerResult.model,
      generatedAt: new Date().toISOString(),
    };

    await cache.set(cacheKey, result, 3600 * 12); // Cache 12 hours
    return result;
  }

  async _synthesize(careerData, financeContext, riskContext) {
    // Simple synthesis: adjust scores based on financial context
    // In production this would be a full multi-agent call
    const adjustedCareers = careerData.careers.map(career => {
      let adjustment = 0;
      if (riskContext.risk_appetite === 'conservative' && career.automation_risk === 'high') {
        adjustment -= 10;
      }
      if (financeContext.income_bracket === 'low' && career.entry_salary_usd > 80000) {
        adjustment += 5; // High salary more important for low income
      }
      return {
        ...career,
        overall_score: Math.min(100, Math.max(0, career.overall_score + adjustment)),
      };
    });

    return {
      ...careerData,
      careers: adjustedCareers.sort((a, b) => b.overall_score - a.overall_score)
        .map((c, i) => ({ ...c, rank: i + 1 })),
    };
  }

  async _saveRecommendations(userId, careers, modelUsed) {
    // Delete old recommendations
    await query('UPDATE career_recommendations SET is_active = FALSE WHERE user_id = $1', [userId]);

    const saved = [];
    for (const career of careers) {
      const result = await query(
        `INSERT INTO career_recommendations (
          user_id, career_title, career_field, rank,
          probability_score, market_demand_score, salary_potential_score, skill_match_score, overall_score,
          entry_salary_usd, mid_salary_usd, senior_salary_usd, salary_growth_rate_annual,
          time_to_achieve_months, key_milestones, required_skills, skill_gaps, recommended_certifications,
          global_job_openings, yoy_growth_percent, top_hiring_companies, top_hiring_locations,
          automation_risk, confidence_score, reasoning, key_influencing_factors
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
        RETURNING *`,
        [
          userId, career.career_title, career.career_field, career.rank,
          career.probability_score, career.market_demand_score, career.salary_potential_score,
          career.skill_match_score, career.overall_score,
          career.entry_salary_usd, career.mid_salary_usd, career.senior_salary_usd,
          career.salary_growth_rate_annual, career.time_to_achieve_months,
          JSON.stringify(career.key_milestones || []),
          career.required_skills, career.skill_gaps, career.recommended_certifications,
          career.global_job_openings, career.yoy_growth_percent,
          career.top_hiring_companies, career.top_hiring_locations,
          career.automation_risk, career.confidence_score, career.reasoning,
          JSON.stringify(career.key_influencing_factors || []),
        ]
      );
      saved.push(result.rows[0]);
    }

    // Log decision
    await query(
      `INSERT INTO ai_decision_log (user_id, decision_type, model_used, confidence_score, reasoning)
       VALUES ($1, 'career_rec', $2, $3, $4)`,
      [userId, modelUsed, careers[0]?.confidence_score, careers[0]?.reasoning?.substring(0, 500)]
    );

    return saved;
  }

  async getSkillGapAnalysis(userId, careerId) {
    const career = await query(
      'SELECT * FROM career_recommendations WHERE id = $1 AND user_id = $2',
      [careerId, userId]
    );
    if (!career.rows.length) throw new Error('Career recommendation not found');

    const profile = await userIntelligenceService.getFullProfile(userId);
    const careerData = career.rows[0];

    const currentSkills = [
      ...(profile.technical_skills || []),
      ...(profile.soft_skills || []),
      ...(profile.certifications || []),
    ];

    const gaps = (careerData.skill_gaps || []).filter(gap =>
      !currentSkills.some(s => s.toLowerCase().includes(gap.toLowerCase()))
    );

    const analysis = await aiProvider.complete({
      messages: [{
        role: 'user',
        content: `Create a learning plan for this skill gap:
Current Skills: ${currentSkills.join(', ')}
Target Career: ${careerData.career_title}
Skill Gaps: ${gaps.join(', ')}
Respond with JSON: {"learning_plan": [{"skill": "", "resources": [], "estimated_weeks": 0, "priority": "high|medium|low"}], "total_weeks": 0}`
      }],
      temperature: 0.4,
      maxTokens: 1500,
      jsonMode: true,
    });

    return {
      career: careerData.career_title,
      currentSkills,
      skillGaps: gaps,
      learningPlan: aiProvider.parseJSON(analysis.content),
    };
  }

  _buildCareerProfileSummary(profile) {
    return `
Name: ${profile.first_name} ${profile.last_name}
Education: ${profile.highest_education || 'Not specified'} in ${profile.major || 'Unknown field'}, GPA: ${profile.gpa || 'N/A'}
Test Scores: ${JSON.stringify(profile.standardized_scores || {})}
Technical Skills: ${(profile.technical_skills || []).join(', ') || 'None specified'}
Soft Skills: ${(profile.soft_skills || []).join(', ') || 'None specified'}
Work Experience: ${profile.work_experience_months || 0} months - ${profile.work_experience_summary || 'No description'}
Interests: ${(profile.interests || []).join(', ') || 'None specified'}
Research: ${profile.research_experience || 'None'}
Certifications: ${(profile.certifications || []).join(', ') || 'None'}
Personality Type: ${profile.personality_type || 'Not analyzed yet'}
Risk Appetite: ${profile.risk_appetite || 'Unknown'}
Hidden Strengths: ${(profile.hidden_strengths || []).join(', ') || 'Not analyzed'}
Career Goals: ${profile.career_goals || 'Not specified'}
Target Countries: ${(profile.target_countries || []).join(', ') || 'Global'}
Budget Range: $${profile.budget_min || 0} - $${profile.budget_max || 'Open'}
Family Income Bracket: ${profile.family_income_bracket || 'Unknown'}
    `.trim();
  }
}

module.exports = new CareerService();
