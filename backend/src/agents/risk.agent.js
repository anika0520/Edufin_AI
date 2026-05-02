// src/agents/risk.agent.js
// RISK AGENT — Comprehensive risk scoring across academic, financial, and career domains
const aiProvider = require('../config/ai-provider');
const logger = require('../utils/logger');
const { redactProfile } = require('../utils/piiRedactor');

const RISK_AGENT_PROMPT = `You are the RISK INTELLIGENCE AGENT in a multi-agent AI system.
Your ONLY job: identify, quantify, and explain ALL risks for this student's education plan.
Be specific, data-driven, and honest. Do NOT sugarcoat.

STUDENT PROFILE:
{PROFILE}

FINANCIAL ANALYSIS:
{FINANCE_DATA}

CAREER ANALYSIS:
{CAREER_DATA}

Analyze ALL risk dimensions and output a comprehensive risk map.
Respond ONLY with valid JSON:
{
  "agent": "risk",
  "composite_risk_score": 0,
  "risk_category": "low|medium|high|critical",
  "risk_summary": "2-3 sentence honest risk summary",

  "risk_dimensions": {
    "financial_risk": {
      "score": 0,
      "label": "Financial Risk",
      "drivers": ["driver1", "driver2"],
      "mitigation": ["action1", "action2"]
    },
    "career_risk": {
      "score": 0,
      "label": "Career Market Risk",
      "drivers": ["driver1", "driver2"],
      "mitigation": ["action1", "action2"]
    },
    "academic_risk": {
      "score": 0,
      "label": "Academic Performance Risk",
      "drivers": ["driver1", "driver2"],
      "mitigation": ["action1", "action2"]
    },
    "loan_default_risk": {
      "score": 0,
      "label": "Loan Default Risk",
      "default_probability_3yr": 0,
      "default_probability_5yr": 0,
      "drivers": ["driver1", "driver2"],
      "mitigation": ["action1", "action2"]
    },
    "geopolitical_risk": {
      "score": 0,
      "label": "Country / Visa Risk",
      "drivers": ["driver1"],
      "mitigation": ["action1"]
    },
    "opportunity_cost_risk": {
      "score": 0,
      "label": "Opportunity Cost Risk",
      "explanation": "What are they giving up?",
      "alternative_worth_usd": 0
    }
  },

  "dropout_probability": 0,
  "underemployment_risk": 0,
  "job_search_delay_months_expected": 0,

  "red_alerts": [
    {
      "alert": "title",
      "severity": "critical|high|medium",
      "description": "what this means",
      "action": "what to do NOW"
    }
  ],
  "yellow_warnings": [
    {
      "warning": "title",
      "description": "what to watch"
    }
  ],
  "green_lights": [
    {
      "factor": "positive factor",
      "why": "how this reduces risk"
    }
  ],

  "scenario_risk_deltas": {
    "if_job_delayed_6mo": {"risk_increase": 0, "financial_impact_usd": 0},
    "if_salary_20pct_lower": {"risk_increase": 0, "financial_impact_usd": 0},
    "if_loan_rate_2pct_higher": {"risk_increase": 0, "emi_increase_usd": 0}
  },

  "overall_recommendation": "proceed|proceed_with_caution|reconsider|do_not_proceed",
  "reasoning": "3-4 sentences of agent reasoning",
  "confidence": 0
}`;

class RiskAgent {
  async evaluate(profile, financeOutput, careerOutput) {
    try {
      const profileStr = this._buildProfileStr(profile);
      const financeStr = financeOutput
        ? `EMI: $${financeOutput.monthly_emi_usd}/mo, DTI: ${(financeOutput.debt_to_income_ratio * 100).toFixed(0)}%, Stress: ${financeOutput.financial_stress_level}, Loan: $${financeOutput.loan_amount_usd}`
        : 'No financial analysis available';
      const careerStr = careerOutput
        ? `Career: ${careerOutput.top_career}, Fit: ${careerOutput.career_fit_score}%, Demand: ${careerOutput.market_demand}, Job offer prob: ${careerOutput.job_offer_probability_12mo}%`
        : 'No career analysis available';

      const result = await aiProvider.complete({
        systemPrompt: RISK_AGENT_PROMPT
          .replace('{PROFILE}', profileStr)
          .replace('{FINANCE_DATA}', financeStr)
          .replace('{CAREER_DATA}', careerStr),
        messages: [{ role: 'user', content: 'Run comprehensive risk analysis.' }],
        temperature: 0.25,
        maxTokens: 2000,
        jsonMode: true,
      });

      const parsed = aiProvider.parseJSON(result.content);
      // Validate scenario deltas math
      if (financeOutput?.monthly_emi_usd) {
        const P = financeOutput.loan_amount_usd || 40000;
        const r_base = (financeOutput.interest_rate_percent || 9.5) / 100 / 12;
        const r_high = ((financeOutput.interest_rate_percent || 9.5) + 2) / 100 / 12;
        const n = financeOutput.loan_tenure_months || 120;
        const emiBase = financeOutput.monthly_emi_usd;
        const emiHigh = Math.round((P * r_high * Math.pow(1 + r_high, n)) / (Math.pow(1 + r_high, n) - 1));
        if (parsed.scenario_risk_deltas) {
          parsed.scenario_risk_deltas.if_loan_rate_2pct_higher.emi_increase_usd = emiHigh - emiBase;
          const entrySalary = careerOutput?.top_career_entry_salary_usd || 80000;
          parsed.scenario_risk_deltas.if_salary_20pct_lower.financial_impact_usd = Math.round(entrySalary * 0.2 * 5);
          parsed.scenario_risk_deltas.if_job_delayed_6mo.financial_impact_usd = Math.round(emiBase * 6);
        }
      }

      logger.debug('RiskAgent completed', { risk: parsed.composite_risk_score, category: parsed.risk_category });
      return { ...parsed, agent: 'risk' };
    } catch (err) {
      logger.error('RiskAgent error:', err.message);
      return this._fallback(profile, financeOutput, careerOutput);
    }
  }

  _buildProfileStr(profile) {
    return `
GPA: ${profile.gpa || profile.current_gpa || 3.5}
Family Income: $${profile.annual_family_income || (profile.monthly_family_income || 0) * 12}/yr
Savings: $${profile.savings_available || profile.current_savings || 0}
Loan Required: $${profile.max_loan_comfort || 40000}
Work Experience: ${profile.work_experience_months || 0} months
Has Cosigner: ${profile.has_cosigner || false}
Risk Appetite: ${profile.risk_appetite || 'moderate'}
Outstanding Loans: $${profile.outstanding_loans || 0}
Target Country: ${(profile.target_countries || profile.preferred_countries || ['USA'])[0]}
    `.trim();
  }

  _fallback(profile, financeOutput, careerOutput) {
    const gpa = parseFloat(profile.gpa || profile.current_gpa || 3.5);
    const dti = financeOutput?.debt_to_income_ratio || 0.3;
    const careerFit = careerOutput?.career_fit_score || 70;
    const jobProb = careerOutput?.job_offer_probability_12mo || 75;

    // Weighted risk formula
    const financialRisk = Math.round(Math.min(100, dti * 200));
    const careerRisk = Math.round(Math.max(5, 100 - careerFit));
    const academicRisk = Math.round(Math.max(5, (4.0 - gpa) / 1.0 * 50));
    const loanDefault = Math.round(Math.min(80, dti * 150 + (100 - jobProb) * 0.3));
    const composite = Math.round(financialRisk * 0.35 + careerRisk * 0.25 + academicRisk * 0.15 + loanDefault * 0.25);

    return {
      agent: 'risk',
      composite_risk_score: composite,
      risk_category: composite < 30 ? 'low' : composite < 55 ? 'medium' : composite < 75 ? 'high' : 'critical',
      risk_summary: `Composite risk score of ${composite}/100. Financial stress is ${financialRisk < 30 ? 'manageable' : 'elevated'}.`,
      risk_dimensions: {
        financial_risk: { score: financialRisk, label: 'Financial Risk', drivers: ['Loan-to-income ratio', 'EMI burden'], mitigation: ['Seek scholarships', 'Part-time work'] },
        career_risk: { score: careerRisk, label: 'Career Market Risk', drivers: ['Market saturation'], mitigation: ['Build portfolio', 'Network early'] },
        academic_risk: { score: academicRisk, label: 'Academic Risk', drivers: ['GPA trajectory'], mitigation: ['Academic support', 'Study groups'] },
        loan_default_risk: { score: loanDefault, label: 'Loan Default Risk', default_probability_3yr: Math.round(loanDefault * 0.6), default_probability_5yr: Math.round(loanDefault * 0.4), drivers: ['Job market timing'], mitigation: ['Emergency fund', 'Deferment options'] },
        geopolitical_risk: { score: 25, label: 'Country / Visa Risk', drivers: ['Immigration policy changes'], mitigation: ['Track visa policy', 'Backup country plan'] },
        opportunity_cost_risk: { score: 30, label: 'Opportunity Cost Risk', explanation: 'Could work directly in field', alternative_worth_usd: 0 },
      },
      dropout_probability: Math.round(Math.max(5, 30 - gpa * 5)),
      underemployment_risk: Math.round(Math.max(10, careerRisk * 0.5)),
      job_search_delay_months_expected: Math.round(Math.max(2, 8 - careerFit / 15)),
      red_alerts: composite > 70 ? [{ alert: 'High financial stress', severity: 'high', description: 'EMI exceeds safe threshold', action: 'Reduce loan or increase down payment' }] : [],
      yellow_warnings: [],
      green_lights: gpa > 3.5 ? [{ factor: 'Strong GPA', why: 'Reduces academic risk and improves job prospects' }] : [],
      scenario_risk_deltas: {
        if_job_delayed_6mo: { risk_increase: 15, financial_impact_usd: Math.round((financeOutput?.monthly_emi_usd || 800) * 6) },
        if_salary_20pct_lower: { risk_increase: 20, financial_impact_usd: Math.round((careerOutput?.top_career_entry_salary_usd || 80000) * 0.2 * 5) },
        if_loan_rate_2pct_higher: { risk_increase: 10, emi_increase_usd: Math.round((financeOutput?.monthly_emi_usd || 800) * 0.2) },
      },
      overall_recommendation: composite < 35 ? 'proceed' : composite < 55 ? 'proceed_with_caution' : composite < 75 ? 'reconsider' : 'do_not_proceed',
      reasoning: 'Fallback risk calculation using academic, financial, and career signals.',
      confidence: 55,
    };
  }
}

module.exports = new RiskAgent();
