# 🎓 FutureFin AI — Your AI Life Decision Partner

> _Not just loan eligibility. Your entire education future — simulated, scored, and optimized._

**FutureFin AI** is an intelligent education finance platform that goes far beyond traditional loan assessment. It uses advanced AI to simulate life outcomes, predict risks, build a digital twin of the student, and guide both students and parents toward confident, informed decisions.

---

## 🚀 What's New in v2.0

| Engine                            | Description                                                           | Wow Factor          |
| --------------------------------- | --------------------------------------------------------------------- | ------------------- |
| ⚡ **Future Simulation Engine**   | "What if I go to Canada vs India?" — full life outcome comparison     | 🔥 Game Changer     |
| 🎯 **Reality Check Score**        | Honest probability scoring — "Your dream has 32% success probability" | 💯 Trustworthy      |
| 🧬 **Student Digital Twin**       | Virtual model of the student — evolves with decisions                 | 🤯 Next Level       |
| ⚠️ **Dropout Risk Predictor**     | Predicts dropout, semester failure, job market failure                | 🏦 Banks Love This  |
| 🤝 **AI Loan Negotiator**         | Optimal loan strategy — "Take ₹10L not ₹15L → reduces risk 40%"       | 💡 Unique           |
| 💭 **Regret Minimization Engine** | "5 years later, will you regret this?" — Bezos Framework              | 🧠 Psychological    |
| 👨‍👩‍👧 **Parent Mode**                | Simple, risk-focused report for Indian parents                        | 🇮🇳 India-Specific   |
| ⚖️ **Ethical AI Layer**           | Transparent, accountable, probabilistic AI                            | 🏆 Judges Love This |

---

## 🏗️ Architecture

```
FutureFin AI v2.0
├── Core Engines (v1.0)
│   ├── Career Engine           — AI career path recommendations
│   ├── University Recommender  — Admission probability + fit scoring
│   ├── ROI Calculator          — Financial return on education investment
│   ├── Loan Eligibility        — Alternative credit scoring for students
│   ├── Behavioral Intelligence — Engagement tracking + nudges
│   └── AI Mentor Chatbot       — Personalized guidance
│
├── Advanced Engines (v2.0) ← NEW
│   ├── Future Simulation       — "What If" life decision simulator
│   ├── Reality Check Score     — Honest probability engine
│   ├── Digital Twin            — Virtual student model
│   ├── Dropout Risk Predictor  — Early warning system
│   ├── AI Loan Negotiator      — Loan strategy optimizer
│   ├── Regret Engine           — Bezos regret minimization
│   ├── Parent Mode             — Simplified parent communication
│   └── Ethical AI Layer        — Transparency + accountability
│
└── Infrastructure
    ├── PostgreSQL              — Primary database
    ├── Redis                   — Caching layer
    ├── Socket.IO               — Real-time updates
    └── AI Provider (Groq/OpenAI/Ollama)
```

---

## 📡 API Reference

### Core Endpoints (v1.0)

| Method | Endpoint                               | Description                |
| ------ | -------------------------------------- | -------------------------- |
| POST   | `/api/v1/auth/register`                | User registration          |
| POST   | `/api/v1/auth/login`                   | Authentication             |
| GET    | `/api/v1/career/recommendations`       | AI career recommendations  |
| GET    | `/api/v1/universities/recommendations` | University recommendations |
| POST   | `/api/v1/roi/calculate`                | ROI analysis               |
| POST   | `/api/v1/loan/assess`                  | Loan eligibility           |
| GET    | `/api/v1/dashboard`                    | Full dashboard summary     |

### Advanced Engines (v2.0) — NEW

| Method | Endpoint                                 | Description                     |
| ------ | ---------------------------------------- | ------------------------------- |
| POST   | `/api/v1/simulation/run`                 | Run a "What If" simulation      |
| POST   | `/api/v1/simulation/compare-countries`   | Compare two countries           |
| GET    | `/api/v1/simulation/history`             | Get past simulations            |
| POST   | `/api/v1/reality-check`                  | Generate Reality Check Score    |
| GET    | `/api/v1/digital-twin`                   | Get/create Digital Twin         |
| POST   | `/api/v1/digital-twin/event`             | Apply life event to twin        |
| POST   | `/api/v1/digital-twin/refresh`           | Refresh twin                    |
| GET    | `/api/v1/dropout-risk/predict`           | Dropout & failure prediction    |
| POST   | `/api/v1/loan/negotiate`                 | AI loan negotiation strategy    |
| POST   | `/api/v1/loan/compare-scenarios`         | Compare loan scenarios          |
| GET    | `/api/v1/regret-analysis`                | Regret minimization analysis    |
| GET    | `/api/v1/parent-report`                  | Generate parent-friendly report |
| GET    | `/api/v1/ethical-ai/principles`          | AI ethics principles            |
| GET    | `/api/v1/ethical-ai/transparency-report` | Full AI transparency report     |
| GET    | `/api/v1/intelligence-report`            | Master intelligence report      |

---

## 🔧 Quick Start

### 1. Clone & Install

```bash
git clone <repo>
cd FutureFin-ai
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env — minimum required:
# - DATABASE_URL
# - GROQ_API_KEY (free at console.groq.com)
# - JWT_SECRET
```

### 3. Run Database Migrations

```bash
npm run migrate
npm run seed   # optional: seed with sample data
```

### 4. Start

```bash
npm run dev    # development (with hot reload)
npm start      # production
```

### 5. Verify

```bash
curl http://localhost:3000/health
curl http://localhost:3000/
```

---

## 🤖 AI Providers

| Provider   | Cost | Setup                                | Best For                |
| ---------- | ---- | ------------------------------------ | ----------------------- |
| **Groq**   | FREE | `GROQ_API_KEY` from console.groq.com | Hackathon / Development |
| **OpenAI** | Paid | `OPENAI_API_KEY`                     | Production              |
| **Ollama** | FREE | Run locally, no key needed           | Offline / Privacy       |

---

## 🗄️ Database

PostgreSQL 14+ required. All tables are created via `npm run migrate`.

**New v2.0 Tables:**

- `digital_twins` — Student digital twin state
- `digital_twin_events` — Twin event history
- `reality_checks` — Reality check score results
- `dropout_risk_predictions` — Failure predictions
- `loan_negotiations` — Loan strategy records
- `regret_analyses` — Regret minimization results
- `parent_reports` — Parent-mode report records

---

## ⚖️ Ethical AI Statement

FutureFin AI is built on responsible AI principles:

- ✅ **Probabilistic, not deterministic** — We give probabilities, never guarantees
- ✅ **Transparent** — Every AI decision is logged and explainable
- ✅ **Honest** — We tell students the truth, even when it's uncomfortable
- ✅ **Non-discriminatory** — No bias based on gender, race, or nationality
- ✅ **Human-first** — AI assists humans, it doesn't replace professional advice
- ✅ **Student wellbeing** — Engagement metrics never override student interests

> _"We do NOT guarantee outcomes. This is probabilistic advice to help you make better decisions."_

---

## 🏆 Competitive Edge

What makes FutureFin AI different from every other edtech/fintech platform:

1. **It simulates LIFE, not just loans** — Other platforms tell you if you qualify. We show you your life in 5 years.
2. **Digital Twin concept** — Nobody else models the student as a living, evolving entity.
3. **Regret Engine** — No financial platform has applied the Bezos Regret Minimization Framework.
4. **Parent Mode** — Critical for India, missed by everyone else.
5. **Ethical AI Layer** — Banks and judges trust AI that admits uncertainty.
6. **Honest, not just optimistic** — We tell you your dream has 32% success probability. Others just say "approved."

---

## 📦 Docker

```bash
docker-compose up -d
```

Services: `app` (Node.js), `postgres`, `redis`

---

_Built with ❤️ for students making the biggest financial decision of their lives._
