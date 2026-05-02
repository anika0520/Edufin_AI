// src/modules/decision/decision.service.js
// ⚡ CENTRAL BRAIN — Master Decision Engine
// Orchestrates all agents, runs the full multi-agent pipeline,
// and outputs ONE comprehensive verdict.

const { query } = require("../../database/connection");
const { cache } = require("../../config/redis");
const userIntelligenceService = require("../user-intelligence/user-intelligence.service");
const careerAgent = require("../../agents/career.agent");
const financeAgent = require("../../agents/finance.agent");
const riskAgent = require("../../agents/risk.agent");
const decisionAgent = require("../../agents/decision.agent");
const logger = require("../../utils/logger");

const USD_INR = () => parseInt(process.env.USD_TO_INR_RATE || 83);

class DecisionService {
  /**
   * THE MAIN ENDPOINT — POST /api/v1/analyze
   * Runs the complete multi-agent pipeline and returns everything in one response.
   */
  async runFullAnalysis(userId, inputData = {}) {
    const cacheKey = `full_analysis:${userId}`;
    if (!inputData.forceRefresh) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        logger.info("Full analysis served from cache", { userId });
        return { ...cached, fromCache: true };
      }
    }

    logger.info("Starting full multi-agent analysis pipeline", { userId });
    const startTime = Date.now();

    // ── Step 1: Load student profile ─────────────────────────────────────────
    const profile = await userIntelligenceService.getFullProfile(userId);
    if (!profile)
      throw new Error(
        "Student profile not found. Please complete your profile first.",
      );

    // Merge any inline input (for quick analyze without full profile)
    const mergedProfile = this._mergeProfileWithInput(profile, inputData);

    // ── Step 2: Load existing agent outputs (if any) ──────────────────────────
    const [existingCareer, existingLoan] = await Promise.all([
      query(
        "SELECT * FROM career_recommendations WHERE user_id = $1 AND is_active = TRUE ORDER BY rank LIMIT 3",
        [userId],
      ),
      query(
        "SELECT * FROM loan_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        [userId],
      ),
    ]);

    const existingCareerData = existingCareer.rows.length
      ? {
          careers: existingCareer.rows.map((r) => ({
            career_title: r.career_title,
            probability_score: r.probability_score,
            entry_salary_usd: r.entry_salary_usd,
            senior_salary_usd: r.senior_salary_usd,
          })),
        }
      : null;

    // ── Step 3: Run Career Agent ──────────────────────────────────────────────
    logger.info("Running Career Agent...", { userId });
    const careerOutput = await careerAgent.evaluate(
      mergedProfile,
      existingCareerData,
    );

    // ── Step 4: Run Finance Agent ─────────────────────────────────────────────
    logger.info("Running Finance Agent...", { userId });
    const loanData = {
      requestedAmount:
        inputData.requestedLoanAmount ||
        mergedProfile.max_loan_comfort ||
        40000,
      tuition: inputData.tuitionUsd,
      livingCost: inputData.livingCostUsd,
    };
    const financeOutput = await financeAgent.evaluate(
      mergedProfile,
      careerOutput,
      loanData,
    );

    // ── Step 5: Run Risk Agent ────────────────────────────────────────────────
    logger.info("Running Risk Agent...", { userId });
    const riskOutput = await riskAgent.evaluate(
      mergedProfile,
      financeOutput,
      careerOutput,
    );

    // ── Step 6: Run Decision Agent (Master Brain) ─────────────────────────────
    logger.info("Running Decision Agent (Central Brain)...", { userId });
    const decisionOutput = await decisionAgent.synthesize(
      mergedProfile,
      careerOutput,
      financeOutput,
      riskOutput,
    );

    // ── Step 7: Build complete response ──────────────────────────────────────
    const inrRate = USD_INR();
    const response = this._buildFullResponse(
      mergedProfile,
      careerOutput,
      financeOutput,
      riskOutput,
      decisionOutput,
      inrRate,
    );

    // ── Step 8: Persist to DB ─────────────────────────────────────────────────
    await this._persistAnalysis(userId, response);

    // ── Step 9: Cache ─────────────────────────────────────────────────────────
    await cache.set(cacheKey, response, 3600 * 6); // 6 hours

    const elapsed = Date.now() - startTime;
    logger.info(`Full analysis pipeline completed in ${elapsed}ms`, {
      userId,
      decision: response.finalDecision.verdict,
    });

    return response;
  }

  /**
   * Quick analyze — accepts full profile inline, no DB profile required.
   * Used by the frontend when backend is up but user hasn't built a full profile.
   */
  async quickAnalyze(inputData) {
    const syntheticProfile = {
      first_name: inputData.name?.split(" ")[0] || "Student",
      last_name: inputData.name?.split(" ").slice(1).join(" ") || "",
      highest_education: inputData.education || "Bachelor's",
      major: inputData.field || "Computer Science",
      field_of_study: inputData.field || "Computer Science",
      gpa: inputData.gpa || 3.5,
      current_gpa: inputData.gpa || 3.5,
      work_experience_months: inputData.workExperienceMonths || 0,
      technical_skills: inputData.skills || [],
      soft_skills: [],
      interests: inputData.interests || [],
      annual_family_income: inputData.familyIncome || 50000,
      monthly_family_income: Math.round((inputData.familyIncome || 50000) / 12),
      savings_available: inputData.savings || 10000,
      current_savings: inputData.savings || 10000,
      max_loan_comfort: inputData.loanCapacity || 40000,
      outstanding_loans: 0,
      has_cosigner: false,
      target_countries: inputData.targetCountries || ["USA"],
      preferred_countries: inputData.targetCountries || ["USA"],
      risk_appetite: inputData.riskAppetite || "moderate",
      profile_completeness: 60,
    };

    const careerOutput = await careerAgent.evaluate(syntheticProfile, null);
    const loanData = {
      requestedAmount: inputData.loanCapacity || 40000,
      tuition: inputData.tuitionUsd,
      livingCost: inputData.livingCostUsd,
    };
    const financeOutput = await financeAgent.evaluate(
      syntheticProfile,
      careerOutput,
      loanData,
    );
    const riskOutput = await riskAgent.evaluate(
      syntheticProfile,
      financeOutput,
      careerOutput,
    );
    const decisionOutput = await decisionAgent.synthesize(
      syntheticProfile,
      careerOutput,
      financeOutput,
      riskOutput,
    );

    const inrRate = USD_INR();
    return this._buildFullResponse(
      syntheticProfile,
      careerOutput,
      financeOutput,
      riskOutput,
      decisionOutput,
      inrRate,
    );
  }

  _buildFullResponse(profile, career, finance, risk, decision, inrRate) {
    const toInr = (usd) => Math.round((usd || 0) * inrRate);

    return {
      // ── Final Decision ──────────────────────────────────────────────────────
      finalDecision: {
        verdict: decision.final_decision,
        color: decision.decision_color,
        confidence: decision.confidence_score,
        headline: decision.verdict_headline,
        explanation: decision.verdict_explanation,
        suggestedAction: decision.suggested_action,
        actionTimeline: decision.action_timeline || [],
        conditions: decision.conditions || [],
        alternativePaths: decision.alternative_paths || [],
        parentSummary: decision.parent_summary,
        studentMessage: decision.student_morale_message,
        reasoningChain: decision.reasoning_chain || [],
        keyReasons: decision.key_reasons || [],
      },

      // ── Composite Scores ────────────────────────────────────────────────────
      scores: {
        overall: decision.composite_scores?.overall_score || 0,
        career: decision.composite_scores?.career_score || 0,
        financial: decision.composite_scores?.financial_score || 0,
        risk: decision.composite_scores?.risk_score || 0,
        realityCheck: Math.round(100 - (risk.composite_risk_score || 50)),
        confidence: decision.confidence_score || 0,
      },

      // ── Career Intelligence ─────────────────────────────────────────────────
      career: {
        topCareer: career.top_career,
        fitScore: career.career_fit_score,
        marketDemand: career.market_demand,
        marketDemandScore: career.market_demand_score,
        entrySalaryUsd: career.top_career_entry_salary_usd,
        entrySalaryInr: toInr(career.top_career_entry_salary_usd),
        salary5yrUsd: career.top_career_5yr_salary_usd,
        salary5yrInr: toInr(career.top_career_5yr_salary_usd),
        automationRisk: career.automation_risk_level,
        automationRiskScore: career.automation_risk_score,
        jobOfferProbability: career.job_offer_probability_12mo,
        timeToFirstJob: career.time_to_first_job_months,
        globalOpenings: career.global_openings_estimate,
        yoyGrowth: career.yoy_growth_percent,
        skillGaps: career.top_skill_gaps || [],
        salaryGrowthCurve: (career.salary_growth_curve || []).map((p) => ({
          ...p,
          salary_inr: toInr(p.salary_usd),
        })),
        agentConfidence: career.confidence,
        agentFlags: career.flags || [],
      },

      // ── Financial Intelligence ──────────────────────────────────────────────
      finance: {
        totalCostUsd: finance.total_education_cost_usd,
        totalCostInr: toInr(finance.total_education_cost_usd),
        tuitionUsd: finance.tuition_usd,
        tuitionInr: toInr(finance.tuition_usd),
        livingCost2yrUsd: finance.living_cost_2yr_usd,
        livingCost2yrInr: toInr(finance.living_cost_2yr_usd),
        loanAmountUsd: finance.loan_amount_usd,
        loanAmountInr: toInr(finance.loan_amount_usd),
        monthlyEmiUsd: finance.monthly_emi_usd,
        monthlyEmiInr: toInr(finance.monthly_emi_usd),
        annualEmiUsd: finance.annual_emi_usd,
        annualEmiInr: toInr(finance.annual_emi_usd),
        interestRatePercent: finance.interest_rate_percent,
        tenureMonths: finance.loan_tenure_months,
        totalInterestPaidUsd: finance.total_interest_paid_usd,
        totalInterestPaidInr: toInr(finance.total_interest_paid_usd),
        totalRepaymentUsd: finance.total_repayment_usd,
        totalRepaymentInr: toInr(finance.total_repayment_usd),
        roiMultiple: finance.roi_multiple,
        breakEvenMonths: finance.break_even_months,
        paybackYears: finance.payback_years,
        npvUsd: finance.net_present_value_usd,
        npvInr: toInr(finance.net_present_value_usd),
        debtToIncomeRatio: finance.debt_to_income_ratio,
        emiAsPctSalary: finance.emi_as_percent_of_salary,
        stressLevel: finance.financial_stress_level,
        stressScore: finance.financial_stress_score,
        safetyVerdict: finance.loan_safety_verdict,
        safeLoanMaxUsd: finance.safe_loan_max_usd,
        safeLoanMaxInr: toInr(finance.safe_loan_max_usd),
        salaryTimeline: (finance.salary_timeline_usd || []).map((t) => ({
          ...t,
          gross_inr: toInr(t.gross_usd),
          after_tax_inr: toInr(t.after_tax_usd),
          emi_inr: toInr(t.emi_usd),
          savings_inr: toInr(t.savings_usd),
          net_inr: toInr(t.net_usd),
        })),
        cumulativeSavings5yrInr: toInr(finance.cumulative_savings_5yr_usd),
        netWorth5yrInr: toInr(finance.net_worth_5yr_usd),
        financialRisks: finance.key_financial_risks || [],
        financialUpsides: finance.financial_upsides || [],
        agentConfidence: finance.confidence,
      },

      // ── Risk Intelligence ───────────────────────────────────────────────────
      risk: {
        compositeScore: risk.composite_risk_score,
        category: risk.risk_category,
        summary: risk.risk_summary,
        dimensions: risk.risk_dimensions || {},
        dropoutProbability: risk.dropout_probability,
        underemploymentRisk: risk.underemployment_risk,
        jobSearchDelayMonths: risk.job_search_delay_months_expected,
        redAlerts: risk.red_alerts || [],
        yellowWarnings: risk.yellow_warnings || [],
        greenLights: risk.green_lights || [],
        scenarioDeltas: risk.scenario_risk_deltas || {},
        overallRecommendation: risk.overall_recommendation,
        agentConfidence: risk.confidence,
      },

      // ── Risk Summary (for Decision card) ────────────────────────────────────
      riskSummary: decision.risk_summary || {},

      // ── Financial Snapshot (for Decision card) ──────────────────────────────
      financialSnapshot: {
        ...decision.financial_snapshot,
        monthly_emi_inr: toInr(decision.financial_snapshot?.monthly_emi_usd),
      },

      // ── Meta ────────────────────────────────────────────────────────────────
      meta: {
        agentsRun: ["career", "finance", "risk", "decision"],
        studentName:
          `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
          "Student",
        targetCountry: (profile.target_countries ||
          profile.preferred_countries || ["USA"])[0],
        usdInrRate: inrRate,
        generatedAt: new Date().toISOString(),
        pipelineVersion: "2.0",
        disclaimer:
          "FutureFin AI provides probabilistic analysis — not guarantees. Always consult qualified professionals.",
      },
    };
  }

  async _persistAnalysis(userId, response) {
    try {
      await query(
        `INSERT INTO ai_decision_log (user_id, decision_type, model_used, confidence_score, reasoning)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          "master_analysis",
          "multi_agent_pipeline",
          response.finalDecision.confidence,
          response.finalDecision.explanation?.substring(0, 500),
        ],
      );
    } catch (e) {
      logger.warn("Failed to persist analysis to DB (non-fatal):", e.message);
    }
  }

  _mergeProfileWithInput(profile, input) {
    const merged = { ...profile };
    if (input.field) merged.field_of_study = input.field;
    if (input.gpa) merged.gpa = input.gpa;
    if (input.skills?.length) merged.technical_skills = input.skills;
    if (input.interests?.length) merged.interests = input.interests;
    if (input.familyIncome) merged.annual_family_income = input.familyIncome;
    if (input.savings) merged.savings_available = input.savings;
    if (input.loanCapacity) merged.max_loan_comfort = input.loanCapacity;
    if (input.targetCountries?.length)
      merged.target_countries = input.targetCountries;
    if (input.riskAppetite) merged.risk_appetite = input.riskAppetite;
    return merged;
  }

  /**
   * Lightweight GET /api/v1/decision — loads latest cached analysis for a user
   */
  async getLatestDecision(userId) {
    const cached = await cache.get(`full_analysis:${userId}`);
    if (cached) return { ...cached, fromCache: true };

    // Try DB fallback
    const [decisionLog, careerRec] = await Promise.all([
      query(
        "SELECT * FROM ai_decision_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        [userId],
      ),
      query(
        "SELECT * FROM career_recommendations WHERE user_id = $1 AND is_active = TRUE ORDER BY rank LIMIT 1",
        [userId],
      ),
    ]);

    if (!decisionLog.rows.length) return null;

    return {
      partial: true,
      latestDecision: decisionLog.rows[0],
      topCareer: careerRec.rows[0] || null,
      message: "Run POST /api/v1/analyze for a fresh full analysis",
    };
  }
}

module.exports = new DecisionService();
