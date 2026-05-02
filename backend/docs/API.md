# FutureFin AI v2.0 — Complete API Documentation

**Base URL:** `http://localhost:3000/api/v1`
**Auth:** Bearer JWT token in `Authorization` header

---

## Authentication

### Register

`POST /auth/register`

```json
{
  "email": "student@example.com",
  "password": "secure123",
  "firstName": "Arjun",
  "lastName": "Sharma"
}
```

### Login

`POST /auth/login`

```json
{ "email": "student@example.com", "password": "secure123" }
```

Returns: `{ token, refreshToken, user }`

---

## ⚡ Future Simulation Engine

### Run "What If" Simulation

`POST /simulation/run`

```json
{
  "scenarioType": "country_comparison",
  "scenarioParams": {
    "country_a": "USA",
    "country_b": "Canada",
    "description": "Comparing MS in USA vs Canada"
  },
  "baseRoiId": "optional-roi-uuid"
}
```

**Scenario Types:**

- `country_comparison` — Compare two countries
- `job_delay` — What if job search takes 6+ months
- `salary_drop` — What if starting salary is lower
- `career_switch` — What if switching careers
- `scholarship_received` — What if scholarship is awarded
- `masters_vs_work` — What if skipping masters

**Returns:** Full salary timeline comparison, loan stress analysis, mentor advice

### Compare Two Countries

`POST /simulation/compare-countries`

```json
{
  "countryA": "USA",
  "countryB": "Canada",
  "universityA": "University of Texas",
  "universityB": "University of Toronto"
}
```

### Get Simulation History

`GET /simulation/history`

---

## 🎯 Reality Check Score

### Generate Reality Check

`POST /reality-check`

```json
{
  "universityRecommendationId": "uuid",
  "loanAmount": 80000,
  "targetCountry": "USA"
}
```

**Returns:**

- `overall_success_probability` — 0-100%
- `reality_verdict` — 🟢/🟡/🔴 with explanation
- `dimension_scores` — Academic, Financial, Career, Loan Safety
- `red_flags` — Honest warnings
- `probability_breakdown` — Per-milestone success probabilities
- `honest_mentor_message` — Real talk advice

---

## 🧬 Student Digital Twin

### Get or Create Twin

`GET /digital-twin`

**Returns:** Full virtual model with:

- `current_state` — Skills, career readiness, financial health scores
- `life_trajectory` — Year-by-year milestones
- `financial_twin` — Net worth projections through 10 years
- `career_twin` — Career level projections
- `risk_profile` — All risk scores
- `twin_message` — Message from your future self

### Apply Life Event to Twin

`POST /digital-twin/event`

```json
{
  "eventType": "scholarship_received",
  "eventDetails": { "amount": 20000, "university": "MIT" }
}
```

**Event Types:** `scholarship_received`, `job_offer_received`, `admission_received`, `loan_approved`, `semester_completed`, `internship_completed`, `certification_earned`, `skill_added`, `setback_occurred`

### Refresh Twin

`POST /digital-twin/refresh`

---

## ⚠️ Dropout Risk Predictor

### Get Risk Prediction

`GET /dropout-risk/predict`
`POST /dropout-risk/predict`

```json
{
  "universityRecommendationId": "uuid",
  "loanAmount": 80000
}
```

**Returns:**

- `dropout_probability` — 0-100%
- `semester_failure_probability`
- `job_search_success_probability`
- `loan_default_probability_3yr` / `_5yr`
- `bank_risk_assessment` — For lender use
- `early_warning_system` — Red alerts + yellow warnings
- `intervention_plan` — Actionable prevention steps

---

## 🤝 AI Loan Negotiator

### Generate Negotiation Strategy

`POST /loan/negotiate`

```json
{
  "requestedAmount": 100000,
  "universityRecommendationId": "uuid",
  "roiAnalysisId": "uuid"
}
```

**Returns:**

- `optimal_loan_strategy` — Recommended amount + why
- `negotiation_tactics` — How to get lower rates
- `emi_optimization` — Step-up EMI strategies
- `alternative_financing` — ISA, scholarships, hybrid options
- `interest_reduction_playbook` — Step-by-step negotiation
- `loan_safety_check` — EMI vs salary safety assessment

### Compare Loan Scenarios

`POST /loan/compare-scenarios`

```json
{
  "scenarios": [
    {
      "label": "Option A: ₹10L, 8%, 10yr",
      "amount": 100000,
      "rate": 8,
      "term": 120
    },
    {
      "label": "Option B: ₹15L, 9%, 15yr",
      "amount": 150000,
      "rate": 9,
      "term": 180
    }
  ]
}
```

**Returns:** EMI, total payment, total interest, interest-to-principal ratio for each

---

## 💭 Regret Minimization Engine

### Get Regret Analysis

`GET /regret-analysis?decisionType=studying_abroad`
`POST /regret-analysis`

```json
{
  "decisionType": "studying_abroad",
  "decisionDetails": { "country": "USA", "cost": 120000, "duration": "2 years" }
}
```

**Returns:**

- `regret_score` — 0-100 (lower = less regret risk)
- `regret_level` — very low / low / moderate / high / very high
- `bezos_test` — "At 80, will you regret NOT doing this?"
- `5_year_scenarios` — Best/likely/worst case at 5 years
- `stress_vs_reward_balance`
- `mentor_wisdom` — Life advice, not financial jargon

---

## 👨‍👩‍👧 Parent Mode

### Generate Parent Report

`GET /parent-report`
`POST /parent-report`

```json
{ "language": "english", "currency": "INR" }
```

**Returns:**

- `plan_summary` — Simple explanation of student's plan
- `is_it_safe` — Green/yellow/red safety assessment
- `money_questions_answered` — "How much do we need?" etc.
- `child_career_outlook` — Earning potential in plain language
- `risk_traffic_light` — Visual risk indicators
- `loan_safety_for_parents` — EMI in INR, when it starts
- `reassurance_message` — Warm message to parents

---

## ⚖️ Ethical AI Layer

### Get AI Principles

`GET /ethical-ai/principles`
No auth required.

### Get Transparency Report

`GET /ethical-ai/transparency-report`
Returns full log of all AI decisions made about this student, with explanation of data used and rights.

---

## 📊 Master Intelligence Report

### Get Full Intelligence Dashboard

`GET /intelligence-report`
Returns everything in one call: profile, careers, universities, loan, behavioral score, simulations, AI decisions, and links to all available engines.

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": []
}
```

**HTTP Status Codes:**

- `200` — Success
- `201` — Created
- `400` — Bad request / validation error
- `401` — Unauthorized
- `403` — Forbidden
- `404` — Not found
- `429` — Rate limit exceeded
- `500` — Internal server error

---

_FutureFin AI v2.0 — Probabilistic analysis, not guaranteed outcomes._
