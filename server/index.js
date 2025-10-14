// server/index.js
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

const app = express();

/* -------- ENV -------- */
const {
  PORT = 5000,
  MONGO_URI,
  CLIENT_URL = "https://project-webapp-client.vercel.app",
  COOKIE_SECURE = "true",
  COOKIE_SAMESITE = "None",
} = process.env;

console.log("[BOOT] starting server with PORT=", PORT);
console.log("[BOOT] CLIENT_URL=", CLIENT_URL);

/* -------- Middlewares -------- */
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
if (COOKIE_SECURE === "true") app.set("trust proxy", 1);

// CORS + preflight
const allowlist = [CLIENT_URL];
const corsOptions = {
  origin(origin, cb) {
    const ok = !origin || allowlist.includes(origin);
    cb(ok ? null : new Error("CORS blocked: " + origin), ok);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Health check (มาก่อนทุกอย่าง)
app.get("/health", (_req, res) =>
  res.json({ ok: true, time: new Date().toISOString() })
);

/* -------- Static -------- */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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

/* -------- Error handler -------- */
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ ok: false, error: err.message });
});

/* -------- Start HTTP first -------- */
app.listen(Number(PORT), () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 CORS allowed origin: ${CLIENT_URL}`);
  // ต่อ DB แบบ async หลังจาก bind port สำเร็จแล้ว (กัน Render timeout)
  if (!MONGO_URI) {
    console.error("❌ Missing MONGO_URI in env — API up but DB disabled");
    return;
  }
  mongoose
    .connect(MONGO_URI, { maxPoolSize: 10, serverSelectionTimeoutMS: 8000 })
    .then(() => console.log("✅ MongoDB connected"))
    .catch((e) => {
      console.error("❌ MongoDB connection error:", e?.message || e);
      // ไม่ exit: ให้เว็บยังตอบ /health ได้ เพื่อไม่โดน “no open ports”
    });
});
