// src/modules/university/university.service.js
const { query } = require('../../database/connection');
const { cache } = require('../../config/redis');
const aiProvider = require('../../config/ai-provider');
const userIntelligenceService = require('../user-intelligence/user-intelligence.service');
const logger = require('../../utils/logger');

const UNIVERSITY_MATCH_PROMPT = `You are an expert university counselor with knowledge of global universities and admissions.

STUDENT PROFILE:
{PROFILE_DATA}

CAREER GOAL:
{CAREER_DATA}

CANDIDATE UNIVERSITIES (from database):
{UNIVERSITY_LIST}

For each university, calculate:
1. Admit probability based on GPA, test scores, and acceptance rate
2. Expected ROI fit based on career goals and university outcomes
3. Financial fit based on budget and scholarship availability
4. Overall recommendation category (reach/match/safety)

Respond with ONLY valid JSON:
{
  "recommendations": [
    {
      "university_id": "uuid-here",
      "rank": 1,
      "category": "reach|match|safety",
      "admit_probability": 0,
      "expected_roi_score": 0,
      "fit_score": 0,
      "total_cost_usd": 0,
      "expected_scholarship_usd": 0,
      "net_cost_usd": 0,
      "expected_starting_salary_usd": 0,
      "break_even_months": 0,
      "confidence_score": 0,
      "reasoning": "why this university fits",
      "pros": ["pro1", "pro2", "pro3"],
      "cons": ["con1", "con2"],
      "key_factors": [{"factor": "name", "impact": "positive|negative", "description": ""}]
    }
  ],
  "recommendation_summary": "Overall strategic advice",
  "confidence_score": 0
}`;

class UniversityService {
  async getRecommendations(userId, forceRefresh = false) {
    const cacheKey = `uni_recs:${userId}`;
    if (!forceRefresh) {
      const cached = await cache.get(cacheKey);
      if (cached) return cached;
    }

    const profile = await userIntelligenceService.getFullProfile(userId);
    if (!profile) throw new Error('Profile not found');

    if ((profile.profile_completeness || 0) < 30) {
      throw new Error('Please complete at least 30% of your profile first');
    }

    // Fetch universities from DB that match budget & target countries
    const universities = await this._fetchCandidateUniversities(profile);

    if (!universities.length) {
      throw new Error('No universities found matching your criteria. Please broaden your search.');
    }

    // Career context
    const careerRec = await query(
      'SELECT * FROM career_recommendations WHERE user_id = $1 AND is_active = TRUE ORDER BY rank LIMIT 1',
      [userId]
    );

    const profileData = this._buildMatchProfile(profile);
    const careerData = careerRec.rows[0]
      ? `Target Career: ${careerRec.rows[0].career_title}\nRequired Skills: ${(careerRec.rows[0].required_skills || []).join(', ')}`
      : 'No specific career target';

    const uniList = universities.map(u => ({
      id: u.id,
      name: u.name,
      country: u.country,
      city: u.city,
      qs_ranking: u.qs_ranking,
      avg_tuition_usd: u.avg_tuition_usd,
      avg_living_cost_usd_monthly: u.avg_living_cost_usd_monthly,
      acceptance_rate: u.acceptance_rate,
      avg_placement_rate: u.avg_placement_rate,
      avg_starting_salary_usd: u.avg_starting_salary_usd,
      avg_scholarship_percent: u.avg_scholarship_percent,
      min_gpa: u.min_gpa,
      programs: u.available_fields,
    }));

    const result = await aiProvider.complete({
      systemPrompt: UNIVERSITY_MATCH_PROMPT
        .replace('{PROFILE_DATA}', profileData)
        .replace('{CAREER_DATA}', careerData)
        .replace('{UNIVERSITY_LIST}', JSON.stringify(uniList, null, 2)),
      messages: [{ role: 'user', content: 'Generate university recommendations for this student.' }],
      temperature: 0.3,
      maxTokens: 2500,
      jsonMode: true,
    });

    const recData = aiProvider.parseJSON(result.content);

    // Save recommendations
    await query('UPDATE university_recommendations SET is_active = FALSE WHERE user_id = $1', [userId]);

    const saved = [];
    for (const rec of recData.recommendations || []) {
      const uniExists = universities.find(u => u.id === rec.university_id);
      if (!uniExists) continue;

      const dbResult = await query(
        `INSERT INTO university_recommendations (
          user_id, university_id, rank, category,
          admit_probability, expected_roi_score, fit_score,
          total_cost_usd, expected_scholarship_usd, net_cost_usd,
          expected_starting_salary_usd, break_even_months,
          confidence_score, reasoning, pros, cons, key_factors
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING *`,
        [
          userId, rec.university_id, rec.rank, rec.category,
          rec.admit_probability, rec.expected_roi_score, rec.fit_score,
          rec.total_cost_usd, rec.expected_scholarship_usd, rec.net_cost_usd,
          rec.expected_starting_salary_usd, rec.break_even_months,
          rec.confidence_score, rec.reasoning, rec.pros, rec.cons,
          JSON.stringify(rec.key_factors || []),
        ]
      );
      saved.push({ ...dbResult.rows[0], university: uniExists });
    }

    const response = {
      recommendations: saved,
      summary: recData.recommendation_summary,
      confidence: recData.confidence_score,
      generatedAt: new Date().toISOString(),
    };

    await cache.set(cacheKey, response, 3600 * 12);
    return response;
  }

  async _fetchCandidateUniversities(profile) {
    const maxBudgetPerYear = profile.budget_max ? profile.budget_max / 2 : 60000;
    const targetCountries = profile.target_countries?.length ? profile.target_countries : null;
    const targetFields = profile.target_fields?.length ? profile.target_fields : null;

    let queryStr = `
      SELECT * FROM universities
      WHERE avg_tuition_usd <= $1
      AND (min_gpa IS NULL OR min_gpa <= $2 + 0.3)
    `;
    const params = [maxBudgetPerYear, profile.gpa || 4.0];

    if (targetCountries?.length) {
      params.push(targetCountries);
      queryStr += ` AND country = ANY($${params.length})`;
    }

    queryStr += ` ORDER BY qs_ranking NULLS LAST LIMIT 20`;

    const result = await query(queryStr, params);
    return result.rows;
  }

  _buildMatchProfile(profile) {
    return `
Academic: ${profile.highest_education} | GPA: ${profile.gpa}/${profile.gpa_scale || 4.0} | ${profile.major}
Test Scores: ${JSON.stringify(profile.standardized_scores || {})}
Target Degree: ${profile.target_degree || 'master'}
Target Countries: ${(profile.target_countries || []).join(', ') || 'Any'}
Target Fields: ${(profile.target_fields || []).join(', ') || 'Not specified'}
Annual Budget: $${profile.budget_min || 0} - $${profile.budget_max || 80000}
Work Experience: ${profile.work_experience_months || 0} months
Career Goals: ${profile.career_goals || 'Not specified'}
Personality: ${profile.personality_type || 'Unknown'} | Risk: ${profile.risk_appetite || 'moderate'}
    `.trim();
  }

  async addUniversity(data) {
    const result = await query(
      `INSERT INTO universities (
        name, country, city, website, type,
        qs_ranking, times_ranking, available_fields,
        avg_tuition_usd, avg_living_cost_usd_monthly,
        scholarship_availability, avg_scholarship_percent,
        avg_placement_rate, avg_starting_salary_usd, median_salary_5yr_usd,
        top_recruiters, min_gpa, min_ielts, min_toefl, min_gre, min_gmat, acceptance_rate
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      RETURNING *`,
      [
        data.name, data.country, data.city, data.website, data.type,
        data.qs_ranking, data.times_ranking, data.available_fields,
        data.avg_tuition_usd, data.avg_living_cost_usd_monthly,
        data.scholarship_availability, data.avg_scholarship_percent,
        data.avg_placement_rate, data.avg_starting_salary_usd, data.median_salary_5yr_usd,
        data.top_recruiters, data.min_gpa, data.min_ielts, data.min_toefl,
        data.min_gre, data.min_gmat, data.acceptance_rate,
      ]
    );
    return result.rows[0];
  }

  async listUniversities(filters = {}) {
    const { country, maxTuition, minRanking, field, page = 1, limit = 20 } = filters;
    let queryStr = 'SELECT * FROM universities WHERE 1=1';
    const params = [];

    if (country) { params.push(country); queryStr += ` AND country = $${params.length}`; }
    if (maxTuition) { params.push(maxTuition); queryStr += ` AND avg_tuition_usd <= $${params.length}`; }
    if (minRanking) { params.push(minRanking); queryStr += ` AND qs_ranking <= $${params.length}`; }
    if (field) { params.push(field); queryStr += ` AND $${params.length} = ANY(available_fields)`; }

    params.push(limit);
    params.push((page - 1) * limit);
    queryStr += ` ORDER BY qs_ranking NULLS LAST LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await query(queryStr, params);
    return result.rows;
  }
}

module.exports = new UniversityService();
