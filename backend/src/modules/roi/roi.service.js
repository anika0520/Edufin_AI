// src/modules/roi/roi.service.js
const { query } = require('../../database/connection');
const { cache } = require('../../config/redis');
const aiProvider = require('../../config/ai-provider');
const userIntelligenceService = require('../user-intelligence/user-intelligence.service');
const logger = require('../../utils/logger');

const ROI_ANALYSIS_PROMPT = `You are an expert financial analyst specializing in education ROI and personal finance for students.

Perform a comprehensive ROI analysis for this education investment.

STUDENT PROFILE:
{PROFILE_DATA}

UNIVERSITY & PROGRAM DATA:
{UNIVERSITY_DATA}

CAREER PROJECTION:
{CAREER_DATA}

Calculate the following using sound financial modeling. Respond ONLY with valid JSON:
{
  "cost_breakdown": {
    "tuition_total_usd": 0,
    "living_cost_total_usd": 0,
    "misc_costs_usd": 0,
    "total_cost_usd": 0,
    "scholarship_estimate_usd": 0,
    "net_cost_usd": 0
  },
  "income_projections": {
    "year1_salary_usd": 0,
    "year3_salary_usd": 0,
    "year5_salary_usd": 0,
    "year10_salary_usd": 0,
    "cumulative_10yr_earnings_usd": 0,
    "opportunity_cost_usd": 0
  },
  "roi_metrics": {
    "roi_score": 0,
    "break_even_months": 0,
    "net_present_value_usd": 0,
    "internal_rate_of_return": 0,
    "payback_period_years": 0
  },
  "risk_assessment": {
    "risk_score": 0,
    "risk_category": "low|medium|high",
    "worth_it_flag": true,
    "worth_it_reasoning": "2-3 sentence plain English explanation",
    "risk_factors": ["factor1", "factor2"],
    "upside_factors": ["upside1", "upside2"]
  },
  "tax_adjusted": {
    "country": "USA",
    "effective_tax_rate": 0.22,
    "after_tax_year1": 0,
    "after_tax_year5": 0
  },
  "confidence_score": 80,
  "key_assumptions": ["assumption1", "assumption2", "assumption3"],
  "key_influencing_factors": ["factor1", "factor2", "factor3"]
}`;

const SCENARIO_PROMPT = `You are a financial scenario analyst. 
Base ROI Analysis: {BASE_ROI}
Scenario: {SCENARIO_TYPE} - {SCENARIO_PARAMS}

Calculate how this scenario changes the financial outcome. Respond in JSON:
{
  "scenario_name": "",
  "impact_on_roi_score": 0,
  "new_roi_score": 0,
  "new_break_even_months": 0,
  "new_worth_it_flag": true,
  "key_changes": ["change1", "change2"],
  "recommendation": "what the student should do given this scenario",
  "risk_change": "increased|decreased|unchanged"
}`;

class ROIService {
  async calculateROI(userId, universityRecommendationId, options = {}) {
    const cacheKey = `roi:${userId}:${universityRecommendationId}`;
    const cached = await cache.get(cacheKey);
    if (cached && !options.forceRefresh) return cached;

    // Fetch all required data
    const profile = await userIntelligenceService.getFullProfile(userId);
    if (!profile) throw new Error('Profile not found');

    const uniRec = await query(
      `SELECT ur.*, u.name as uni_name, u.country, u.city, u.avg_tuition_usd,
              u.avg_living_cost_usd_monthly, u.avg_placement_rate, u.avg_starting_salary_usd,
              u.median_salary_5yr_usd, u.avg_scholarship_percent
       FROM university_recommendations ur
       JOIN universities u ON u.id = ur.university_id
       WHERE ur.id = $1 AND ur.user_id = $2`,
      [universityRecommendationId, userId]
    );

    if (!uniRec.rows.length) throw new Error('University recommendation not found');
    const uni = uniRec.rows[0];

    const careerRec = await query(
      'SELECT * FROM career_recommendations WHERE user_id = $1 AND is_active = TRUE ORDER BY rank LIMIT 1',
      [userId]
    );
    const career = careerRec.rows[0] || null;

    // Build context
    const profileData = `
Income: $${profile.annual_family_income || 0}/yr (${profile.family_income_bracket || 'unknown'} bracket)
Savings: $${profile.savings_available || 0}
Risk Appetite: ${profile.risk_appetite || 'moderate'}
Current Location: ${profile.current_country}
Work Experience: ${profile.work_experience_months || 0} months
    `.trim();

    const universityData = `
University: ${uni.uni_name}, ${uni.city}, ${uni.country}
Annual Tuition: $${uni.avg_tuition_usd}
Monthly Living Cost: $${uni.avg_living_cost_usd_monthly}
Program Duration: 2 years (assumed master's)
Average Scholarship: ${uni.avg_scholarship_percent || 0}%
Placement Rate: ${uni.avg_placement_rate || 0}%
Average Starting Salary: $${uni.avg_starting_salary_usd}
5-Year Median Salary: $${uni.median_salary_5yr_usd}
    `.trim();

    const careerData = career ? `
Career Target: ${career.career_title}
Entry Salary: $${career.entry_salary_usd}
Mid-Level Salary: $${career.mid_salary_usd}
Senior Salary: $${career.senior_salary_usd}
Annual Growth Rate: ${career.salary_growth_rate_annual}%
Time to Achieve: ${career.time_to_achieve_months} months
    `.trim() : 'No career recommendation available';

    const result = await aiProvider.complete({
      systemPrompt: ROI_ANALYSIS_PROMPT
        .replace('{PROFILE_DATA}', profileData)
        .replace('{UNIVERSITY_DATA}', universityData)
        .replace('{CAREER_DATA}', careerData),
      messages: [{ role: 'user', content: 'Calculate detailed ROI analysis.' }],
      temperature: 0.2, // Low temperature for financial calculations
      maxTokens: 2000,
      jsonMode: true,
    });

    const roiData = aiProvider.parseJSON(result.content);

    // Save to DB
    const saved = await query(
      `INSERT INTO roi_analyses (
        user_id, university_recommendation_id,
        tuition_total_usd, living_cost_total_usd, misc_costs_usd, total_cost_usd,
        year1_salary_usd, year3_salary_usd, year5_salary_usd, year10_salary_usd,
        cumulative_10yr_earnings_usd,
        roi_score, break_even_months, net_present_value_usd, internal_rate_of_return, payback_period_years,
        risk_score, risk_category, worth_it_flag, worth_it_reasoning,
        inflation_rate_assumed, country_tax_rate
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      ON CONFLICT DO NOTHING
      RETURNING id`,
      [
        userId, universityRecommendationId,
        roiData.cost_breakdown.tuition_total_usd,
        roiData.cost_breakdown.living_cost_total_usd,
        roiData.cost_breakdown.misc_costs_usd,
        roiData.cost_breakdown.total_cost_usd,
        roiData.income_projections.year1_salary_usd,
        roiData.income_projections.year3_salary_usd,
        roiData.income_projections.year5_salary_usd,
        roiData.income_projections.year10_salary_usd,
        roiData.income_projections.cumulative_10yr_earnings_usd,
        roiData.roi_metrics.roi_score,
        roiData.roi_metrics.break_even_months,
        roiData.roi_metrics.net_present_value_usd,
        roiData.roi_metrics.internal_rate_of_return,
        roiData.roi_metrics.payback_period_years,
        roiData.risk_assessment.risk_score,
        roiData.risk_assessment.risk_category,
        roiData.risk_assessment.worth_it_flag,
        roiData.risk_assessment.worth_it_reasoning,
        3.0,
        roiData.tax_adjusted.effective_tax_rate * 100,
      ]
    );

    const finalResult = {
      roiAnalysis: roiData,
      roiId: saved.rows[0]?.id,
      university: { name: uni.uni_name, country: uni.country, city: uni.city },
      career: career ? { title: career.career_title } : null,
      generatedAt: new Date().toISOString(),
    };

    await cache.set(cacheKey, finalResult, 3600 * 6);
    return finalResult;
  }

  async runScenario(userId, baseRoiId, scenarioType, scenarioParams) {
    const baseRoi = await query(
      'SELECT * FROM roi_analyses WHERE id = $1 AND user_id = $2',
      [baseRoiId, userId]
    );
    if (!baseRoi.rows.length) throw new Error('Base ROI analysis not found');

    const baseData = baseRoi.rows[0];

    const scenarioDescriptions = {
      university_change: `Switching to a different university with: ${JSON.stringify(scenarioParams)}`,
      salary_drop: `Salary drops by ${scenarioParams.percent}% due to ${scenarioParams.reason}`,
      loan_amount_change: `Taking ${scenarioParams.direction === 'more' ? 'more' : 'less'} loan: $${scenarioParams.amount}`,
      career_change: `Switching career to: ${scenarioParams.career_title}`,
      job_delay: `Delayed employment by ${scenarioParams.months} months`,
      scholarship_gain: `Receiving $${scenarioParams.amount} scholarship`,
    };

    const result = await aiProvider.complete({
      systemPrompt: SCENARIO_PROMPT
        .replace('{BASE_ROI}', JSON.stringify({
          roi_score: baseData.roi_score,
          break_even_months: baseData.break_even_months,
          total_cost_usd: baseData.total_cost_usd,
          year5_salary_usd: baseData.year5_salary_usd,
          worth_it_flag: baseData.worth_it_flag,
          risk_category: baseData.risk_category,
        }))
        .replace('{SCENARIO_TYPE}', scenarioType)
        .replace('{SCENARIO_PARAMS}', scenarioDescriptions[scenarioType] || JSON.stringify(scenarioParams)),
      messages: [{ role: 'user', content: 'Run this financial scenario analysis.' }],
      temperature: 0.2,
      maxTokens: 1000,
      jsonMode: true,
    });

    const scenarioResult = aiProvider.parseJSON(result.content);

    // Save simulation
    await query(
      `INSERT INTO simulations (user_id, simulation_type, input_parameters, result, baseline_roi_score, simulated_roi_score, recommendation)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId, scenarioType, JSON.stringify({ ...scenarioParams, baseRoiId }),
        JSON.stringify(scenarioResult),
        baseData.roi_score,
        scenarioResult.new_roi_score,
        scenarioResult.recommendation,
      ]
    );

    return scenarioResult;
  }
}

module.exports = new ROIService();
