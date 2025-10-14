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
  // ✅ ใช้ origin ของ client (ห้ามใส่ path เช่น /login)
  CLIENT_URL = "https://project-webapp-client.vercel.app",
  COOKIE_SECURE = "true",   // Railway อยู่หลัง HTTPS → true แนะนำ
  COOKIE_SAMESITE = "None", // ให้ตรงกับการส่งคุกกี้ข้ามโดเมน
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
app.use(cookieParser()); // ต้องอยู่ก่อน app.use(router)

// ✅ ถ้าอยู่หลัง HTTPS/Proxy และจะตั้ง cookie แบบ secure
if (COOKIE_SECURE === "true") {
  app.set("trust proxy", 1);
}

// ✅ เปิด CORS ให้ส่งคุกกี้ได้ (อนุญาตเฉพาะโดเมน frontend)
app.use(
  cors({
    origin: CLIENT_URL, // e.g. 'https://project-webapp-client.vercel.app'
    credentials: true,  // อนุญาตส่งคุกกี้/เฮดเดอร์รับรองตัวตน
  })
);

/* -------- Static uploads (ephemeral on Railway) -------- */
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

/* -------- Health check -------- */
app.get("/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

/* -------- Error handler -------- */
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ ok: false, error: err.message });
});

/* -------- Start -------- */
app.listen(Number(PORT), () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
