// server/index.js
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const roomsRouter = require("./router/rooms");

const app = express();

/* -------- ENV -------- */
const {
  PORT = 5000,
  MONGO_URI,
  CLIENT_URL = "http://localhost:5174",
  COOKIE_SECURE = "false",   // 'true' เมื่อหลัง HTTPS/Proxy
  COOKIE_SAMESITE = "Lax",   // เผื่อใช้ในจุดอื่นให้สอดคล้องกับ auth.js
} = process.env;
// Routes & middleware
const authRoutes = require('./router/auth');
const profileRoutes = require('./router/profile');
const adminBookingRoutes = require('./router/admin_history');
const feedbackRoutes = require("./router/feedback");
const admin_feedbackRoutes = require("./router/admin_feedback");

if (!MONGO_URI) {
  console.error("❌ Missing MONGO_URI in .env");
  process.exit(1);
}

/* -------- DB -------- */
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((e) => {
    console.error("❌ MongoDB connection error:", e);
    process.exit(1);
  });

/* -------- Middlewares -------- */
app.use(express.json());
app.use(cookieParser()); // ต้องอยู่ก่อน app.use(router)

// ✅ เปิด CORS ให้ส่งคุกกี้ได้
app.use(
  cors({
    origin: CLIENT_URL,     // e.g. 'http://localhost:5174'
    credentials: true,      // อนุญาตส่งคุกกี้/เฮดเดอร์รับรองตัวตน
  })
);

// ✅ ถ้าอยู่หลัง HTTPS/Proxy และจะตั้ง cookie แบบ secure
if (COOKIE_SECURE === "true") {
  app.set("trust proxy", 1);
}

/* -------- Routes -------- */
app.use("/api/auth", authRoutes);

try {
  app.use("/api/profile", require("./router/profile"));
} catch {}
try {
  app.use("/api/bookings", require("./router/booking"));
} catch {}
try {
  app.use("/api/admin/history", require("./router/admin_history"));
} catch {}
try {
  app.use("/api/admin/users", require("./router/admin_users"));
} catch {}
try {
  app.use("/uploads", express.static('uploads'));
} catch {}
try {
  app.use("/api/feedback", feedbackRoutes);
} catch {}
try {
  app.use("/api/admin/feedbacks", admin_feedbackRoutes);
} catch {}
app.use('/api/tracking', require('./router/tracking'));


// เสิร์ฟไฟล์อัปโหลด
app.use("/uploads", express.static("uploads"));

// Health check
app.get("/health", (_req, res) => res.json({ ok: true }));

// Error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ ok: false, error: err.message });
});

/* -------- Start -------- */
app.listen(Number(PORT), () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});


// const adminDash = require("./router/admin.dashboard");
// app.use("/api", adminDash);


// ✅ Mount routes
app.use("/api/bookings", require("./router/booking"));
app.use("/api/rooms", roomsRouter);
const adminStats = require("./router/admin.stats");
app.use("/api/admin", adminStats);
