// src/routes/index.js
const express = require("express");
const router = express.Router();

const { authenticate } = require("../middleware/auth");
const {
  perUserAiLimiter,
  auditLog,
  aiPayloadGuard,
} = require("../middleware/security");
const {
  validateBody,
  analyzeSchema,
  simulationSchema,
  mentorChatSchema,
  loanAssessSchema,
  profileSchema,
} = require("../middleware/validate");

// Shorthand: authenticated + per-user AI rate limit + payload guard
const aiRoute = [authenticate, perUserAiLimiter(10), aiPayloadGuard];

// Auth routes
const authController = require("../modules/auth/auth.controller");
router.post(
  "/auth/register",
  authController.registerValidation,
  authController.register,
);
router.post(
  "/auth/login",
  authController.loginValidation,
  authController.login,
);
router.post("/auth/refresh", authController.refresh);
router.post("/auth/logout", authenticate, authController.logout);
router.get("/auth/me", authenticate, authController.me);

// User Intelligence / Profile routes
const userIntelligence = require("../modules/user-intelligence/user-intelligence.service");
const { ApiResponse } = require("../utils/response");

router.get("/profile", authenticate, async (req, res, next) => {
  try {
    const profile = await userIntelligence.getFullProfile(req.userId);
    ApiResponse.success(res, { profile });
  } catch (e) {
    next(e);
  }
});

router.put("/profile", authenticate, async (req, res, next) => {
  try {
    const result = await userIntelligence.updateProfile(req.userId, req.body);
    ApiResponse.success(res, result, "Profile updated successfully");
  } catch (e) {
    next(e);
  }
});

router.post("/profile/analyze", authenticate, async (req, res, next) => {
  try {
    const analysis = await userIntelligence.generateAIAnalysis(req.userId);
    ApiResponse.success(res, { analysis }, "AI analysis complete");
  } catch (e) {
    next(e);
  }
});

router.get("/profile/completeness", authenticate, async (req, res, next) => {
  try {
    const completeness = await userIntelligence.computeCompleteness(req.userId);
    ApiResponse.success(res, { completeness });
  } catch (e) {
    next(e);
  }
});

// Career Engine routes
const careerService = require("../modules/career/career.service");

router.get("/career/recommendations", authenticate, async (req, res, next) => {
  try {
    const forceRefresh = req.query.refresh === "true";
    const result = await careerService.getRecommendations(
      req.userId,
      forceRefresh,
    );
    ApiResponse.success(res, result);
  } catch (e) {
    next(e);
  }
});

router.get(
  "/career/recommendations/:careerId/skill-gap",
  authenticate,
  async (req, res, next) => {
    try {
      const analysis = await careerService.getSkillGapAnalysis(
        req.userId,
        req.params.careerId,
      );
      ApiResponse.success(res, analysis);
    } catch (e) {
      next(e);
    }
  },
);

// University routes
const universityService = require("../modules/university/university.service");

router.get("/universities", authenticate, async (req, res, next) => {
  try {
    const universities = await universityService.listUniversities(req.query);
    ApiResponse.success(res, { universities });
  } catch (e) {
    next(e);
  }
});

router.get(
  "/universities/recommendations",
  authenticate,
  async (req, res, next) => {
    try {
      const forceRefresh = req.query.refresh === "true";
      const result = await universityService.getRecommendations(
        req.userId,
        forceRefresh,
      );
      ApiResponse.success(res, result);
    } catch (e) {
      next(e);
    }
  },
);

router.post("/universities", authenticate, async (req, res, next) => {
  try {
    const university = await universityService.addUniversity(req.body);
    ApiResponse.created(res, { university });
  } catch (e) {
    next(e);
  }
});

// ROI Engine routes
const roiService = require("../modules/roi/roi.service");

router.post("/roi/calculate", authenticate, async (req, res, next) => {
  try {
    const { universityRecommendationId } = req.body;
    if (!universityRecommendationId) {
      return ApiResponse.error(
        res,
        "universityRecommendationId is required",
        400,
      );
    }
    const result = await roiService.calculateROI(
      req.userId,
      universityRecommendationId,
      req.body,
    );
    ApiResponse.success(res, result);
  } catch (e) {
    next(e);
  }
});

router.post("/roi/simulate", authenticate, async (req, res, next) => {
  try {
    const { baseRoiId, scenarioType, scenarioParams } = req.body;
    if (!baseRoiId || !scenarioType) {
      return ApiResponse.error(
        res,
        "baseRoiId and scenarioType are required",
        400,
      );
    }
    const result = await roiService.runScenario(
      req.userId,
      baseRoiId,
      scenarioType,
      scenarioParams || {},
    );
    ApiResponse.success(res, result);
  } catch (e) {
    next(e);
  }
});

// Loan routes
const loanService = require("../modules/loan/loan.service");

router.post("/loan/assess", authenticate, async (req, res, next) => {
  try {
    const {
      requestedAmount,
      purpose,
      universityRecommendationId,
      roiAnalysisId,
    } = req.body;
    if (!requestedAmount) {
      return ApiResponse.error(res, "requestedAmount is required", 400);
    }
    const result = await loanService.assessEligibility(req.userId, req.body);
    ApiResponse.success(res, result);
  } catch (e) {
    next(e);
  }
});

router.post(
  "/loan/applications/:applicationId/submit",
  authenticate,
  async (req, res, next) => {
    try {
      const result = await loanService.submitApplication(
        req.userId,
        req.params.applicationId,
      );
      ApiResponse.success(res, result);
    } catch (e) {
      next(e);
    }
  },
);

router.get("/loan/applications", authenticate, async (req, res, next) => {
  try {
    const applications = await loanService.getApplicationHistory(req.userId);
    ApiResponse.success(res, { applications });
  } catch (e) {
    next(e);
  }
});

// Mentor Chatbot routes
const mentorService = require("../modules/mentor/mentor.service");

router.post("/mentor/sessions", authenticate, async (req, res, next) => {
  try {
    const { topic } = req.body;
    const session = await mentorService.startSession(req.userId, topic);
    ApiResponse.created(res, { session });
  } catch (e) {
    next(e);
  }
});

router.get("/mentor/sessions", authenticate, async (req, res, next) => {
  try {
    const sessions = await mentorService.getSessions(req.userId);
    ApiResponse.success(res, { sessions });
  } catch (e) {
    next(e);
  }
});

router.get(
  "/mentor/sessions/:sessionId",
  authenticate,
  async (req, res, next) => {
    try {
      const data = await mentorService.getSessionMessages(
        req.userId,
        req.params.sessionId,
      );
      ApiResponse.success(res, data);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/mentor/sessions/:sessionId/messages",
  authenticate,
  async (req, res, next) => {
    try {
      const { message } = req.body;
      if (!message?.trim())
        return ApiResponse.error(res, "Message is required", 400);
      const result = await mentorService.sendMessage(
        req.userId,
        req.params.sessionId,
        message,
      );
      ApiResponse.success(res, result);
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/mentor/sessions/:sessionId",
  authenticate,
  async (req, res, next) => {
    try {
      const result = await mentorService.closeSession(
        req.userId,
        req.params.sessionId,
      );
      ApiResponse.success(res, result);
    } catch (e) {
      next(e);
    }
  },
);

// Behavioral Engine routes
const behavioralService = require("../modules/behavioral/behavioral.service");

router.post("/behavioral/events", authenticate, async (req, res, next) => {
  try {
    await behavioralService.trackEvent(req.userId, {
      ...req.body,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });
    res.status(202).json({ success: true });
  } catch (e) {
    next(e);
  }
});

router.get("/behavioral/score", authenticate, async (req, res, next) => {
  try {
    const score = await behavioralService.getBehavioralScore(req.userId);
    ApiResponse.success(res, { score });
  } catch (e) {
    next(e);
  }
});

router.get("/behavioral/nudges", authenticate, async (req, res, next) => {
  try {
    const nudges = await behavioralService.getPendingNudges(req.userId);
    ApiResponse.success(res, { nudges });
  } catch (e) {
    next(e);
  }
});

router.post(
  "/behavioral/nudges/:nudgeId/dismiss",
  authenticate,
  async (req, res, next) => {
    try {
      await behavioralService.dismissNudge(req.userId, req.params.nudgeId);
      ApiResponse.success(res, { dismissed: true });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/behavioral/nudges/:nudgeId/click",
  authenticate,
  async (req, res, next) => {
    try {
      await behavioralService.clickNudge(req.userId, req.params.nudgeId);
      ApiResponse.success(res, { clicked: true });
    } catch (e) {
      next(e);
    }
  },
);

// AI Decision Log / Explainability routes
router.get(
  "/explainability/decisions",
  authenticate,
  async (req, res, next) => {
    try {
      const { query: dbQuery } = require("../database/connection");
      const { type, limit = 20, page = 1 } = req.query;
      let sql = "SELECT * FROM ai_decision_log WHERE user_id = $1";
      const params = [req.userId];
      if (type) {
        params.push(type);
        sql += ` AND decision_type = $${params.length}`;
      }
      params.push(parseInt(limit));
      params.push((parseInt(page) - 1) * parseInt(limit));
      sql += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
      const result = await dbQuery(sql, params);
      ApiResponse.success(res, { decisions: result.rows });
    } catch (e) {
      next(e);
    }
  },
);

// Dashboard summary endpoint
router.get("/dashboard", authenticate, async (req, res, next) => {
  try {
    const { query: dbQuery } = require("../database/connection");
    const userId = req.userId;

    const [profile, careerRecs, uniRecs, loanApps, behavioralScore, nudges] =
      await Promise.all([
        userIntelligence.getFullProfile(userId),
        dbQuery(
          "SELECT career_title, rank, probability_score, entry_salary_usd FROM career_recommendations WHERE user_id = $1 AND is_active = TRUE ORDER BY rank LIMIT 3",
          [userId],
        ),
        dbQuery(
          "SELECT ur.rank, ur.category, ur.admit_probability, u.name, u.country FROM university_recommendations ur JOIN universities u ON u.id = ur.university_id WHERE ur.user_id = $1 AND ur.is_active = TRUE ORDER BY ur.rank LIMIT 3",
          [userId],
        ),
        dbQuery(
          "SELECT id, status, eligibility_score, suggested_amount_usd, risk_category FROM loan_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
          [userId],
        ),
        dbQuery(
          "SELECT loan_intent_score, engagement_score, funnel_stage FROM behavioral_scores WHERE user_id = $1",
          [userId],
        ),
        dbQuery(
          "SELECT * FROM nudges WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 3",
          [userId, "sent"],
        ),
      ]);

    ApiResponse.success(res, {
      profile: {
        completeness: profile?.profile_completeness || 0,
        stage: profile?.profile_stage || "basic",
        personalityType: profile?.personality_type,
        riskAppetite: profile?.risk_appetite,
        careerSummary: profile?.career_personality_summary,
      },
      careers: careerRecs.rows,
      universities: uniRecs.rows,
      loanApplication: loanApps.rows[0] || null,
      behavioral: behavioralScore.rows[0] || null,
      pendingNudges: nudges.rows,
    });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// 🚀 FutureFin v2.0 — ADVANCED AI ENGINES
// ============================================================

// ─── Future Simulation Engine ────────────────────────────────────────────────
const futureSimulationService = require("../modules/future-simulation/future-simulation.service");

router.post("/simulation/run", authenticate, async (req, res, next) => {
  try {
    const { scenarioType, scenarioParams, baseRoiId } = req.body;
    if (!scenarioType)
      return ApiResponse.error(res, "scenarioType is required", 400);
    const result = await futureSimulationService.runSimulation(req.userId, {
      scenarioType,
      scenarioParams: scenarioParams || {},
      baseRoiId,
    });
    ApiResponse.success(res, result);
  } catch (e) {
    next(e);
  }
});

router.post(
  "/simulation/compare-countries",
  authenticate,
  async (req, res, next) => {
    try {
      const { countryA, countryB, universityA, universityB } = req.body;
      if (!countryA || !countryB)
        return ApiResponse.error(
          res,
          "countryA and countryB are required",
          400,
        );
      const result = await futureSimulationService.compareCountries(
        req.userId,
        { countryA, countryB, universityA, universityB },
      );
      ApiResponse.success(res, result);
    } catch (e) {
      next(e);
    }
  },
);

router.get("/simulation/history", authenticate, async (req, res, next) => {
  try {
    const history = await futureSimulationService.getSimulationHistory(
      req.userId,
    );
    ApiResponse.success(res, { history });
  } catch (e) {
    next(e);
  }
});

// ─── Reality Check Score ─────────────────────────────────────────────────────
const realityCheckService = require("../modules/reality-check/reality-check.service");

router.post("/reality-check", authenticate, async (req, res, next) => {
  try {
    const result = await realityCheckService.generateRealityCheck(
      req.userId,
      req.body,
    );
    ApiResponse.success(res, result);
  } catch (e) {
    next(e);
  }
});

router.get("/reality-check", authenticate, async (req, res, next) => {
  try {
    const result = await realityCheckService.generateRealityCheck(
      req.userId,
      req.query,
    );
    ApiResponse.success(res, result);
  } catch (e) {
    next(e);
  }
});

// ─── Digital Twin ─────────────────────────────────────────────────────────────
const digitalTwinService = require("../modules/digital-twin/digital-twin.service");

router.get("/digital-twin", authenticate, async (req, res, next) => {
  try {
    const result = await digitalTwinService.getTwin(req.userId);
    ApiResponse.success(res, result);
  } catch (e) {
    next(e);
  }
});

router.post("/digital-twin/refresh", authenticate, async (req, res, next) => {
  try {
    const result = await digitalTwinService.createOrUpdateTwin(req.userId);
    ApiResponse.success(res, result);
  } catch (e) {
    next(e);
  }
});

router.post("/digital-twin/event", authenticate, async (req, res, next) => {
  try {
    const { eventType, eventDetails } = req.body;
    if (!eventType) return ApiResponse.error(res, "eventType is required", 400);
    const result = await digitalTwinService.applyTwinEvent(req.userId, {
      eventType,
      eventDetails: eventDetails || {},
    });
    ApiResponse.success(res, result);
  } catch (e) {
    next(e);
  }
});

// ─── Dropout Risk Prediction ─────────────────────────────────────────────────
const dropoutRiskService = require("../modules/dropout-risk/dropout-risk.service");

router.post("/dropout-risk/predict", authenticate, async (req, res, next) => {
  try {
    const result = await dropoutRiskService.predictRisk(req.userId, req.body);
    ApiResponse.success(res, result);
  } catch (e) {
    next(e);
  }
});

router.get("/dropout-risk/predict", authenticate, async (req, res, next) => {
  try {
    const result = await dropoutRiskService.predictRisk(req.userId, req.query);
    ApiResponse.success(res, result);
  } catch (e) {
    next(e);
  }
});

// ─── AI Loan Negotiator ───────────────────────────────────────────────────────
const loanNegotiatorService = require("../modules/loan-negotiator/loan-negotiator.service");

router.post("/loan/negotiate", authenticate, async (req, res, next) => {
  try {
    const result = await loanNegotiatorService.generateNegotiationStrategy(
      req.userId,
      req.body,
    );
    ApiResponse.success(res, result);
  } catch (e) {
    next(e);
  }
});

router.post("/loan/compare-scenarios", authenticate, async (req, res, next) => {
  try {
    const { scenarios } = req.body;
    if (!scenarios || !Array.isArray(scenarios) || scenarios.length < 2) {
      return ApiResponse.error(res, "At least 2 loan scenarios required", 400);
    }
    const result = await loanNegotiatorService.compareLoansScenarios(
      req.userId,
      scenarios,
    );
    ApiResponse.success(res, result);
  } catch (e) {
    next(e);
  }
});

// ─── Regret Minimization Engine ──────────────────────────────────────────────
const regretEngineService = require("../modules/regret-engine/regret-engine.service");

router.post("/regret-analysis", authenticate, async (req, res, next) => {
  try {
    const result = await regretEngineService.analyzeRegret(
      req.userId,
      req.body,
    );
    ApiResponse.success(res, result);
  } catch (e) {
    next(e);
  }
});

router.get("/regret-analysis", authenticate, async (req, res, next) => {
  try {
    const result = await regretEngineService.analyzeRegret(
      req.userId,
      req.query,
    );
    ApiResponse.success(res, result);
  } catch (e) {
    next(e);
  }
});

// ─── Parent Mode ─────────────────────────────────────────────────────────────
const parentModeService = require("../modules/parent-mode/parent-mode.service");

router.get("/parent-report", authenticate, async (req, res, next) => {
  try {
    const result = await parentModeService.generateParentReport(
      req.userId,
      req.query,
    );
    ApiResponse.success(res, result);
  } catch (e) {
    next(e);
  }
});

router.post("/parent-report", authenticate, async (req, res, next) => {
  try {
    const result = await parentModeService.generateParentReport(
      req.userId,
      req.body,
    );
    ApiResponse.success(res, result);
  } catch (e) {
    next(e);
  }
});

// ─── Ethical AI Layer ─────────────────────────────────────────────────────────
const ethicalAIService = require("../modules/ethical-ai/ethical-ai.service");

router.get("/ethical-ai/principles", async (req, res, next) => {
  try {
    ApiResponse.success(res, ethicalAIService.getPrinciples());
  } catch (e) {
    next(e);
  }
});

router.get(
  "/ethical-ai/transparency-report",
  authenticate,
  async (req, res, next) => {
    try {
      const { query: dbQuery } = require("../database/connection");
      const decisions = await dbQuery(
        "SELECT decision_type, created_at, confidence_score FROM ai_decision_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20",
        [req.userId],
      );
      const report = ethicalAIService.generateTransparencyReport(
        req.userId,
        decisions.rows,
      );
      ApiResponse.success(res, { report });
    } catch (e) {
      next(e);
    }
  },
);

// ─── Master Intelligence Report (All engines combined) ───────────────────────
router.get("/intelligence-report", authenticate, async (req, res, next) => {
  try {
    const { query: dbQuery } = require("../database/connection");
    const userId = req.userId;

    const [
      profile,
      careerRecs,
      uniRecs,
      loanApp,
      behavioralScore,
      recentSimulations,
      recentDecisions,
    ] = await Promise.all([
      userIntelligence.getFullProfile(userId),
      dbQuery(
        "SELECT career_title, rank, probability_score, entry_salary_usd, senior_salary_usd FROM career_recommendations WHERE user_id = $1 AND is_active = TRUE ORDER BY rank LIMIT 3",
        [userId],
      ),
      dbQuery(
        "SELECT ur.rank, ur.category, ur.admit_probability, u.name, u.country FROM university_recommendations ur JOIN universities u ON u.id = ur.university_id WHERE ur.user_id = $1 AND ur.is_active = TRUE ORDER BY ur.rank LIMIT 3",
        [userId],
      ),
      dbQuery(
        "SELECT id, status, eligibility_score, suggested_amount_usd, risk_category FROM loan_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        [userId],
      ),
      dbQuery(
        "SELECT loan_intent_score, engagement_score, funnel_stage FROM behavioral_scores WHERE user_id = $1",
        [userId],
      ),
      dbQuery(
        "SELECT simulation_type, recommendation, created_at FROM simulations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5",
        [userId],
      ),
      dbQuery(
        "SELECT decision_type, confidence_score, created_at FROM ai_decision_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5",
        [userId],
      ),
    ]);

    const report = {
      student: {
        completeness: profile?.profile_completeness || 0,
        stage: profile?.profile_stage || "basic",
        personalityType: profile?.personality_type,
        riskAppetite: profile?.risk_appetite,
        summary: profile?.career_personality_summary,
      },
      careers: careerRecs.rows,
      universities: uniRecs.rows,
      loan: loanApp.rows[0] || null,
      behavioral: behavioralScore.rows[0] || null,
      recentSimulations: recentSimulations.rows,
      aiDecisions: recentDecisions.rows,
      availableEngines: [
        {
          engine: "Future Simulation",
          endpoint: "/api/v1/simulation/run",
          description: 'Simulate "What If" life scenarios',
        },
        {
          engine: "Reality Check Score",
          endpoint: "/api/v1/reality-check",
          description: "Honest probability & risk scoring",
        },
        {
          engine: "Digital Twin",
          endpoint: "/api/v1/digital-twin",
          description: "Your virtual life model",
        },
        {
          engine: "Dropout Risk",
          endpoint: "/api/v1/dropout-risk/predict",
          description: "Failure & dropout prediction",
        },
        {
          engine: "Loan Negotiator",
          endpoint: "/api/v1/loan/negotiate",
          description: "Smart loan strategy optimizer",
        },
        {
          engine: "Regret Engine",
          endpoint: "/api/v1/regret-analysis",
          description: "Will you regret this in 5 years?",
        },
        {
          engine: "Parent Report",
          endpoint: "/api/v1/parent-report",
          description: "Simple report for parents",
        },
        {
          engine: "Ethical AI",
          endpoint: "/api/v1/ethical-ai/transparency-report",
          description: "Full AI transparency report",
        },
      ],
      platform: {
        name: "FutureFin AI",
        tagline: "Your AI Life Decision Partner for Education & Career",
        version: "2.0",
      },
      generatedAt: new Date().toISOString(),
    };

    ApiResponse.success(res, report);
  } catch (e) {
    next(e);
  }
});

// ─── MASTER ANALYZE ENDPOINT (Single API, Everything Combined) ────────────────
// POST /api/v1/analyze — The magic single endpoint judges love
const decisionService = require("../modules/decision/decision.service");

// Authenticated version — uses stored profile
router.post(
  "/analyze",
  [...aiRoute, validateBody(analyzeSchema), auditLog("full_analysis")],
  async (req, res, next) => {
    try {
      const result = await decisionService.runFullAnalysis(
        req.userId,
        req.body,
      );
      ApiResponse.success(res, result, "Full analysis complete");
    } catch (e) {
      next(e);
    }
  },
);

// Quick analyze — inline profile (no auth needed, good for demos)
router.post("/analyze/quick", [aiPayloadGuard], async (req, res, next) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return ApiResponse.error(
        res,
        "Profile data required in request body",
        400,
      );
    }
    const result = await decisionService.quickAnalyze(req.body);
    ApiResponse.success(res, result, "Quick analysis complete");
  } catch (e) {
    next(e);
  }
});

// GET latest decision for user
router.get("/decision", authenticate, async (req, res, next) => {
  try {
    const result = await decisionService.getLatestDecision(req.userId);
    if (!result)
      return ApiResponse.error(
        res,
        "No analysis found. Run POST /api/v1/analyze first.",
        404,
      );
    ApiResponse.success(res, result);
  } catch (e) {
    next(e);
  }
});

// Force refresh full analysis
router.post("/analyze/refresh", authenticate, async (req, res, next) => {
  try {
    const result = await decisionService.runFullAnalysis(req.userId, {
      ...req.body,
      forceRefresh: true,
    });
    ApiResponse.success(res, result, "Analysis refreshed");
  } catch (e) {
    next(e);
  }
});

// ─── MENTOR CHAT (alias for frontend compatibility) ───────────────────────────
// Frontend calls /mentor/sessions/:id/chat — add alias
router.post(
  "/mentor/sessions/:sessionId/chat",
  authenticate,
  async (req, res, next) => {
    try {
      const { message, context } = req.body;
      if (!message) return ApiResponse.error(res, "message is required", 400);
      const mentorService = require("../modules/mentor/mentor.service");
      const result = await mentorService.sendMessage(
        req.userId,
        req.params.sessionId,
        message,
        context,
      );
      ApiResponse.success(res, result);
    } catch (e) {
      next(e);
    }
  },
);

module.exports = router;
