require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const path = require("path");

// Routers
const authRoutes = require("./router/auth");
const profileRoutes = require("./router/profile");
const bookingRoutes = require("./router/booking");
const roomsRouter = require("./router/rooms");
const adminHistoryRoutes = require("./router/admin_history");
const adminUsersRoutes = require("./router/admin_users");
const adminStatsRoutes = require("./router/admin.stats");
const feedbackRoutes = require("./router/feedback");
const adminFeedbackRoutes = require("./router/admin_feedback");
const trackingRoutes = require("./router/tracking");
const roomMediaRoutes = require("./router/roomMedia");
const allImagesRoutes = require("./router/allImages");

const app = express();

/* -------- ENV -------- */
const {
  PORT = 5000,
  MONGO_URI,
  CLIENT_URL = "https://www.kmitl-rbs.online",
  COOKIE_SECURE = "true",
  COOKIE_SAMESITE = "None",
} = process.env;

if (!MONGO_URI) {
  console.error("❌ Missing MONGO_URI in .env");
  process.exit(1);
}

/* -------- DB -------- */
mongoose
  .connect(MONGO_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8000,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((e) => {
    console.error("❌ MongoDB connection error:", e?.message || e);
    process.exit(1);
  });

/* -------- Middlewares -------- */
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// ถ้าอยู่หลัง HTTPS/Proxy และตั้งคุกกี้แบบ secure
if (COOKIE_SECURE === "true") {
  app.set("trust proxy", 1);
}

/* -------- Security Headers -------- */
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  res.setHeader("Permissions-Policy", "browsing-topics=()");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

/* -------- CORS -------- */
const allowlist = new Set(
  [
    "https://kmitl-rbs.online",
    "https://www.kmitl-rbs.online",
    "https://project-webapp-dku4.onrender.com",
    CLIENT_URL,
    process.env.CLIENT_URL_2,
    process.env.CLIENT_URL_3,
  ].filter(Boolean)
);

const isVercelPreview = (origin = "") =>
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow server-to-server
    const ok = allowlist.has(origin) || isVercelPreview(origin);
    cb(ok ? null : new Error("CORS blocked"), ok);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* -------- Static uploads -------- */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* -------- Cookie Example (Clean / Debug) -------- */
app.post("/api/debug-cookie", (req, res) => {
  res.cookie("debug_token", "demo123", {
    httpOnly: true,
    secure: COOKIE_SECURE === "true",
    sameSite: COOKIE_SAMESITE,
    maxAge: 1000 * 60 * 30,
  });
  res.json({ ok: true, msg: "Cookie set OK" });
});

/* -------- Routes -------- */
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/rooms", roomsRouter);
app.use("/api/admin/history", adminHistoryRoutes);
app.use("/api/admin/users", adminUsersRoutes);
app.use("/api/admin", adminStatsRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/admin/feedbacks", adminFeedbackRoutes);
app.use("/api/tracking", trackingRoutes);
app.use("/api", roomMediaRoutes);
app.use("/api", allImagesRoutes);

/* -------- Health check -------- */
app.get("/health", (_req, res) =>
  res.json({ ok: true, time: new Date().toISOString() })
);

/* -------- Error handler -------- */
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ ok: false, error: err.message });
});

/* -------- Start -------- */
app.listen(Number(PORT), () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
