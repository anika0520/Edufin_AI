// src/agents/decision.agent.js
// DECISION AGENT — The Central Brain. Synthesizes all agent outputs into a final verdict.
const aiProvider = require("../config/ai-provider");
const logger = require("../utils/logger");
const { redactProfile } = require("../utils/piiRedactor");

const DECISION_AGENT_PROMPT = `You are the MASTER DECISION AGENT — the Central Intelligence Brain of FutureFin AI.
You receive structured analysis from THREE specialist agents and produce ONE final, definitive verdict.

You do NOT repeat the agent data. You SYNTHESIZE it into wisdom.

CAREER AGENT OUTPUT:
{CAREER_OUTPUT}

FINANCE AGENT OUTPUT:
{FINANCE_OUTPUT}

RISK AGENT OUTPUT:
{RISK_OUTPUT}

STUDENT'S STATED GOAL:
{STUDENT_GOAL}

Your job: act like a world-class advisor who has analyzed thousands of student cases.
Be honest. Be specific. Be actionable. Be compassionate.

The final decision must be mathematically grounded and logically consistent with agent outputs.

Respond ONLY with valid JSON:
{
  "final_decision": "Recommended|Recommended with Conditions|Risky but Viable|Not Advisable at This Time",
  "decision_color": "green|yellow|orange|red",
  "confidence_score": 0,
  "verdict_headline": "One punchy sentence summarizing the verdict",
  "verdict_explanation": "3-4 sentences explaining WHY this decision was reached, citing specific numbers",

  "key_reasons": [
    {"reason": "specific reason", "impact": "positive|negative|neutral", "weight": "high|medium|low"},
    {"reason": "specific reason", "impact": "positive|negative|neutral", "weight": "high|medium|low"},
    {"reason": "specific reason", "impact": "positive|negative|neutral", "weight": "high|medium|low"}
  ],

  "composite_scores": {
    "career_score": 0,
    "financial_score": 0,
    "risk_score": 0,
    "overall_score": 0
  },

  "risk_summary": {
    "biggest_risk": "single biggest risk",
    "risk_level": "low|medium|high|critical",
    "risk_is_manageable": true,
    "risk_mitigation_possible": true
  },

  "financial_snapshot": {
    "monthly_emi_usd": 0,
    "emi_as_percent_of_salary": 0,
    "break_even_months": 0,
    "roi_multiple": 0,
    "financial_verdict": "Financially sound|Financially manageable|Financially strained|Financially dangerous"
  },

  "conditions": [
    "Condition student must meet before proceeding"
  ],

  "suggested_action": "One clear, specific action the student should take in the next 30 days",
  "action_timeline": [
    {"week": 1, "action": "specific action"},
    {"week": 2, "action": "specific action"},
    {"week": 4, "action": "specific action"},
    {"week": 8, "action": "specific action"},
    {"week": 12, "action": "specific action"}
  ],

  "alternative_paths": [
    {
      "path": "alternative option name",
      "why_consider": "when to consider this",
      "roi_difference": "better|similar|worse",
      "risk_difference": "lower|similar|higher"
    }
  ],

  "parent_summary": "2-3 sentences written for parents explaining the decision in simple terms with rupee amounts",
  "student_morale_message": "1-2 sentences of honest, warm encouragement or honest caution",

  "reasoning_chain": [
    "Step 1: Career analysis shows...",
    "Step 2: Financial analysis shows...",
    "Step 3: Risk analysis shows...",
    "Step 4: Synthesis conclusion..."
  ],

  "meta": {
    "agents_used": ["career", "finance", "risk"],
    "data_quality": "high|medium|low",
    "decision_type": "master_synthesis"
  }
}`;

class DecisionAgent {
  async synthesize(profile, careerOutput, financeOutput, riskOutput) {
    try {
      const careerStr = JSON.stringify({
        top_career: careerOutput.top_career,
        fit_score: careerOutput.career_fit_score,
        entry_salary: careerOutput.top_career_entry_salary_usd,
        market_demand: careerOutput.market_demand,
        automation_risk: careerOutput.automation_risk_level,
        job_offer_prob: careerOutput.job_offer_probability_12mo,
        salary_5yr: careerOutput.top_career_5yr_salary_usd,
        confidence: careerOutput.confidence,
      });

      const financeStr = JSON.stringify({
        loan_usd: financeOutput.loan_amount_usd,
        monthly_emi: financeOutput.monthly_emi_usd,
        dti_ratio: financeOutput.debt_to_income_ratio,
        emi_pct_salary: financeOutput.emi_as_percent_of_salary,
        roi_multiple: financeOutput.roi_multiple,
        break_even_months: financeOutput.break_even_months,
        payback_years: financeOutput.payback_years,
        stress_level: financeOutput.financial_stress_level,
        loan_safety: financeOutput.loan_safety_verdict,
        confidence: financeOutput.confidence,
      });

      const riskStr = JSON.stringify({
        composite_risk: riskOutput.composite_risk_score,
        risk_category: riskOutput.risk_category,
        dropout_prob: riskOutput.dropout_probability,
        underemployment_risk: riskOutput.underemployment_risk,
        recommendation: riskOutput.overall_recommendation,
        red_alerts: riskOutput.red_alerts?.length || 0,
        default_prob_5yr:
          riskOutput.risk_dimensions?.loan_default_risk
            ?.default_probability_5yr,
        confidence: riskOutput.confidence,
      });

      const studentGoal = `Target: ${(profile.target_countries || ["USA"])[0]}, Field: ${profile.major || profile.field_of_study || "Technology"}, Budget: $${profile.max_loan_comfort || 40000} loan`;

      const result = await aiProvider.complete({
        systemPrompt: DECISION_AGENT_PROMPT.replace(
          "{CAREER_OUTPUT}",
          careerStr,
        )
          .replace("{FINANCE_OUTPUT}", financeStr)
          .replace("{RISK_OUTPUT}", riskStr)
          .replace("{STUDENT_GOAL}", studentGoal),
        messages: [
          {
            role: "user",
            content:
              "Synthesize all agent outputs and produce the final master decision.",
          },
        ],
        temperature: 0.35,
        maxTokens: 2500,
        jsonMode: true,
      });

      const parsed = aiProvider.parseJSON(result.content);

      // Ensure composite scores are populated from actual agent outputs
      parsed.composite_scores = {
        career_score:
          careerOutput.career_fit_score ||
          parsed.composite_scores?.career_score ||
          0,
        financial_score: Math.round(
          Math.max(0, 100 - (financeOutput.financial_stress_score || 0)),
        ),
        risk_score: Math.round(
          Math.max(0, 100 - (riskOutput.composite_risk_score || 50)),
        ),
        overall_score:
          parsed.composite_scores?.overall_score ||
          this._computeOverall(careerOutput, financeOutput, riskOutput),
      };

      // Ensure financial snapshot is accurate
      parsed.financial_snapshot = {
        monthly_emi_usd:
          financeOutput.monthly_emi_usd ||
          parsed.financial_snapshot?.monthly_emi_usd ||
          0,
        emi_as_percent_of_salary:
          financeOutput.emi_as_percent_of_salary ||
          parsed.financial_snapshot?.emi_as_percent_of_salary ||
          0,
        break_even_months:
          financeOutput.break_even_months ||
          parsed.financial_snapshot?.break_even_months ||
          0,
        roi_multiple:
          financeOutput.roi_multiple ||
          parsed.financial_snapshot?.roi_multiple ||
          0,
        financial_verdict:
          parsed.financial_snapshot?.financial_verdict ||
          "Financially manageable",
      };

      logger.info("DecisionAgent synthesized final verdict", {
        decision: parsed.final_decision,
        score: parsed.composite_scores.overall_score,
        confidence: parsed.confidence_score,
      });

      return { ...parsed, agent: "decision" };
    } catch (err) {
      logger.error("DecisionAgent error:", err.message);
      return this._fallback(profile, careerOutput, financeOutput, riskOutput);
    }
  }

  _computeOverall(career, finance, risk) {
    const careerScore = career.career_fit_score || 70;
    const financeScore = Math.max(
      0,
      100 - (finance.financial_stress_score || 40),
    );
    const riskScore = Math.max(0, 100 - (risk.composite_risk_score || 45));
    return Math.round(
      careerScore * 0.35 + financeScore * 0.4 + riskScore * 0.25,
    );
  }

  _fallback(profile, career, finance, risk) {
    const overall = this._computeOverall(career, finance, risk);
    const decision =
      overall >= 72
        ? "Recommended"
        : overall >= 58
          ? "Recommended with Conditions"
          : overall >= 42
            ? "Risky but Viable"
            : "Not Advisable at This Time";

    const color =
      overall >= 72
        ? "green"
        : overall >= 58
          ? "yellow"
          : overall >= 42
            ? "orange"
            : "red";

    const usdInr = parseInt(process.env.USD_TO_INR_RATE || 83);
    const emiInr = Math.round((finance.monthly_emi_usd || 800) * usdInr);

    return {
      agent: "decision",
      final_decision: decision,
      decision_color: color,
      confidence_score: Math.round(60 + overall * 0.3),
      verdict_headline: `${decision}: Overall score ${overall}/100`,
      verdict_explanation: `Based on career fit of ${career.career_fit_score}%, EMI of $${finance.monthly_emi_usd}/month (${finance.emi_as_percent_of_salary}% of salary), and composite risk score of ${risk.composite_risk_score}/100. ${overall >= 60 ? "This plan is financially viable with manageable risk." : "Significant risks require mitigation before proceeding."}`,
      key_reasons: [
        {
          reason: `Career fit score: ${career.career_fit_score}%`,
          impact: career.career_fit_score > 70 ? "positive" : "negative",
          weight: "high",
        },
        {
          reason: `EMI is ${finance.emi_as_percent_of_salary}% of projected salary`,
          impact:
            finance.emi_as_percent_of_salary < 30 ? "positive" : "negative",
          weight: "high",
        },
        {
          reason: `Risk level: ${risk.risk_category}`,
          impact:
            risk.risk_category === "low"
              ? "positive"
              : risk.risk_category === "critical"
                ? "negative"
                : "neutral",
          weight: "medium",
        },
      ],
      composite_scores: {
        career_score: career.career_fit_score || 70,
        financial_score: Math.max(
          0,
          100 - (finance.financial_stress_score || 40),
        ),
        risk_score: Math.max(0, 100 - (risk.composite_risk_score || 45)),
        overall_score: overall,
      },
      risk_summary: {
        biggest_risk: risk.red_alerts?.[0]?.alert || "Job market timing",
        risk_level: risk.risk_category || "medium",
        risk_is_manageable: risk.composite_risk_score < 70,
        risk_mitigation_possible: true,
      },
      financial_snapshot: {
        monthly_emi_usd: finance.monthly_emi_usd || 0,
        emi_as_percent_of_salary: finance.emi_as_percent_of_salary || 0,
        break_even_months: finance.break_even_months || 0,
        roi_multiple: finance.roi_multiple || 0,
        financial_verdict:
          finance.financial_stress_level === "low"
            ? "Financially sound"
            : finance.financial_stress_level === "medium"
              ? "Financially manageable"
              : "Financially strained",
      },
      conditions:
        overall < 72
          ? [
              "Secure a clear financial backup plan",
              "Get admission to a target school first",
            ]
          : [],
      suggested_action:
        overall >= 60
          ? "Start university applications for your target country within 30 days"
          : "Complete detailed financial planning and explore scholarship options first",
      action_timeline: [
        {
          week: 1,
          action: "Review this analysis with family and financial advisor",
        },
        { week: 2, action: "Begin scholarship and financial aid applications" },
        {
          week: 4,
          action: "Submit university applications to 3-5 target schools",
        },
        { week: 8, action: "Research and apply to education loan providers" },
        {
          week: 12,
          action: "Finalize university choice and confirm loan terms",
        },
      ],
      alternative_paths: [
        {
          path: "Study in India (IIT/NIT)",
          why_consider: "If loan burden is too high",
          roi_difference: "similar",
          risk_difference: "lower",
        },
        {
          path: "Work 1-2 years first",
          why_consider: "To build savings and experience",
          roi_difference: "similar",
          risk_difference: "lower",
        },
      ],
      parent_summary: `Your child's plan has an overall score of ${overall}/100. Monthly loan repayment would be approximately ₹${emiInr.toLocaleString("en-IN")}. ${overall >= 60 ? "This appears financially manageable based on projected salary." : "We recommend exploring lower-cost options or scholarships first."}`,
      student_morale_message:
        overall >= 70
          ? "Your profile is strong — this is a well-calculated bet on your future. Go for it with your eyes open."
          : "Every dream has risk. The key is knowing your risks clearly and having a plan — which you now do.",
      reasoning_chain: [
        `Career: ${career.top_career} with ${career.career_fit_score}% fit and $${career.top_career_entry_salary_usd} entry salary`,
        `Finance: $${finance.loan_amount_usd} loan, $${finance.monthly_emi_usd}/mo EMI, ${finance.emi_as_percent_of_salary}% DTI`,
        `Risk: ${risk.composite_risk_score}/100 composite risk, ${risk.risk_category} category`,
        `Synthesis: Overall ${overall}/100 → ${decision}`,
      ],
      meta: {
        agents_used: ["career", "finance", "risk"],
        data_quality: "medium",
        decision_type: "master_synthesis",
      },
    };
  }
}

module.exports = new DecisionAgent();
