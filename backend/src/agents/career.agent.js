// src/agents/career.agent.js
// CAREER AGENT — Evaluates career fit, trajectory, and market demand
const aiProvider = require('../config/ai-provider');
const logger = require('../utils/logger');
const { redactProfile } = require('../utils/piiRedactor');

const CAREER_AGENT_PROMPT = `You are the CAREER INTELLIGENCE AGENT in a multi-agent AI system.
Your ONLY job: evaluate career fit and future trajectory for this student.

STUDENT PROFILE:
{PROFILE}

AVAILABLE CAREER DATA:
{CAREER_DATA}

Think deeply. Evaluate:
1. Skill-to-market match (0-100)
2. Career growth trajectory over 5 years
3. Salary realism (based on actual market data knowledge)
4. Automation risk over 10 years
5. Career market saturation risk

Respond ONLY with valid JSON:
{
  "agent": "career",
  "career_fit_score": 0,
  "top_career": "",
  "top_career_entry_salary_usd": 0,
  "top_career_5yr_salary_usd": 0,
  "salary_growth_curve": [
    {"year": 1, "salary_usd": 0, "milestone": "Entry level"},
    {"year": 2, "salary_usd": 0, "milestone": "Promotion"},
    {"year": 3, "salary_usd": 0, "milestone": "Mid level"},
    {"year": 5, "salary_usd": 0, "milestone": "Senior"},
    {"year": 7, "salary_usd": 0, "milestone": "Lead/Principal"},
    {"year": 10, "salary_usd": 0, "milestone": "Peak/Management"}
  ],
  "market_demand": "high|medium|low",
  "market_demand_score": 0,
  "automation_risk_score": 0,
  "automation_risk_level": "low|medium|high",
  "job_market_saturation": "undersupplied|balanced|oversupplied",
  "global_openings_estimate": 0,
  "yoy_growth_percent": 0,
  "skill_match_percent": 0,
  "top_skill_gaps": [],
  "time_to_first_job_months": 0,
  "job_offer_probability_12mo": 0,
  "reasoning": "2-3 sentences of agent reasoning",
  "confidence": 0,
  "flags": []
}`;

class CareerAgent {
  async evaluate(profile, careerData) {
    try {
      const profileStr = this._buildProfileStr(profile);
      const careerStr = careerData
        ? JSON.stringify(careerData, null, 2).substring(0, 1500)
        : 'No prior career analysis available — use profile to infer';

      const result = await aiProvider.complete({
        systemPrompt: CAREER_AGENT_PROMPT
          .replace('{PROFILE}', profileStr)
          .replace('{CAREER_DATA}', careerStr),
        messages: [{ role: 'user', content: 'Run career evaluation for this student.' }],
        temperature: 0.3,
        maxTokens: 1800,
        jsonMode: true,
      });

      const parsed = aiProvider.parseJSON(result.content);
      logger.debug('CareerAgent completed', { career: parsed.top_career, fit: parsed.career_fit_score });
      return { ...parsed, agent: 'career' };
    } catch (err) {
      logger.error('CareerAgent error:', err.message);
      return this._fallback(profile, careerData);
    }
  }

  _buildProfileStr(profile) {
    return `
Education: ${profile.highest_education || 'Bachelor'} in ${profile.major || profile.field_of_study || 'CS'}, GPA: ${profile.gpa || profile.current_gpa || 3.5}
Technical Skills: ${(profile.technical_skills || []).join(', ') || 'Not specified'}
Work Experience: ${profile.work_experience_months || 0} months
Target Countries: ${(profile.target_countries || profile.preferred_countries || []).join(', ') || 'Global'}
Career Interests: ${(profile.interests || []).join(', ') || 'Technology'}
Risk Appetite: ${profile.risk_appetite || 'moderate'}
    `.trim();
  }

  _fallback(profile, careerData) {
    // Deterministic math-based fallback when AI is unavailable
    const gpa = parseFloat(profile.gpa || profile.current_gpa || 3.5);
    const expMonths = parseInt(profile.work_experience_months || 0);
    const skillCount = (profile.technical_skills || []).length;

    const fitScore = Math.round(Math.min(95, (gpa / 4.0) * 40 + Math.min(expMonths / 6, 20) + skillCount * 3 + 20));
    const entrySalary = Math.round(75000 + fitScore * 500 + expMonths * 200);
    const growthRate = 0.08 + (gpa - 3.0) * 0.02;

    return {
      agent: 'career',
      career_fit_score: fitScore,
      top_career: careerData?.careers?.[0]?.career_title || 'Software Engineer',
      top_career_entry_salary_usd: entrySalary,
      top_career_5yr_salary_usd: Math.round(entrySalary * Math.pow(1 + growthRate, 5)),
      salary_growth_curve: [1, 2, 3, 5, 7, 10].map(yr => ({
        year: yr,
        salary_usd: Math.round(entrySalary * Math.pow(1 + growthRate, yr)),
        milestone: ['Entry level', 'Promotion', 'Mid level', 'Senior', 'Lead', 'Peak'][yr > 5 ? 5 : yr - 1]
      })),
      market_demand: fitScore > 75 ? 'high' : fitScore > 55 ? 'medium' : 'low',
      market_demand_score: Math.round(fitScore * 0.9),
      automation_risk_score: 25,
      automation_risk_level: 'low',
      job_market_saturation: 'balanced',
      global_openings_estimate: 120000,
      yoy_growth_percent: 18,
      skill_match_percent: fitScore,
      top_skill_gaps: [],
      time_to_first_job_months: Math.max(2, 8 - Math.floor(expMonths / 6)),
      job_offer_probability_12mo: Math.min(95, fitScore + 5),
      reasoning: 'Fallback evaluation based on academic profile and experience metrics.',
      confidence: 55,
      flags: ['ai_unavailable_fallback_used'],
    };
  }
}

module.exports = new CareerAgent();
