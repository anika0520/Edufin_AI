import axios, { AxiosError } from "axios";

// ─── Axios instance ───────────────────────────────────────────────────────────
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1",
  timeout: 45000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ff_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem("ff_refresh");
      if (refresh) {
        try {
          const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";
          const { data } = await axios.post(`${baseUrl}/auth/refresh`, { refreshToken: refresh });
          const newToken = data.data?.tokens?.accessToken;
          if (newToken) {
            localStorage.setItem("ff_token", newToken);
            original.headers.Authorization = `Bearer ${newToken}`;
            return api(original);
          }
        } catch {
          localStorage.removeItem("ff_token");
          localStorage.removeItem("ff_refresh");
        }
      }
    }
    return Promise.reject(error);
  }
);

// ─── Types ────────────────────────────────────────────────────────────────────
export type ProfileInput = {
  name: string;
  age: number;
  education: string;
  gpa: number;
  field: string;
  skills: string[];
  interests: string[];
  familyIncome: number;
  savings: number;
  loanCapacity: number;
  targetCountries: string[];
  riskAppetite?: "conservative" | "moderate" | "aggressive";
  workExperienceMonths?: number;
};

export type Career = {
  title: string;
  match: number;
  avgSalary: number;
  growth: number;
  reason: string;
};

export type University = {
  name: string;
  country: string;
  program: string;
  admitChance: number;
  tuition: number;
  roi: number;
  rank: number;
};

export type LoanEval = {
  eligibleAmount: number;
  rate: number;
  tenureYears: number;
  emi: number;
  riskScore: number;
  approval: "high" | "medium" | "low";
};

export type SalaryPoint = { year: number; salary: number; salary_inr?: number; milestone?: string };
export type EmiPoint = { month: number; emi: number; remaining: number };

export type AnalyzeResult = {
  careers: Career[];
  universities: University[];
  loan: LoanEval;
  realityScore: number;
  roiScore: number;
  riskScore: number;
  confidence: number;
  summary: string;
  // Full analysis extras (populated when backend is available)
  finalDecision?: {
    verdict: string;
    color: string;
    confidence: number;
    headline: string;
    explanation: string;
    suggestedAction: string;
    actionTimeline: { week: number; action: string }[];
    conditions: string[];
    alternativePaths: { path: string; why_consider: string; roi_difference: string; risk_difference: string }[];
    parentSummary: string;
    studentMessage: string;
    keyReasons: { reason: string; impact: string; weight: string }[];
  };
  scores?: {
    overall: number;
    career: number;
    financial: number;
    risk: number;
    realityCheck: number;
  };
  finance?: {
    monthlyEmiInr: number;
    monthlyEmiUsd: number;
    loanAmountInr: number;
    roiMultiple: number;
    breakEvenMonths: number;
    paybackYears: number;
    stressLevel: string;
    stressScore: number;
    emiAsPctSalary: number;
    totalCostInr: number;
    totalRepaymentInr: number;
    netWorth5yrInr: number;
    salaryTimeline: {
      year: number; gross_usd: number; after_tax_usd: number;
      emi_usd: number; savings_usd: number; net_usd: number;
      gross_inr: number; after_tax_inr: number; emi_inr: number;
      savings_inr: number; net_inr: number;
    }[];
  };
  risk?: {
    compositeScore: number;
    category: string;
    dropoutProbability: number;
    redAlerts: { alert: string; severity: string; description: string; action: string }[];
  };
};

export type SimulationInput = {
  country: string;
  jobDelayMonths: number;
  salaryVariance: number;
};

export type SimulationResult = {
  salaryGrowth: SalaryPoint[];
  emiTimeline: EmiPoint[];
  stressIndex: number;
  netWorthIn5Years: number;
  verdict: "strong" | "moderate" | "risky";
  message: string;
};

export type ComparisonResult = {
  options: {
    label: string; country: string; roi: number; risk: number;
    salary: number; cost: number; paybackYears: number;
  }[];
  winnerIndex: number;
  rationale: string;
};

export type AuthResult = {
  user: { id: string; email: string; firstName: string; lastName: string };
  tokens: { accessToken: string; refreshToken: string };
};

// ─── Backend availability ─────────────────────────────────────────────────────
let _backendAvailable: boolean | null = null;
let _lastCheck = 0;

async function isBackendAvailable(): Promise<boolean> {
  const now = Date.now();
  if (_backendAvailable !== null && now - _lastCheck < 30000) return _backendAvailable;
  try {
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";
    const healthUrl = baseUrl.replace("/api/v1", "") + "/health";
    await axios.get(healthUrl, { timeout: 2500 });
    _backendAvailable = true;
  } catch {
    _backendAvailable = false;
  }
  _lastCheck = now;
  return _backendAvailable;
};

// ─── Mock data (INR) ──────────────────────────────────────────────────────────
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const USD_INR = 83;

const careersPool: Career[] = [
  { title: "Data Scientist", match: 92, avgSalary: 2200000, growth: 28, reason: "Strong analytical skills + Python proficiency align with high-demand market." },
  { title: "ML Engineer", match: 88, avgSalary: 2600000, growth: 32, reason: "CS background + AI interest match top hiring trends." },
  { title: "Product Manager (Tech)", match: 81, avgSalary: 2800000, growth: 22, reason: "Cross-functional skills and user-empathy signals." },
  { title: "Cloud Architect", match: 76, avgSalary: 3000000, growth: 25, reason: "Systems thinking with growing infra demand." },
];

const uniPool: University[] = [
  { name: "University of Toronto", country: "Canada", program: "MS Computer Science", admitChance: 64, tuition: 4800000, roi: 2.8, rank: 21 },
  { name: "ETH Zurich", country: "Switzerland", program: "MS Data Science", admitChance: 38, tuition: 350000, roi: 4.6, rank: 9 },
  { name: "TU Munich", country: "Germany", program: "MS Informatics", admitChance: 52, tuition: 250000, roi: 4.1, rank: 30 },
  { name: "NUS", country: "Singapore", program: "MS AI", admitChance: 47, tuition: 3100000, roi: 3.4, rank: 11 },
  { name: "UT Austin", country: "USA", program: "MS CS", admitChance: 28, tuition: 6500000, roi: 2.4, rank: 14 },
  { name: "IIT Bombay", country: "India", program: "M.Tech CS", admitChance: 22, tuition: 380000, roi: 5.2, rank: 45 },
];

// ─── Map full analysis response → AnalyzeResult ───────────────────────────────
function mapFullAnalysis(data: Record<string, unknown>): AnalyzeResult {
  const f = data.finance || {};
  const c = data.career || {};
  const r = data.risk || {};
  const s = data.scores || {};
  const fd = data.finalDecision || {};

  // Build careers list from salary growth curve
  const careers: Career[] = c.salaryGrowthCurve?.length
    ? [{
        title: c.topCareer || "Top Career",
        match: c.fitScore || 80,
        avgSalary: c.entrySalaryInr || c.entrySalaryUsd * USD_INR || 2000000,
        growth: c.yoyGrowth || 20,
        reason: fd.explanation || "AI-matched based on your profile.",
      }]
    : careersPool.slice(0, 4);

  // Build loan from finance
  const loan: LoanEval = {
    eligibleAmount: f.loanAmountInr || f.loanAmountUsd * USD_INR || 4000000,
    rate: f.interestRatePercent || 9.5,
    tenureYears: Math.round((f.tenureMonths || 120) / 12),
    emi: f.monthlyEmiInr || f.monthlyEmiUsd * USD_INR || 70000,
    riskScore: r.compositeScore || 42,
    approval: (r.compositeScore || 42) < 35 ? "high" : (r.compositeScore || 42) < 60 ? "medium" : "low",
  };

  return {
    careers,
    universities: uniPool.slice(0, 5),
    loan,
    realityScore: s.realityCheck || 72,
    roiScore: Math.round((f.roiMultiple || 2.5) * 20),
    riskScore: r.compositeScore || 41,
    confidence: s.overall || 78,
    summary: fd.explanation || fd.headline || "Analysis complete.",
    finalDecision: data.finalDecision,
    scores: data.scores,
    finance: f.monthlyEmiInr ? {
      monthlyEmiInr: f.monthlyEmiInr,
      monthlyEmiUsd: f.monthlyEmiUsd,
      loanAmountInr: f.loanAmountInr,
      roiMultiple: f.roiMultiple,
      breakEvenMonths: f.breakEvenMonths,
      paybackYears: f.paybackYears,
      stressLevel: f.stressLevel,
      stressScore: f.stressScore,
      emiAsPctSalary: f.emiAsPctSalary,
      totalCostInr: f.totalCostInr,
      totalRepaymentInr: f.totalRepaymentInr,
      netWorth5yrInr: f.netWorth5yrInr,
      salaryTimeline: f.salaryTimeline || [],
    } : undefined,
    risk: r.compositeScore !== undefined ? {
      compositeScore: r.compositeScore,
      category: r.category,
      dropoutProbability: r.dropoutProbability,
      redAlerts: r.redAlerts || [],
    } : undefined,
  };
}

// ─── Real backend calls ───────────────────────────────────────────────────────
async function backendAnalyze(input: ProfileInput): Promise<AnalyzeResult> {
  // Try authenticated full analysis first
  const token = localStorage.getItem("ff_token");

  if (token) {
    // Update profile first
    try {
      await api.put("/profile", {
        current_education_level: input.education,
        field_of_study: input.field,
        major: input.field,
        current_gpa: input.gpa,
        current_age: input.age,
        monthly_family_income: Math.round(input.familyIncome / 12),
        annual_family_income: input.familyIncome,
        savings_available: input.savings,
        current_savings: input.savings,
        max_loan_comfort: input.loanCapacity,
        preferred_countries: input.targetCountries,
        target_countries: input.targetCountries,
        technical_skills: input.skills,
        interests: input.interests,
        risk_appetite: input.riskAppetite || "moderate",
        work_experience_months: input.workExperienceMonths || 0,
      });
    } catch { /* profile update optional */ }

    // Run master analysis
    const { data } = await api.post("/analyze", {
      field: input.field,
      gpa: input.gpa,
      skills: input.skills,
      interests: input.interests,
      familyIncome: input.familyIncome,
      savings: input.savings,
      loanCapacity: input.loanCapacity,
      targetCountries: input.targetCountries,
      riskAppetite: input.riskAppetite || "moderate",
    });
    return mapFullAnalysis(data.data);
  }

  // Quick analyze (no auth)
  const { data } = await api.post("/analyze/quick", {
    name: input.name,
    education: input.education,
    field: input.field,
    gpa: input.gpa,
    skills: input.skills,
    interests: input.interests,
    familyIncome: input.familyIncome,
    savings: input.savings,
    loanCapacity: input.loanCapacity,
    targetCountries: input.targetCountries,
    riskAppetite: input.riskAppetite || "moderate",
    workExperienceMonths: input.workExperienceMonths || 0,
  });
  return mapFullAnalysis(data.data);
}

async function backendSimulate(input: SimulationInput): Promise<SimulationResult> {
  const { data } = await api.post("/simulation/run", {
    simulation_type: "career_financial",
    scenarioType: "country_comparison",
    scenario_name: `${input.country} - Job delay ${input.jobDelayMonths}mo`,
    scenarioParams: {
      country: input.country,
      job_delay_months: input.jobDelayMonths,
      salary_variance_percent: input.salaryVariance,
      description: `What if I study/work in ${input.country} with ${input.jobDelayMonths} month job delay and ${input.salaryVariance > 0 ? "+" : ""}${input.salaryVariance}% salary variance?`,
    },
  });

  const sim = data?.data?.simulation || data?.data;
  if (!sim) throw new Error("No simulation data");

  // Map backend simulation to frontend format
  const basePlan = sim.base_plan || sim.simulated_plan || {};
  const salaryTimeline = basePlan.salary_timeline || [];

  const salaryGrowth: SalaryPoint[] = salaryTimeline.length
    ? salaryTimeline.map((p: Record<string, number>) => ({
        year: p.year,
        salary: Math.round((p.salary_usd || 80000) * (1 + input.salaryVariance / 100) * USD_INR),
        milestone: p.label,
      }))
    : Array.from({ length: 8 }, (_, i) => ({
        year: i + 1,
        salary: Math.round(1200000 * Math.pow(1.08, i) * (1 + input.salaryVariance / 100)),
      }));

  const loanUsd = 50000;
  const emiUsd = 1000;
  const emiInr = emiUsd * USD_INR;
  const totalLoan = loanUsd * USD_INR;

  const emiTimeline: EmiPoint[] = Array.from({ length: 24 }, (_, i) => ({
    month: i + 1,
    emi: emiInr,
    remaining: Math.max(0, totalLoan - i * emiInr),
  }));

  const stressStr = basePlan.loan_repayment_stress || basePlan.stress_level || "medium";
  const stressIndex = stressStr === "low" ? 30 : stressStr === "medium" ? 55 : 80;
  const verdict: "strong" | "moderate" | "risky" =
    stressIndex < 45 ? "strong" : stressIndex < 70 ? "moderate" : "risky";

  return {
    salaryGrowth,
    emiTimeline,
    stressIndex,
    netWorthIn5Years: Math.round((basePlan.cumulative_savings_5yr_usd || 50000) * USD_INR),
    verdict,
    message: sim.mentor_advice || sim.comparison?.winner_reason || "Simulation complete.",
  };
}

async function backendCompare(): Promise<ComparisonResult> {
  const { data } = await api.post("/loan/compare-scenarios", {
    scenarios: [
      { country: "Canada", university: "University of Toronto", tuition_inr: 4800000, expected_salary_inr: 6500000 },
      { country: "Germany", university: "TU Munich", tuition_inr: 750000, expected_salary_inr: 5400000 },
      { country: "India", university: "IIT Bombay", tuition_inr: 380000, expected_salary_inr: 2300000 },
    ],
  });
  const result = data?.data;
  if (!result?.comparisons) throw new Error("No comparison data");
  return {
    options: (result.comparisons as Record<string, unknown>[]).map((c) => ({
      label: c.label || c.country,
      country: c.country,
      roi: c.roi_multiple || c.roi || 3,
      risk: c.risk_score || c.risk || 30,
      salary: c.expected_salary_inr || 2000000,
      cost: c.total_cost_inr || 1000000,
      paybackYears: c.payback_years || 3,
    })),
    winnerIndex: result.recommended_index ?? 1,
    rationale: result.recommendation || "Germany delivers the best ROI-to-risk ratio.",
  };
}

async function backendChat(message: string, history: { role: string; content: string }[]): Promise<string> {
  let sid = localStorage.getItem("ff_mentor_session");
  if (!sid) {
    const sessionRes = await api.post("/mentor/sessions", { topic: "general_education_finance" });
    sid = sessionRes.data?.data?.session?.id;
    if (sid) localStorage.setItem("ff_mentor_session", sid);
  }
  if (!sid) throw new Error("No session");

  // Try /chat alias first (new route), fallback to /messages
  try {
    const { data } = await api.post(`/mentor/sessions/${sid}/chat`, {
      message,
      context: { history: history.slice(-6) },
    });
    return data?.data?.response || data?.data?.message || "I'm here to help!";
  } catch {
    const { data } = await api.post(`/mentor/sessions/${sid}/messages`, {
      message,
      context: { history: history.slice(-6) },
    });
    return data?.data?.response || data?.data?.message || "I'm here to help!";
  }
}

// ─── Public mockApi (with real backend when available) ────────────────────────
export const mockApi = {
  async analyze(input: ProfileInput): Promise<AnalyzeResult> {
    if (await isBackendAvailable()) {
      try { return await backendAnalyze(input); } catch (e) {
        console.warn("Backend analyze failed, using mock:", e);
      }
    }
    await wait(900);
    const loan: LoanEval = {
      eligibleAmount: Math.round(input.familyIncome * 4 + input.loanCapacity),
      rate: 9.5,
      tenureYears: 10,
      emi: Math.round((input.familyIncome * 4 + input.loanCapacity) * 0.013),
      riskScore: 42,
      approval: "medium",
    };
    return {
      careers: careersPool.slice(0, 4),
      universities: uniPool.filter(u =>
        input.targetCountries.length === 0 || input.targetCountries.includes(u.country)
      ).slice(0, 5),
      loan,
      realityScore: 72, roiScore: 78, riskScore: 41, confidence: 86,
      summary: "Strong academic and skill profile with moderate financial risk. Canada and Germany offer the best risk-adjusted returns.",
    };
  },

  async simulateFuture(input: SimulationInput): Promise<SimulationResult> {
    if (await isBackendAvailable()) {
      try { return await backendSimulate(input); } catch (e) {
        console.warn("Backend simulate failed, using mock:", e);
      }
    }
    await wait(700);
    const base = 1200000 * (1 + input.salaryVariance / 100);
    const salaryGrowth = Array.from({ length: 8 }, (_, i) => ({
      year: i + 1,
      salary: Math.round(base * Math.pow(1.08, i)),
    }));
    const monthlyEmi = 70000;
    const totalLoan = 5000000;
    const emiTimeline = Array.from({ length: 24 }, (_, i) => ({
      month: i + 1,
      emi: monthlyEmi,
      remaining: Math.max(0, totalLoan - i * monthlyEmi - (i > input.jobDelayMonths ? (i - input.jobDelayMonths) * 30000 : 0)),
    }));
    const stressIndex = Math.min(95, 30 + input.jobDelayMonths * 6 - input.salaryVariance);
    const verdict: "strong" | "moderate" | "risky" = stressIndex < 45 ? "strong" : stressIndex < 70 ? "moderate" : "risky";
    return {
      salaryGrowth, emiTimeline, stressIndex,
      netWorthIn5Years: Math.round(base * 5 * 0.18 - 1500000),
      verdict,
      message: verdict === "strong"
        ? "This is a strong investment with a comfortable repayment runway."
        : verdict === "moderate"
        ? "Reasonable investment — secure a job within 6–8 months."
        : "High financial stress predicted. Consider lower-cost alternatives.",
    };
  },

  async compare(): Promise<ComparisonResult> {
    if (await isBackendAvailable()) {
      try { return await backendCompare(); } catch (e) {
        console.warn("Backend compare failed, using mock:", e);
      }
    }
    await wait(600);
    return {
      options: [
        { label: "Toronto, Canada", country: "Canada", roi: 2.8, risk: 38, salary: 6500000, cost: 4800000, paybackYears: 4.2 },
        { label: "TU Munich, Germany", country: "Germany", roi: 4.1, risk: 22, salary: 5400000, cost: 750000, paybackYears: 1.8 },
        { label: "IIT Bombay, India", country: "India", roi: 5.2, risk: 18, salary: 2300000, cost: 380000, paybackYears: 1.2 },
      ],
      winnerIndex: 1,
      rationale: "Germany delivers the best ROI-to-risk ratio with low tuition and strong job market access.",
    };
  },

  async loanEvaluate(amount: number): Promise<LoanEval> {
    if (await isBackendAvailable()) {
      try {
        const { data } = await api.post("/loan/assess", { requestedAmount: amount });
        const d = data?.data;
        if (d) {
          const P = d.suggested_amount_inr || (d.suggested_amount_usd || amount / USD_INR) * USD_INR;
          const r = (d.interest_rate_offered || d.interest_rate_min || 9.5) / 100 / 12;
          const n = d.loan_term_months || 120;
          const emi = Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
          return {
            eligibleAmount: P,
            rate: d.interest_rate_offered || d.interest_rate_min || 9.5,
            tenureYears: Math.round(n / 12),
            emi,
            riskScore: d.risk_score || 42,
            approval: (d.eligibility_score || 50) > 70 ? "high" : (d.eligibility_score || 50) > 45 ? "medium" : "low",
          };
        }
      } catch (e) { console.warn("Backend loan eval failed:", e); }
    }
    await wait(500);
    // Correct EMI formula
    const P = amount;
    const r = 0.095 / 12;
    const n = 120;
    const emi = Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
    return {
      eligibleAmount: amount, rate: 9.5, tenureYears: 10, emi,
      riskScore: amount > 6500000 ? 68 : 38,
      approval: amount > 6500000 ? "low" : "high",
    };
  },

  async chat(message: string, history: { role: string; content: string }[]): Promise<string> {
    if (await isBackendAvailable()) {
      try { return await backendChat(message, history); } catch (e) {
        console.warn("Backend chat failed, using mock:", e);
      }
    }
    await wait(600);
    const lower = message.toLowerCase();
    if (lower.includes("loan") || lower.includes("emi"))
      return "Based on your profile, a loan of ₹40L at 9.5% for 10 years gives EMI ≈ ₹52,000/month — that's about 26% of your projected starting salary, which is within the safe zone.";
    if (lower.includes("canada") || lower.includes("germany") || lower.includes("country"))
      return "Germany offers the best ROI: low tuition (₹2-4L total) + strong €50K starting salaries. Canada has higher tuition but excellent PR pathways. Germany wins on pure financials.";
    if (lower.includes("risk"))
      return "Your top 3 risks: (1) job search taking longer than 6 months — adds ₹3-4L EMI burden, (2) currency depreciation reducing INR value of salary, (3) visa policy changes. All are manageable with a 6-month emergency fund.";
    if (lower.includes("roi") || lower.includes("worth"))
      return "Based on a ₹45L investment (tuition + living) and ₹25L/yr starting salary, your payback period is ~2.5 years. The 10-year ROI is approximately 4x — a strong investment.";
    return "Great question. Run the Future Simulation with a 6-month job delay to stress-test your plan — it'll show exactly how your finances hold up under that scenario.";
  },
};

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authApi = {
  async register(payload: {
    email: string; password: string;
    firstName: string; lastName: string;
    phone?: string; nationality?: string; currentCountry?: string;
  }): Promise<AuthResult> {
    const { data } = await api.post("/auth/register", payload);
    const result = data.data;
    localStorage.setItem("ff_token", result.tokens.accessToken);
    localStorage.setItem("ff_refresh", result.tokens.refreshToken);
    return result;
  },

  async login(email: string, password: string): Promise<AuthResult> {
    const { data } = await api.post("/auth/login", { email, password });
    const result = data.data;
    localStorage.setItem("ff_token", result.tokens.accessToken);
    localStorage.setItem("ff_refresh", result.tokens.refreshToken);
    return result;
  },

  async logout(): Promise<void> {
    try { await api.post("/auth/logout"); } catch { /* ok */ }
    localStorage.removeItem("ff_token");
    localStorage.removeItem("ff_refresh");
    localStorage.removeItem("ff_mentor_session");
  },

  async me() {
    const { data } = await api.get("/auth/me");
    return data.data?.user;
  },

  isLoggedIn(): boolean {
    return !!localStorage.getItem("ff_token");
  },
};
