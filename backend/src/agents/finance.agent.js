// src/agents/finance.agent.js
// FINANCE AGENT — Deep financial feasibility, loan math, EMI stress, ROI
const aiProvider = require('../config/ai-provider');
const logger = require('../utils/logger');
const { redactProfile } = require('../utils/piiRedactor');

const FINANCE_AGENT_PROMPT = `You are the FINANCE INTELLIGENCE AGENT in a multi-agent AI system.
Your ONLY job: evaluate the complete financial picture for this student's education decision.

STUDENT FINANCIAL PROFILE:
{PROFILE}

EDUCATION COST & LOAN DETAILS:
{LOAN_DATA}

CAREER INCOME PROJECTION:
{CAREER_DATA}

USD TO INR RATE: {USD_INR_RATE}

You MUST calculate all metrics mathematically. Do NOT guess.

Mathematical formulas to use:
- EMI = [P × r × (1+r)^n] / [(1+r)^n - 1]  where r = monthly_rate, n = months
- ROI multiple = (Cumulative 5yr earnings - Total cost) / Total cost
- Break-even months = Total cost / (Monthly salary - Monthly living expenses)
- Debt-to-income ratio = Annual EMI / Annual gross salary
- Payback years = Total loan / (Annual salary × 0.3)  [30% allocated to repayment]

Respond ONLY with valid JSON (all USD values):
{
  "agent": "finance",
  "total_education_cost_usd": 0,
  "tuition_usd": 0,
  "living_cost_2yr_usd": 0,
  "misc_costs_usd": 0,
  "loan_amount_usd": 0,
  "own_contribution_usd": 0,
  "monthly_emi_usd": 0,
  "annual_emi_usd": 0,
  "loan_tenure_months": 120,
  "interest_rate_percent": 0,
  "total_interest_paid_usd": 0,
  "total_repayment_usd": 0,
  "roi_multiple": 0,
  "break_even_months": 0,
  "payback_years": 0,
  "net_present_value_usd": 0,
  "debt_to_income_ratio": 0,
  "emi_as_percent_of_salary": 0,
  "financial_stress_level": "low|medium|high|critical",
  "financial_stress_score": 0,
  "salary_timeline_usd": [
    {"year": 1, "gross_usd": 0, "after_tax_usd": 0, "emi_usd": 0, "savings_usd": 0, "net_usd": 0},
    {"year": 2, "gross_usd": 0, "after_tax_usd": 0, "emi_usd": 0, "savings_usd": 0, "net_usd": 0},
    {"year": 3, "gross_usd": 0, "after_tax_usd": 0, "emi_usd": 0, "savings_usd": 0, "net_usd": 0},
    {"year": 5, "gross_usd": 0, "after_tax_usd": 0, "emi_usd": 0, "savings_usd": 0, "net_usd": 0},
    {"year": 7, "gross_usd": 0, "after_tax_usd": 0, "emi_usd": 0, "savings_usd": 0, "net_usd": 0},
    {"year": 10, "gross_usd": 0, "after_tax_usd": 0, "emi_usd": 0, "savings_usd": 0, "net_usd": 0}
  ],
  "cumulative_savings_5yr_usd": 0,
  "net_worth_5yr_usd": 0,
  "safe_loan_max_usd": 0,
  "loan_safety_verdict": "safe|borderline|risky|dangerous",
  "tax_rate_assumed_percent": 0,
  "country_considered": "",
  "key_financial_risks": [],
  "financial_upsides": [],
  "reasoning": "3-4 sentences explaining the financial picture with specific numbers",
  "confidence": 0
}`;

class FinanceAgent {
  async evaluate(profile, careerOutput, loanData) {
    try {
      const safeProfile = redactProfile(profile); // PII redaction before LLM
      const profileStr = this._buildProfileStr(safeProfile, loanData);
      const loanStr = loanData
        ? JSON.stringify({ requested: loanData.requestedAmount, tuition: loanData.tuition, living: loanData.livingCost }, null, 2)
        : `Requested loan: ${(profile.max_loan_comfort || 40000)}. Tuition unknown — estimate from target country.`;
      const careerStr = careerOutput
        ? `Top career: ${careerOutput.top_career}, Entry: $${careerOutput.top_career_entry_salary_usd}/yr, 5yr: $${careerOutput.top_career_5yr_salary_usd}/yr`
        : 'No career data — assume average tech salary for field';
      const usdInr = process.env.USD_TO_INR_RATE || 83;

      const result = await aiProvider.complete({
        systemPrompt: FINANCE_AGENT_PROMPT
          .replace('{PROFILE}', profileStr)
          .replace('{LOAN_DATA}', loanStr)
          .replace('{CAREER_DATA}', careerStr)
          .replace('{USD_INR_RATE}', usdInr),
        messages: [{ role: 'user', content: 'Run complete financial analysis. Calculate all values mathematically.' }],
        temperature: 0.15,
        maxTokens: 2200,
        jsonMode: true,
      });

      let parsed = aiProvider.parseJSON(result.content);

      // Full deterministic overwrite — no LLM math trusted
      const { validateAndOverwriteFinanceOutput } = require('../utils/financeMath');
      parsed = validateAndOverwriteFinanceOutput(parsed, safeProfile, loanData, careerOutput);

      logger.debug('FinanceAgent completed', { roi: parsed.roi_multiple, stress: parsed.financial_stress_level, _deterministic: true });
      return { ...parsed, agent: 'finance' };
    } catch (err) {
      logger.error('FinanceAgent error:', err.message);
      return this._fallback(profile, careerOutput, loanData);
    }
  }

  _validateAndFixMath(parsed, profile, careerOutput) {
    // Legacy — now calls deterministic utility
    const { validateAndOverwriteFinanceOutput } = require('../utils/financeMath');
    return validateAndOverwriteFinanceOutput(parsed, profile, {}, careerOutput);
  }

  _buildProfileStr(profile, loanData) {
    const income = profile.monthly_family_income
      ? profile.monthly_family_income * 12
      : profile.annual_family_income || 0;
    return `
Annual Family Income: $${income}
Savings Available: $${profile.savings_available || profile.current_savings || 0}
Outstanding Loans: $${profile.outstanding_loans || 0}
Max Loan Comfort: $${profile.max_loan_comfort || 40000}
Has Cosigner: ${profile.has_cosigner || false}
Target Country: ${(profile.target_countries || profile.preferred_countries || ['USA'])[0]}
Risk Appetite: ${profile.risk_appetite || 'moderate'}
    `.trim();
  }

  _fallback(profile, careerOutput, loanData) {
    const P = parseFloat(loanData?.requestedAmount || profile.max_loan_comfort || 40000);
    const annualRate = 0.095;
    const r = annualRate / 12;
    const n = 120;
    const emi = Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
    const entrySalary = careerOutput?.top_career_entry_salary_usd || 85000;
    const growthRate = 0.08;
    const taxRate = 0.25;

    const timeline = [1, 2, 3, 5, 7, 10].map(yr => {
      const gross = Math.round(entrySalary * Math.pow(1 + growthRate, yr - 1));
      const afterTax = Math.round(gross * (1 - taxRate));
      return { year: yr, gross_usd: gross, after_tax_usd: afterTax, emi_usd: emi, savings_usd: Math.round(afterTax * 0.2), net_usd: Math.round(afterTax - emi * 12 / 12 - afterTax * 0.2) };
    });

    const totalCost = P * 1.25;
    const cumulative5yr = timeline.slice(0, 4).reduce((s, t) => s + t.gross_usd, 0);
    const roiMultiple = parseFloat(((cumulative5yr - totalCost) / totalCost).toFixed(2));
    const dti = parseFloat(((emi * 12) / entrySalary).toFixed(3));

    return {
      agent: 'finance',
      total_education_cost_usd: Math.round(totalCost),
      tuition_usd: Math.round(P * 0.8),
      living_cost_2yr_usd: Math.round(P * 0.45),
      misc_costs_usd: Math.round(P * 0.05),
      loan_amount_usd: P,
      own_contribution_usd: Math.round(P * 0.2),
      monthly_emi_usd: emi,
      annual_emi_usd: emi * 12,
      loan_tenure_months: n,
      interest_rate_percent: 9.5,
      total_interest_paid_usd: Math.round(emi * n - P),
      total_repayment_usd: Math.round(emi * n),
      roi_multiple: roiMultiple,
      break_even_months: Math.round(totalCost / (entrySalary / 12 * 0.3)),
      payback_years: parseFloat((P / (entrySalary * 0.3)).toFixed(1)),
      net_present_value_usd: Math.round(cumulative5yr - totalCost * 1.15),
      debt_to_income_ratio: dti,
      emi_as_percent_of_salary: parseFloat(((emi / (entrySalary / 12)) * 100).toFixed(1)),
      financial_stress_level: dti < 0.2 ? 'low' : dti < 0.35 ? 'medium' : dti < 0.5 ? 'high' : 'critical',
      financial_stress_score: Math.round(Math.min(100, dti * 200)),
      salary_timeline_usd: timeline,
      cumulative_savings_5yr_usd: Math.round(timeline.slice(0, 4).reduce((s, t) => s + t.savings_usd, 0)),
      net_worth_5yr_usd: Math.round(cumulative5yr * 0.15 - P * 0.4),
      safe_loan_max_usd: Math.round(entrySalary * 1.5),
      loan_safety_verdict: dti < 0.2 ? 'safe' : dti < 0.35 ? 'borderline' : dti < 0.5 ? 'risky' : 'dangerous',
      tax_rate_assumed_percent: 25,
      country_considered: (profile.target_countries || ['USA'])[0],
      key_financial_risks: ['Job market timing', 'Currency risk'],
      financial_upsides: ['Strong earning potential', 'Fast payback'],
      reasoning: `Loan of $${P.toLocaleString()} at 9.5% results in EMI of $${emi}/month. With projected entry salary of $${entrySalary.toLocaleString()}, DTI is ${(dti * 100).toFixed(0)}%.`,
      confidence: 60,
    };
  }
}

module.exports = new FinanceAgent();
