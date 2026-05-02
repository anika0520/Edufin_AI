// src/modules/digital-twin/digital-twin.service.js
// ⚡ STUDENT DIGITAL TWIN — Virtual model of the student
// Evolves based on skills, decisions, risk. Simulates career growth & financial health.

const { query } = require("../../database/connection");
const { cache } = require("../../config/redis");
const aiProvider = require("../../config/ai-provider");
const userIntelligenceService = require("../user-intelligence/user-intelligence.service");
const logger = require("../../utils/logger");

const DIGITAL_TWIN_PROMPT = `You are FutureFin's Digital Twin Engine.
Create a living virtual model of this student — a "Digital Twin" that represents who they are TODAY
and projects who they WILL BECOME based on their choices.

STUDENT PROFILE:
{PROFILE_DATA}

DECISIONS MADE SO FAR:
{DECISIONS_DATA}

Build the student's Digital Twin — a comprehensive virtual simulation of their life trajectory.
Think of this as creating a "SimStudent" — alive, evolving, probabilistic.

Respond ONLY with valid JSON:
{
  "twin_id": "unique identifier",
  "twin_name": "FutureFin Digital Twin of {name}",
  "created_at": "ISO timestamp",

  "current_state": {
    "skills_score": 0,
    "academic_strength": 0,
    "financial_health_score": 0,
    "career_readiness": 0,
    "risk_exposure": 0,
    "overall_potential_score": 0,
    "personality_archetype": "The Builder|The Explorer|The Analyst|The Leader|The Creator|The Strategist",
    "strengths": ["strength1", "strength2", "strength3"],
    "vulnerabilities": ["vulnerability1", "vulnerability2"]
  },

  "life_trajectory": {
    "age_now": 22,
    "milestones": [
      {
        "year_from_now": 0,
        "age": 22,
        "event": "Starts Master's Program",
        "financial_status": "$X savings, $Y loan",
        "career_status": "Student",
        "skill_level": "intermediate",
        "stress_level": "medium",
        "financial_health_score": 0,
        "career_score": 0
      }
    ]
  },

  "financial_twin": {
    "current_net_worth_usd": 0,
    "projected_net_worth_1yr_usd": 0,
    "projected_net_worth_3yr_usd": 0,
    "projected_net_worth_5yr_usd": 0,
    "projected_net_worth_10yr_usd": 0,
    "debt_free_date": "YYYY",
    "first_home_possible_year": "YYYY",
    "financial_independence_year": "YYYY",
    "financial_trajectory": "ascending|volatile|risky|stable"
  },

  "career_twin": {
    "current_career_level": "Student|Entry|Mid|Senior|Expert",
    "projected_career_1yr": "First Job - X Role",
    "projected_career_3yr": "Mid-Level - X Role",
    "projected_career_5yr": "Senior - X Role",
    "projected_career_10yr": "Leadership / Expert - X Role",
    "career_peak_salary_usd": 0,
    "career_trajectory": "rocket|steady|slow|pivot_needed",
    "unique_career_edge": "What makes this student uniquely valuable"
  },

  "risk_profile": {
    "financial_risk_score": 0,
    "career_risk_score": 0,
    "loan_risk_score": 0,
    "dropout_risk_score": 0,
    "overall_risk_score": 0,
    "risk_evolution": "Risks will increase/decrease as... plain English"
  },

  "twin_insights": [
    {
      "insight": "Key insight about this student's unique situation",
      "category": "financial|career|academic|personal",
      "urgency": "immediate|soon|long_term"
    }
  ],

  "evolution_triggers": [
    {
      "event": "If student gets a scholarship",
      "impact": "Twin's financial health score increases by X points",
      "probability": 0
    }
  ],

  "twin_message": "3-4 sentence personal message FROM the Digital Twin to the student. First person. Warm. Honest. Like talking to your future self.",
  "confidence_score": 0
}`;

const UPDATE_TWIN_PROMPT = `You are updating a student's Digital Twin based on a new life event or decision.

EXISTING TWIN STATE:
{EXISTING_TWIN}

NEW EVENT/DECISION:
Type: {EVENT_TYPE}
Details: {EVENT_DETAILS}

How does this event change the twin? Update the relevant scores and trajectory.
Respond ONLY with valid JSON (the full updated twin):
{
  "updated_scores": {
    "financial_health_score": 0,
    "career_readiness": 0,
    "risk_exposure": 0,
    "overall_potential_score": 0
  },
  "score_changes": [
    {"metric": "financial_health_score", "change": +5, "reason": "scholarship received"}
  ],
  "new_insights": ["new insight based on this event"],
  "updated_trajectory_note": "How this event shifts the overall life trajectory",
  "twin_reaction": "What the Digital Twin says about this new event — first person, 2 sentences"
}`;

class DigitalTwinService {
  async createOrUpdateTwin(userId) {
    const cacheKey = `digital_twin:${userId}`;

    const profile = await userIntelligenceService.getFullProfile(userId);
    if (!profile) throw new Error("Profile not found");

    // Gather decision history
    const [careerRes, roiRes, loanRes, simRes] = await Promise.all([
      query(
        "SELECT career_title, probability_score FROM career_recommendations WHERE user_id = $1 AND is_active = TRUE ORDER BY rank LIMIT 3",
        [userId],
      ),
      query(
        "SELECT roi_score, risk_category, worth_it_flag, total_cost_usd FROM roi_analyses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        [userId],
      ),
      query(
        "SELECT eligibility_score, risk_category, suggested_amount_usd FROM loan_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        [userId],
      ),
      query(
        "SELECT simulation_type, recommendation FROM simulations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 3",
        [userId],
      ),
    ]);

    const profileData = `
Name: ${profile.first_name || "Student"} | Age: ~22 | From: ${profile.current_country || "India"}
Education: ${profile.highest_education || "Bachelor"} | GPA: ${profile.gpa || "N/A"} | Major: ${profile.major || "Technology"}
Skills: ${(profile.technical_skills || []).join(", ") || "Programming, Data Analysis"}
Work Experience: ${profile.work_experience_months || 0} months
Family Income: ${profile.family_income_bracket || "middle"} bracket | Savings: $${profile.savings_available || 0}
Risk Appetite: ${profile.risk_appetite || "moderate"} | Personality: ${profile.personality_type || "Analytical"}
Career Goals: ${profile.career_goals || "Technology career"}
    `.trim();

    const decisionsData = `
Top Career Paths: ${careerRes.rows.map((c) => `${c.career_title} (${c.probability_score}% match)`).join(", ") || "Not yet determined"}
Latest ROI Analysis: ${roiRes.rows[0] ? `Score: ${roiRes.rows[0].roi_score}, Risk: ${roiRes.rows[0].risk_category}, Total Cost: $${roiRes.rows[0].total_cost_usd}` : "Not yet calculated"}
Loan Assessment: ${loanRes.rows[0] ? `Eligibility: ${loanRes.rows[0].eligibility_score}%, Amount: $${loanRes.rows[0].suggested_amount_usd}` : "Not yet assessed"}
Simulations Run: ${simRes.rows.length > 0 ? simRes.rows.map((s) => s.simulation_type).join(", ") : "None yet"}
    `.trim();

    const result = await aiProvider.complete({
      systemPrompt: DIGITAL_TWIN_PROMPT.replace("{PROFILE_DATA}", profileData)
        .replace("{DECISIONS_DATA}", decisionsData)
        .replace("{name}", profile.first_name || "Student"),
      messages: [{ role: "user", content: "Create the Digital Twin now." }],
      temperature: 0.4,
      maxTokens: 3000,
      jsonMode: true,
    });

    const twin = aiProvider.parseJSON(result.content);
    twin.twin_id = `twin_${userId}`;
    twin.generated_at = new Date().toISOString();

    await cache.set(cacheKey, twin, 3600 * 8);
    return { twin, isNew: true };
  }

  async applyTwinEvent(userId, { eventType, eventDetails }) {
    const cacheKey = `digital_twin:${userId}`;
    let existingTwin = await cache.get(cacheKey);

    if (!existingTwin) {
      const twinResult = await this.createOrUpdateTwin(userId);
      existingTwin = twinResult.twin;
    }

    const eventTypes = {
      scholarship_received: "Scholarship received",
      job_offer_received: "Job offer received",
      admission_received: "University admission received",
      loan_approved: "Loan approved",
      semester_completed: "Semester completed successfully",
      internship_completed: "Internship completed",
      certification_earned: "New certification earned",
      skill_added: "New skill acquired",
      setback_occurred: "Setback or challenge occurred",
    };

    const result = await aiProvider.complete({
      systemPrompt: UPDATE_TWIN_PROMPT.replace(
        "{EXISTING_TWIN}",
        JSON.stringify({
          current_state: existingTwin.current_state,
          financial_twin: existingTwin.financial_twin,
          career_twin: existingTwin.career_twin,
          risk_profile: existingTwin.risk_profile,
        }),
      )
        .replace("{EVENT_TYPE}", eventTypes[eventType] || eventType)
        .replace("{EVENT_DETAILS}", JSON.stringify(eventDetails)),
      messages: [
        {
          role: "user",
          content: "Update the Digital Twin based on this event.",
        },
      ],
      temperature: 0.3,
      maxTokens: 1000,
      jsonMode: true,
    });

    const update = aiProvider.parseJSON(result.content);

    // Merge updates into existing twin
    if (update.updated_scores) {
      existingTwin.current_state = {
        ...existingTwin.current_state,
        ...update.updated_scores,
      };
    }
    if (update.new_insights) {
      existingTwin.twin_insights = [
        ...(existingTwin.twin_insights || []),
        ...update.new_insights.map((i) => ({
          insight: i,
          category: "personal",
          urgency: "soon",
        })),
      ];
    }
    existingTwin.last_updated = new Date().toISOString();
    existingTwin.last_event = eventType;

    await cache.set(cacheKey, existingTwin, 3600 * 8);

    return { twin: existingTwin, update, eventApplied: eventType };
  }

  async getTwin(userId) {
    const cacheKey = `digital_twin:${userId}`;
    const cached = await cache.get(cacheKey);
    if (cached) return { twin: cached, isNew: false };
    return this.createOrUpdateTwin(userId);
  }
}

module.exports = new DigitalTwinService();
