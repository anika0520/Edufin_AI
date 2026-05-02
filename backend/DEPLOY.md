# FutureFin AI — Quick Start Guide

## ✅ Zero Config Local Setup (5 minutes)

### Requirements

- Node.js 18+ (https://nodejs.org)
- A free Groq API key (https://console.groq.com) — takes 30 seconds to get

**No PostgreSQL, no Redis, no Docker needed.**

---

### Step 1 — Get Groq API Key (free)

1. Go to https://console.groq.com
2. Sign up → Create API Key → copy it

---

### Step 2 — Backend Setup

```bash
cd backend

# Copy env file
copy .env.example .env        # Windows
# cp .env.example .env        # Mac/Linux

# Edit .env — set these 3 values:
# GROQ_API_KEY=gsk_...your key...
# JWT_SECRET=any_long_random_string_at_least_32_chars
# JWT_REFRESH_SECRET=another_different_long_random_string

# Install dependencies
npm install

# Create database + tables (auto-creates data/FutureFin.sqlite)
npm run migrate

# Add demo account (optional)
npm run seed

# Start backend
npm run dev
```

Backend runs on http://localhost:3000
Health check: http://localhost:3000/health

---

### Step 3 — Frontend Setup

Open a NEW terminal:

```bash
cd frontend

# Install dependencies
npm install

# Set backend URL
echo VITE_API_URL=http://localhost:3000/api/v1 > .env

# Start frontend
npm run dev
```

Frontend runs on http://localhost:5173 (or 8080)

---

### Step 4 — Use the App

1. Open http://localhost:5173
2. Register a new account OR login with demo: `demo@FutureFin.ai` / `Demo@1234`
3. Complete the 5-step Profile wizard
4. Click **Run AI Analysis** → real Groq AI responses
5. Explore Dashboard, Simulate, Compare, AI Mentor chat

---

## 📁 Database Location

SQLite database is stored at: `backend/data/FutureFin.sqlite`

- Auto-created on first run
- Backed up to disk every 30 seconds
- To reset: delete `backend/data/FutureFin.sqlite` and re-run `npm run migrate`

---

## ⚡ npm Scripts Reference

```bash
# Backend
npm run dev      # Start with auto-reload (nodemon)
npm start        # Start production
npm run migrate  # Create/update database tables
npm run seed     # Add demo user and profile
npm test         # Run test suite (41 tests)
npm run setup    # migrate + seed in one command
```

---

## 🌐 Deploy to Render (free)

1. Push code to GitHub
2. Create a **Web Service** on Render → connect repo
3. Set:
   - **Build**: `cd backend && npm install`
   - **Start**: `node backend/src/app.js`
4. Add env vars (GROQ_API_KEY, JWT_SECRET, JWT_REFRESH_SECRET, NODE_ENV=production)
5. Create a **Static Site** for frontend:
   - **Build**: `cd frontend && npm install && npm run build`
   - **Publish**: `frontend/dist`
   - Set: `VITE_API_URL=https://your-backend.onrender.com/api/v1`

---

## 🔑 Generate Strong JWT Secrets

```bash
# Windows PowerShell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Run TWICE — use one for JWT_SECRET, other for JWT_REFRESH_SECRET
```

---

## 🐛 Common Issues

| Problem                   | Fix                                                   |
| ------------------------- | ----------------------------------------------------- |
| `vite not found`          | Run `npm install` in the `frontend/` folder first     |
| `EPERM` errors on Windows | Close all terminals, delete `node_modules`, reinstall |
| AI returns no response    | Check `GROQ_API_KEY` in `backend/.env`                |
| `JWT_SECRET too short`    | Must be at least 32 characters                        |
| Port 3000 in use          | Set `PORT=3001` in `backend/.env`                     |
| Can't login               | Run `npm run migrate` first to create tables          |

---

## 📌 Disclaimer

FutureFin AI provides probabilistic analysis for **educational purposes only** — not financial advice. Consult a qualified professional before making financial decisions.
