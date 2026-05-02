// src/app.js — FutureFin AI v2.0  (Production-Hardened)
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const logger = require("./utils/logger");
const { testConnection } = require("./database/connection");
const { getClient: getRedisClient } = require("./config/redis");
const routes = require("./routes/index");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const { correlationId, strictSecurity } = require("./middleware/security");

const app = express();
const httpServer = createServer(app);

// ─── Allowed origins ──────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:8080")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins.includes("*") ? "*" : allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ─── Trust proxy (Nginx / Render / Railway) ──────────────────────────────────
app.set("trust proxy", 1);

// ─── Security headers (Helmet + custom) ──────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // needed for Vite SPA
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "https://api.groq.com",
          "https://api.openai.com",
        ],
        fontSrc: ["'self'", "https:"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(strictSecurity);

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin))
        return cb(null, true);
      cb(new Error("CORS: origin " + origin + " not allowed"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Session-ID",
      "X-Correlation-ID",
    ],
    credentials: true,
    optionsSuccessStatus: 200,
  }),
);

// ─── Request correlation IDs ──────────────────────────────────────────────────
app.use(correlationId);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── HTTP logging ─────────────────────────────────────────────────────────────
app.use(
  morgan("combined", {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip: (req) => req.path === "/health",
  }),
);

// ─── Global IP-based rate limiter ─────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.ip,
  message: {
    success: false,
    message: "Too many requests, please try again later",
  },
});
app.use("/api/", globalLimiter);

// ─── Strict per-IP rate limiter for auth endpoints ────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many auth attempts" },
});
app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/auth/register", authLimiter);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", async (req, res) => {
  const dbOk = await testConnection();
  const aiProvider = require("./config/ai-provider");
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? "healthy" : "degraded",
    service: "FutureFin AI",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    services: {
      database: dbOk ? "connected" : "disconnected",
      ai: process.env.AI_PROVIDER || "groq",
    },
    aiCosts: aiProvider.getCostSummary(),
    ethical_ai: true,
    disclaimer:
      "FutureFin AI provides probabilistic analysis — not guarantees. Consult qualified professionals.",
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/v1", routes);

// ─── Serve Frontend in Production ────────────────────────────────────────────
const frontendDist = path.join(__dirname, "../../frontend/dist");
if (fs.existsSync(frontendDist)) {
  logger.info("Serving built frontend from: " + frontendDist);
  app.use(express.static(frontendDist, { maxAge: "1d" }));
  app.get("*", (req, res) =>
    res.sendFile(path.join(frontendDist, "index.html")),
  );
} else {
  app.use(notFound);
}

// ─── Error Handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const connectedUsers = new Map();
io.on("connection", (socket) => {
  logger.debug("Socket connected:", socket.id);

  socket.on("authenticate", (userId) => {
    connectedUsers.set(userId, socket.id);
    socket.join("user:" + userId);
  });

  socket.on("behavioral_event", async (data) => {
    if (data.userId) {
      try {
        const behavioralService = require("./modules/behavioral/behavioral.service");
        await behavioralService.trackEvent(data.userId, data);
      } catch (e) {
        logger.debug("Socket behavioral event error:", e.message);
      }
    }
  });

  socket.on("twin_event", async (data) => {
    if (data.userId && data.eventType) {
      try {
        const digitalTwinService = require("./modules/digital-twin/digital-twin.service");
        const result = await digitalTwinService.applyTwinEvent(data.userId, {
          eventType: data.eventType,
          eventDetails: data.eventDetails || {},
        });
        socket.emit("twin_updated", result);
      } catch (e) {
        logger.debug("Socket twin event error:", e.message);
      }
    }
  });

  socket.on("disconnect", () => {
    for (const [uid, sid] of connectedUsers) {
      if (sid === socket.id) connectedUsers.delete(uid);
    }
  });
});
app.set("io", io);
app.set("connectedUsers", connectedUsers);

// ─── Startup ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const start = async () => {
  logger.info("Starting FutureFin AI Platform v2.0...");
  const dbOk = await testConnection();
  if (!dbOk) {
    logger.error("Database connection failed. Exiting.");
    process.exit(1);
  }
  try {
    await getRedisClient();
  } catch (e) {
    logger.warn("Redis unavailable — using in-memory fallback.");
  }

  httpServer.listen(PORT, () => {
    logger.info("─".repeat(60));
    logger.info("🎓 FutureFin AI Platform v2.0 running on port " + PORT);
    logger.info(
      "🔒 Security: PII redaction ON | Input validation ON | Circuit breakers ON",
    );
    logger.info(
      "🤖 AI Provider: " +
        (process.env.AI_PROVIDER || "groq") +
        " (with fallback chain)",
    );
    logger.info("📊 Environment: " + (process.env.NODE_ENV || "development"));
    logger.info("─".repeat(60));
  });
};

start().catch((err) => {
  logger.error("Fatal startup error:", err);
  process.exit(1);
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Shutting down gracefully...");
  httpServer.close(() => {
    logger.info("HTTP server closed.");
    process.exit(0);
  });
});
process.on("unhandledRejection", (reason) =>
  logger.error("Unhandled Rejection:", reason),
);
process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception:", err);
  process.exit(1);
});

module.exports = { app, io };
