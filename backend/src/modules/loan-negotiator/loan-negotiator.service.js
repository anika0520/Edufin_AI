// src/modules/loan-negotiator/loan-negotiator.service.js
// ⚡ AI LOAN NEGOTIATOR — Not just eligibility, but optimal loan STRATEGY
// Suggests: better loan structure, lower interest, EMI optimization, ISA alternatives

const { query } = require("../../database/connection");
const { cache } = require("../../config/redis");
const aiProvider = require("../../config/ai-provider");
const userIntelligenceService = require("../user-intelligence/user-intelligence.service");
const logger = require("../../utils/logger");

const LOAN_NEGOTIATOR_PROMPT = `You are FutureFin's AI Loan Negotiation Strategist.
You are NOT a basic loan eligibility checker. You are a FINANCIAL STRATEGIST who helps students
get the BEST possible loan deal — minimum amount, optimal terms, lowest risk.

Your philosophy: "Take the minimum loan needed. Pay it off fastest. Minimize life stress."

STUDENT PROFILE:
{PROFILE_DATA}

LOAN REQUEST & FINANCIAL CONTEXT:
{LOAN_DATA}

ROI ANALYSIS:
{ROI_DATA}

RISK CONTEXT:
{RISK_DATA}

Generate a comprehensive loan negotiation strategy. Think like a financial advisor who genuinely
cares about this student's long-term wellbeing, not just approving the loan.

Respond ONLY with valid JSON:
{
  "negotiation_summary": "2-3 sentence executive summary of the optimal strategy",

  "optimal_loan_strategy": {
    "recommended_loan_amount_usd": 0,
    "vs_requested_amount_usd": 0,
    "savings_vs_requested_usd": 0,
    "risk_reduction_percent": 0,
    "reasoning": "Why this amount is optimal — plain English",

    "loan_structure": {
      "type": "fixed|variable|hybrid|ISA",
      "interest_rate_target": 0.0,
      "interest_rate_achievable": 0.0,
      "loan_term_months": 0,
      "moratorium_months": 0,
      "emi_usd": 0,
      "emi_as_percent_of_expected_salary": 0.0
    }
  },

  "negotiation_tactics": [
    {
      "tactic": "Tactic name",
      "description": "How to use this",
      "potential_saving_usd": 0,
      "difficulty": "easy|medium|hard",
      "priority": "high|medium|low"
    }
  ],

  "emi_optimization": {
    "standard_emi": 0,
    "optimized_emi": 0,
    "monthly_savings_usd": 0,
    "strategies": [
      "Step-up EMI: Pay less initially, more as salary grows",
      "Other strategy"
    ],
    "early_repayment_benefit": "If you pay X extra/month, you save Y in interest over Z years"
  },

  "alternative_financing": [
    {
      "option": "Income Share Agreement (ISA)",
      "description": "Pay X% of salary for Y years instead of a fixed loan",
      "pros": ["pro1", "pro2"],
      "cons": ["con1"],
      "suitable_if": "When this option makes sense"
    },
    {
      "option": "Partial Scholarship + Smaller Loan",
      "description": "Apply for scholarships to reduce loan burden",
      "pros": ["Zero interest on scholarship portion"],
      "cons": ["Competitive, uncertain"],
      "suitable_if": "GPA above 3.5 and strong profile"
    }
  ],

  "interest_reduction_playbook": {
    "current_rate_estimate": 0.0,
    "achievable_rate_with_negotiation": 0.0,
    "savings_on_lower_rate_usd": 0,
    "how_to_negotiate": [
      "Step 1: Get pre-approved from 3 lenders",
      "Step 2: Use offers as leverage",
      "Step 3: Highlight ROI analysis"
    ]
  },

  "loan_safety_check": {
    "is_loan_safe": true,
    "safe_threshold_emi_usd": 0,
    "current_emi_vs_threshold": "comfortable|at limit|over limit",
    "safety_message": "plain English assessment",
    "danger_scenario": "If salary is X% lower than expected, EMI becomes Y% of income — this is the risk."
  },

  "mentor_negotiation_advice": "3-4 sentences of real-world loan negotiation advice. Practical. Like a CA uncle guiding you.",
  "top_3_actions": ["action1", "action2", "action3"],
  "confidence_score": 0
}`;

class LoanNegotiatorService {
  async generateNegotiationStrategy(
    userId,
    { requestedAmount, universityRecommendationId, roiAnalysisId } = {},
  ) {
    const cacheKey = `loan_negotiation:${userId}:${requestedAmount}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const profile = await userIntelligenceService.getFullProfile(userId);
    if (!profile) throw new Error("Profile not found");

    const [careerRes, roiRes, loanRes] = await Promise.all([
      query(
        "SELECT * FROM career_recommendations WHERE user_id = $1 AND is_active = TRUE ORDER BY rank LIMIT 1",
        [userId],
      ),
      roiAnalysisId
        ? query("SELECT * FROM roi_analyses WHERE id = $1 AND user_id = $2", [
            roiAnalysisId,
            userId,
          ])
        : query(
            "SELECT * FROM roi_analyses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
            [userId],
          ),
      query(
        "SELECT * FROM loan_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        [userId],
      ),
    ]);

    const career = careerRes.rows[0];
    const roi = roiRes.rows[0];
    const existingLoan = loanRes.rows[0];

    const profileData = `
Student: ${profile.first_name || "Student"} | From: ${profile.current_country || "India"}
GPA: ${profile.gpa || "N/A"} | Major: ${profile.major || "N/A"}
Family Income: $${profile.annual_family_income || 0}/yr (${profile.family_income_bracket || "middle"} bracket)
Savings Available: $${profile.savings_available || 0}
Has Cosigner: ${profile.has_cosigner ? "Yes" : "No"} | Cosigner Income: $${profile.cosigner_income || 0}
Has Property: ${profile.has_property ? "Yes ($" + (profile.property_value || 0) + ")" : "No"}
Outstanding Loans: $${profile.outstanding_loans || 0}
Credit Score Proxy: ${profile.credit_score_proxy || "N/A"}
Risk Appetite: ${profile.risk_appetite || "moderate"}
    `.trim();

    const loanData = `
Requested Loan Amount: $${requestedAmount || 0}
Purpose: Education (Tuition + Living)
Existing Loan Assessment: ${existingLoan ? `Score: ${existingLoan.eligibility_score}%, Suggested: $${existingLoan.suggested_amount_usd}, Risk: ${existingLoan.risk_category}` : "None yet"}
Target Country: ${(profile.target_countries || ["USA"])[0]}
Target Degree: ${profile.target_degree || "Master"}
Expected Program Duration: 2 years
    `.trim();

    const roiData = roi
      ? `ROI Score: ${roi.roi_score} | Total Cost: $${roi.total_cost_usd} | Break-even: ${roi.break_even_months} months | Year-5 Salary: $${roi.year5_salary_usd} | Risk: ${roi.risk_category}`
      : "ROI analysis not yet calculated";

    const riskData = `
Career Match: ${career ? `${career.career_title}, ${career.probability_score}% probability, Entry Salary: $${career.entry_salary_usd}` : "Not assessed"}
Market Demand: ${career ? `${career.yoy_growth_percent}% YoY growth, ${career.global_job_openings || "N/A"} openings` : "N/A"}
Automation Risk: ${career?.automation_risk || "N/A"}
    `.trim();

    const result = await aiProvider.complete({
      systemPrompt: LOAN_NEGOTIATOR_PROMPT.replace(
        "{PROFILE_DATA}",
        profileData,
      )
        .replace("{LOAN_DATA}", loanData)
        .replace("{ROI_DATA}", roiData)
        .replace("{RISK_DATA}", riskData),
      messages: [
        { role: "user", content: "Generate the loan negotiation strategy." },
      ],
      temperature: 0.2,
      maxTokens: 2500,
      jsonMode: true,
    });

    const strategy = aiProvider.parseJSON(result.content);

    const finalResult = {
      strategy,
      requestedAmount,
      generatedAt: new Date().toISOString(),
    };

    await cache.set(cacheKey, finalResult, 3600 * 4);
    return finalResult;
  }

  async compareLoansScenarios(userId, scenarios) {
    // scenarios: [{amount, term, rate, label}]
    const results = scenarios.map((s) => {
      const monthlyRate = s.rate / 100 / 12;
      const n = s.term;
      const emi =
        (s.amount * (monthlyRate * Math.pow(1 + monthlyRate, n))) /
        (Math.pow(1 + monthlyRate, n) - 1);
      const totalPayment = emi * n;
      const totalInterest = totalPayment - s.amount;
      return {
        label: s.label,
        amount: s.amount,
        term: s.term,
        rate: s.rate,
        emi: Math.round(emi),
        total_payment: Math.round(totalPayment),
        total_interest: Math.round(totalInterest),
        interest_to_principal_ratio: (totalInterest / s.amount).toFixed(2),
      };
    });
    return { scenarios: results, generatedAt: new Date().toISOString() };
  }
}

module.exports = new LoanNegotiatorService();
