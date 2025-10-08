// server/index.js
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();

/* -------- ENV -------- */
const {
  PORT = 5000,
  MONGO_URI,
  CLIENT_URL = "http://localhost:5174",
  COOKIE_SECURE = "false", // 'true' เมื่อหลัง HTTPS/Proxy
} = process.env;

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

// ✅ เปิด CORS ให้ส่งคุกกี้ได้
app.use(
  cors({
    origin: CLIENT_URL, // e.g. 'http://localhost:5174'
    credentials: true,
  })
);

// ✅ ถ้าอยู่หลัง HTTPS/Proxy และจะตั้ง cookie แบบ secure
if (COOKIE_SECURE === "true") {
  app.set("trust proxy", 1);
}

app.use(cookieParser());

/* -------- Routes -------- */
const authRoutes = require("./router/auth");
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
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
