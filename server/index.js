// server/index.js (CommonJS)
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
require('dotenv').config();

const app = express();

// --- ENV ---
const {
  PORT = 5000,
  MONGO_URI,
  SESSION_SECRET = 'change-me',
  CORS_ORIGIN = 'http://localhost:5174',
  COOKIE_SECURE = 'false',        // true เมื่อรันหลัง HTTPS/Proxy
  COOKIE_SAMESITE = 'Lax',        // 'Lax'|'Strict'|'None' (ถ้าต่างโดเมนใช้ 'None' + SECURE=true)
  SESSION_TTL_HOURS = '24',
} = process.env;

// --- DB ---
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✅ Mongo connected'))
  .catch((e) => console.error('Mongo error:', e));

// --- Middlewares ---
app.use(express.json());

// ถ้าหน้าเว็บกับ API แยกโดเมน/พอร์ต ต้องเปิด credentials
app.use(
  cors({
    origin: CORS_ORIGIN,       // eg. 'http://localhost:5174'
    credentials: true,         // <<< สำคัญ เพื่อให้ส่ง/รับคุกกี้ได้
  })
);

// ถ้าอยู่หลัง proxy/https (เช่น Nginx, Cloudflare) ให้เปิดบรรทัดนี้ และตั้ง COOKIE_SECURE=true
// app.set('trust proxy', 1);

app.use(
  session({
    name: 'sid',                      // ชื่อคุกกี้
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: MONGO_URI,
      ttl: parseInt(SESSION_TTL_HOURS, 10) * 60 * 60, // วินาที
    }),
    cookie: {
      httpOnly: true,
      secure: COOKIE_SECURE === 'true',   // true เมื่อใช้ HTTPS
      sameSite: COOKIE_SAMESITE,          // 'Lax' ดีสุดถ้า same-domain
      maxAge: parseInt(SESSION_TTL_HOURS, 10) * 60 * 60 * 1000,
    },
    rolling: true, // ต่ออายุคุกกี้ทุก request
  })
);

// --- Routes ---
const authRoutes = require('./router/auth'); // ต้องใช้ req.session ใน router ด้วย
app.use('/api/auth', authRoutes);

// health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// error handler ง่ายๆ
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: err.message });
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
