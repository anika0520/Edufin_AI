// src/modules/loan/loan.service.js
const { query } = require('../../database/connection');
const { cache } = require('../../config/redis');
const aiProvider = require('../../config/ai-provider');
const userIntelligenceService = require('../user-intelligence/user-intelligence.service');
const logger = require('../../utils/logger');

const LOAN_ELIGIBILITY_PROMPT = `You are an AI-powered loan underwriter specializing in education financing for students with no credit history.

You must assess loan eligibility using alternative credit signals since this is a student with no formal credit history.

STUDENT PROFILE:
{PROFILE_DATA}

CAREER PREDICTION:
{CAREER_DATA}

UNIVERSITY ROI ANALYSIS:
{ROI_DATA}

LOAN REQUEST:
Amount Requested: {LOAN_AMOUNT}
Purpose: {PURPOSE}

ALTERNATIVE CREDIT PROXIES TO USE:
1. Career trajectory score (predicted earning potential)
2. University ROI score (quality of investment)
3. Academic strength (GPA, test scores, research)
4. Family income stability
5. Cosigner availability and income
6. Field demand (job market in chosen field)

Respond with ONLY valid JSON:
{
  "eligibility_score": 0,
  "max_approved_amount_usd": 0,
  "suggested_amount_usd": 0,
  "interest_rate_min": 0.0,
  "interest_rate_max": 0.0,
  "interest_rate_offered": 0.0,
  "loan_term_months": 120,
  "emi_estimated_usd": 0,
  "risk_category": "low|medium|high",
  "risk_score": 0,
  "credit_score_proxy": 0,
  "component_scores": {
    "career_trajectory_score": 0,
    "university_roi_score": 0,
    "family_income_score": 0,
    "academic_strength_score": 0,
    "cosigner_boost": 0
  },
  "eligibility_reasoning": "Plain English explanation of why this eligibility was determined",
  "rejection_reasons": [],
  "improvement_suggestions": ["suggestion1", "suggestion2"],
  "confidence_score": 0,
  "key_factors": [
    {"factor": "Career trajectory", "impact": "positive", "weight": 0.3},
    {"factor": "University ROI", "impact": "positive", "weight": 0.25}
  ],
  "conditions": ["condition1", "condition2"],
  "special_programs": ["e.g., Income Share Agreement option", "Deferred repayment until employed"]
}`;

class LoanService {
  async assessEligibility(userId, { requestedAmount, purpose, universityRecommendationId, roiAnalysisId }) {
    const profile = await userIntelligenceService.getFullProfile(userId);
    if (!profile) throw new Error('Profile not found');

    if ((profile.profile_completeness || 0) < 50) {
      throw new Error('Please complete at least 50% of your profile for loan assessment');
    }

    // Fetch career recommendation
    const careerRec = await query(
      'SELECT * FROM career_recommendations WHERE user_id = $1 AND is_active = TRUE ORDER BY rank LIMIT 1',
      [userId]
    );

    // Fetch ROI analysis
    let roiAnalysis = null;
    if (roiAnalysisId) {
      const roiRes = await query(
        'SELECT * FROM roi_analyses WHERE id = $1 AND user_id = $2',
        [roiAnalysisId, userId]
      );
      roiAnalysis = roiRes.rows[0];
    }

    const profileData = this._buildLoanProfileSummary(profile);
    const careerData = this._buildCareerSummary(careerRec.rows[0]);
    const roiData = roiAnalysis ? this._buildROISummary(roiAnalysis) : 'ROI analysis not available';

    const result = await aiProvider.complete({
      systemPrompt: LOAN_ELIGIBILITY_PROMPT
        .replace('{PROFILE_DATA}', profileData)
        .replace('{CAREER_DATA}', careerData)
        .replace('{ROI_DATA}', roiData)
        .replace('{LOAN_AMOUNT}', requestedAmount)
        .replace('{PURPOSE}', purpose || 'Education financing'),
      messages: [{ role: 'user', content: 'Assess this student\'s loan eligibility.' }],
      temperature: 0.2,
      maxTokens: 2000,
      jsonMode: true,
    });

    const eligibility = aiProvider.parseJSON(result.content);

    // Create loan application record
    const saved = await query(
      `INSERT INTO loan_applications (
        user_id, university_recommendation_id, roi_analysis_id,
        requested_amount_usd, loan_purpose, status,
        eligibility_score, max_approved_amount_usd, suggested_amount_usd,
        interest_rate_min, interest_rate_max, interest_rate_offered,
        loan_term_months, emi_estimated_usd,
        risk_category, risk_score, credit_score_proxy,
        career_trajectory_score, university_roi_score, family_income_score,
        academic_strength_score, cosigner_boost,
        eligibility_reasoning, improvement_suggestions, confidence_score, key_factors,
        assessment_completed_at
      ) VALUES ($1,$2,$3,$4,$5,'assessment',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,NOW())
      RETURNING id`,
      [
        userId,
        universityRecommendationId || null,
        roiAnalysisId || null,
        requestedAmount,
        purpose,
        eligibility.eligibility_score,
        eligibility.max_approved_amount_usd,
        eligibility.suggested_amount_usd,
        eligibility.interest_rate_min,
        eligibility.interest_rate_max,
        eligibility.interest_rate_offered,
        eligibility.loan_term_months,
        eligibility.emi_estimated_usd,
        eligibility.risk_category,
        eligibility.risk_score,
        eligibility.credit_score_proxy,
        eligibility.component_scores?.career_trajectory_score,
        eligibility.component_scores?.university_roi_score,
        eligibility.component_scores?.family_income_score,
        eligibility.component_scores?.academic_strength_score,
        eligibility.component_scores?.cosigner_boost || 0,
        eligibility.eligibility_reasoning,
        eligibility.improvement_suggestions,
        eligibility.confidence_score,
        JSON.stringify(eligibility.key_factors || []),
      ]
    );

    // Log decision
    await query(
      `INSERT INTO ai_decision_log (user_id, decision_type, decision_id, model_used, prompt_tokens, completion_tokens, confidence_score, reasoning, key_factors)
       VALUES ($1, 'loan_eligibility', $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        saved.rows[0].id,
        result.model,
        result.usage.prompt_tokens,
        result.usage.completion_tokens,
        eligibility.confidence_score,
        eligibility.eligibility_reasoning?.substring(0, 500),
        JSON.stringify(eligibility.key_factors || []),
      ]
    );

    return {
      applicationId: saved.rows[0].id,
      eligibility,
      status: 'assessment',
      nextSteps: this._getNextSteps(eligibility),
    };
  }

  async submitApplication(userId, applicationId) {
    const app = await query(
      'SELECT * FROM loan_applications WHERE id = $1 AND user_id = $2 AND status = $3',
      [applicationId, userId, 'assessment']
    );
    if (!app.rows.length) throw new Error('Application not found or already submitted');

    if (app.rows[0].eligibility_score < 30) {
      throw new Error('Eligibility score too low to submit application');
    }

    await query(
      'UPDATE loan_applications SET status = $1, submitted_at = NOW() WHERE id = $2',
      ['under_review', applicationId]
    );

    logger.info('Loan application submitted', { userId, applicationId });
    return { status: 'under_review', message: 'Application submitted for review' };
  }

  async getApplicationHistory(userId) {
    const result = await query(
      `SELECT la.*, ur.rank as uni_rank,
              u.name as university_name
       FROM loan_applications la
       LEFT JOIN university_recommendations ur ON ur.id = la.university_recommendation_id
       LEFT JOIN universities u ON u.id = ur.university_id
       WHERE la.user_id = $1
       ORDER BY la.created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  _buildLoanProfileSummary(profile) {
    // Compute credit score proxy
    let creditProxy = 300;
    if (profile.annual_family_income) {
      creditProxy += Math.min(200, profile.annual_family_income / 500);
    }
    if (profile.has_property) creditProxy += 100;
    if (profile.outstanding_loans === 0 || !profile.outstanding_loans) creditProxy += 50;
    if (profile.has_cosigner) creditProxy += 80;
    if (profile.gpa >= 3.5) creditProxy += 70;
    creditProxy = Math.min(850, Math.round(creditProxy));

    return `
Student Name: ${profile.first_name} ${profile.last_name}
Annual Family Income: $${profile.annual_family_income || 0} (${profile.income_currency || 'USD'})
Income Bracket: ${profile.family_income_bracket || 'Unknown'}
Savings Available: $${profile.savings_available || 0}
Has Property: ${profile.has_property ? `Yes ($${profile.property_value || 0})` : 'No'}
Outstanding Loans: $${profile.outstanding_loans || 0}
Has Cosigner: ${profile.has_cosigner ? `Yes (income: $${profile.cosigner_income || 0})` : 'No'}
Computed Credit Score Proxy: ${creditProxy}/850
GPA: ${profile.gpa || 'N/A'}/${profile.gpa_scale || 4.0}
Highest Education: ${profile.highest_education || 'Unknown'}
Work Experience: ${profile.work_experience_months || 0} months
Risk Appetite: ${profile.risk_appetite || 'moderate'}
Personality Type: ${profile.personality_type || 'Unknown'}
Target Degree: ${profile.target_degree || 'Unknown'}
Target Countries: ${(profile.target_countries || []).join(', ') || 'Not specified'}
    `.trim();
  }

  _buildCareerSummary(career) {
    if (!career) return 'No career recommendation available';
    return `
Target Career: ${career.career_title}
Entry Salary: $${career.entry_salary_usd}
Mid Salary: $${career.mid_salary_usd}
Senior Salary: $${career.senior_salary_usd}
Market Demand Score: ${career.market_demand_score}/100
Career Probability: ${career.probability_score}%
Automation Risk: ${career.automation_risk}
Job Market Growth: ${career.yoy_growth_percent}% YoY
Top Hiring Companies: ${(career.top_hiring_companies || []).slice(0, 3).join(', ')}
    `.trim();
  }

  _buildROISummary(roi) {
    if (!roi) return 'ROI analysis not available';
    return `
Total Education Cost: $${roi.total_cost_usd}
Expected Year-1 Salary: $${roi.year1_salary_usd}
ROI Score: ${roi.roi_score}/100
Break-Even: ${roi.break_even_months} months
NPV: $${roi.net_present_value_usd}
Risk Category: ${roi.risk_category}
Worth It Flag: ${roi.worth_it_flag ? 'YES' : 'NO'}
    `.trim();
  }

  _getNextSteps(eligibility) {
    const steps = [];
    if (eligibility.eligibility_score >= 70) {
      steps.push('Your profile is strong. Submit your application to proceed.');
      steps.push('Prepare required documents: transcripts, offer letter, income proof.');
    } else if (eligibility.eligibility_score >= 40) {
      steps.push('Consider adding a cosigner to improve eligibility.');
      steps.push(...(eligibility.improvement_suggestions || []).slice(0, 2));
    } else {
      steps.push('Complete your profile with more financial details.');
      steps.push(...(eligibility.improvement_suggestions || []).slice(0, 3));
    }
    return steps;
  }
}

module.exports = new LoanService();
