// src/modules/future-simulation/future-simulation.service.js
// ⚡ FUTURE SIMULATION ENGINE — AI Life Decision Simulator
// Simulates: "What if I go to Canada vs India?", "What if I fail to get a job for 6 months?"

const { query } = require("../../database/connection");
const { cache } = require("../../config/redis");
const aiProvider = require("../../config/ai-provider");
const userIntelligenceService = require("../user-intelligence/user-intelligence.service");
const logger = require("../../utils/logger");

const SIMULATION_PROMPT = `You are FutureFin's Life Decision Simulator — an elite financial + career analyst.
Simulate the student's life outcome under a specific "What If" scenario.

STUDENT PROFILE:
{PROFILE_DATA}

BASE PLAN (current plan):
{BASE_PLAN}

SIMULATION SCENARIO:
Type: {SCENARIO_TYPE}
Parameters: {SCENARIO_PARAMS}

Generate a detailed life simulation comparing the BASE PLAN vs the SIMULATED SCENARIO.
Be realistic, specific, and compassionate. Think like a trusted mentor, not a robot.

Respond ONLY with valid JSON:
{
  "scenario_name": "descriptive name of what-if scenario",
  "scenario_summary": "2-sentence plain English summary of what this simulation covers",
  "base_plan": {
    "label": "Current Plan",
    "country": "",
    "salary_timeline": [
      {"year": 1, "salary_usd": 0, "label": "First Job"},
      {"year": 3, "salary_usd": 0, "label": "Mid Level"},
      {"year": 5, "salary_usd": 0, "label": "Senior"},
      {"year": 10, "salary_usd": 0, "label": "Peak"}
    ],
    "loan_repayment_stress": "low|medium|high",
    "loan_stress_explanation": "plain English",
    "cumulative_savings_5yr_usd": 0,
    "break_even_months": 0,
    "life_satisfaction_score": 0,
    "stress_level": "low|medium|high",
    "key_outcomes": ["outcome1", "outcome2", "outcome3"]
  },
  "simulated_plan": {
    "label": "What If Scenario",
    "country": "",
    "salary_timeline": [
      {"year": 1, "salary_usd": 0, "label": "First Job"},
      {"year": 3, "salary_usd": 0, "label": "Mid Level"},
      {"year": 5, "salary_usd": 0, "label": "Senior"},
      {"year": 10, "salary_usd": 0, "label": "Peak"}
    ],
    "loan_repayment_stress": "low|medium|high",
    "loan_stress_explanation": "plain English",
    "cumulative_savings_5yr_usd": 0,
    "break_even_months": 0,
    "life_satisfaction_score": 0,
    "stress_level": "low|medium|high",
    "key_outcomes": ["outcome1", "outcome2", "outcome3"]
  },
  "comparison": {
    "winner": "base|simulated|tie",
    "winner_reason": "clear plain English explanation of which path is better and why",
    "financial_difference_5yr_usd": 0,
    "risk_difference": "simulated is riskier|base is riskier|similar risk",
    "key_tradeoffs": ["tradeoff1", "tradeoff2"],
    "hidden_factors": ["factor1", "factor2"]
  },
  "mentor_advice": "3-4 sentences of warm, honest mentor-level advice. Not robotic. Real talk.",
  "probability_of_success_base": 0,
  "probability_of_success_simulated": 0,
  "confidence_score": 0
}`;

const SCENARIO_TYPES = {
  country_comparison: "Compare studying/working in two different countries",
  job_delay: "What if job search takes longer than expected",
  salary_drop: "What if starting salary is lower than projected",
  loan_default_risk: "What if unable to repay loan on time",
  career_switch: "What if switching to a different career path",
  scholarship_received: "What if a scholarship is received",
  part_time_study: "What if studying part-time while working",
  dropout_recovery: "What if taking a gap year or temporary dropout",
  startup_vs_job: "What if starting a business vs taking a job",
  masters_vs_work: "What if skipping masters and working directly",
};

class FutureSimulationService {
  async runSimulation(userId, { scenarioType, scenarioParams, baseRoiId }) {
    const profile = await userIntelligenceService.getFullProfile(userId);
    if (!profile) throw new Error("Profile not found");

    // Build base plan context
    let basePlanData = "No specific base plan — using profile defaults";
    if (baseRoiId) {
      const roiRes = await query(
        "SELECT * FROM roi_analyses WHERE id = $1 AND user_id = $2",
        [baseRoiId, userId],
      );
      if (roiRes.rows.length) {
        const roi = roiRes.rows[0];
        basePlanData = `University: ${roi.university_name || "Selected University"} | Total Cost: $${roi.total_cost_usd} | Year-1 Salary: $${roi.year1_salary_usd} | ROI Score: ${roi.roi_score} | Risk: ${roi.risk_category}`;
      }
    }

    // Get career data
    const careerRes = await query(
      "SELECT * FROM career_recommendations WHERE user_id = $1 AND is_active = TRUE ORDER BY rank LIMIT 1",
      [userId],
    );
    const career = careerRes.rows[0];

    const profileData = `
Student from: ${profile.current_country || "India"} | Target Countries: ${(profile.target_countries || []).join(", ") || "USA, Canada"}
GPA: ${profile.gpa || "N/A"} | Field: ${profile.major || "Technology"} | Work Experience: ${profile.work_experience_months || 0} months
Family Income: ${profile.family_income_bracket || "middle"} bracket | Savings: $${profile.savings_available || 0}
Risk Appetite: ${profile.risk_appetite || "moderate"} | Target Career: ${career?.career_title || "Software Engineer"}
Entry Salary Projected: $${career?.entry_salary_usd || 80000} | Senior Salary: $${career?.senior_salary_usd || 150000}
    `.trim();

    const scenarioDescription = SCENARIO_TYPES[scenarioType] || scenarioType;

    const result = await aiProvider.complete({
      systemPrompt: SIMULATION_PROMPT.replace("{PROFILE_DATA}", profileData)
        .replace("{BASE_PLAN}", basePlanData)
        .replace("{SCENARIO_TYPE}", scenarioDescription)
        .replace("{SCENARIO_PARAMS}", JSON.stringify(scenarioParams)),
      messages: [{ role: "user", content: "Run the life simulation now." }],
      temperature: 0.3,
      maxTokens: 2500,
      jsonMode: true,
    });

    const simulation = aiProvider.parseJSON(result.content);

    // Persist simulation
    await query(
      `INSERT INTO simulations (user_id, simulation_type, input_parameters, result, baseline_roi_score, simulated_roi_score, recommendation)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        `future_sim_${scenarioType}`,
        JSON.stringify({ scenarioParams, baseRoiId }),
        JSON.stringify(simulation),
        simulation.probability_of_success_base,
        simulation.probability_of_success_simulated,
        simulation.mentor_advice,
      ],
    );

    return {
      simulation,
      scenarioType,
      availableScenarios: Object.entries(SCENARIO_TYPES).map(([key, desc]) => ({
        key,
        description: desc,
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  async getSimulationHistory(userId) {
    const res = await query(
      `SELECT id, simulation_type, input_parameters, result, baseline_roi_score, simulated_roi_score, recommendation, created_at
       FROM simulations WHERE user_id = $1 AND simulation_type LIKE 'future_sim_%' ORDER BY created_at DESC LIMIT 20`,
      [userId],
    );
    return res.rows.map((r) => ({
      ...r,
      input_parameters: r.input_parameters,
      result: r.result,
    }));
  }

  async compareCountries(
    userId,
    { countryA, countryB, universityA, universityB },
  ) {
    return this.runSimulation(userId, {
      scenarioType: "country_comparison",
      scenarioParams: {
        country_a: countryA,
        country_b: countryB,
        university_a: universityA,
        university_b: universityB,
        description: `Comparing life outcomes: ${countryA} (${universityA || "local university"}) vs ${countryB} (${universityB || "local university"})`,
      },
    });
  }
}

module.exports = new FutureSimulationService();
