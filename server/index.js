  // server/index.js
  require('dotenv').config();

  const express = require('express');
  const mongoose = require('mongoose');
  const cors = require('cors');
  const session = require('express-session');
  const MongoStore = require('connect-mongo');

  const app = express();

  /* -------- ENV -------- */
  const {
    PORT = 5000,
    MONGO_URI,
    SESSION_SECRET = 'change-me',
    CLIENT_URL = 'http://localhost:5174',
    COOKIE_SECURE = 'false',        // true เมื่อรันหลัง HTTPS/Proxy
    COOKIE_SAMESITE = 'Lax',        // 'Lax' | 'Strict' | 'None'
    SESSION_TTL_HOURS = '24',
  } = process.env;

  if (!MONGO_URI) {
    console.error('❌ Missing MONGO_URI in .env');
    process.exit(1);
  }

  /* -------- DB -------- */
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch((e) => {
      console.error('❌ MongoDB connection error:', e);
      process.exit(1);
    });

  /* -------- Middlewares -------- */
  app.use(express.json());

  // เปิด CORS ให้ส่งคุกกี้ได้
  app.use(
    cors({
      origin: CLIENT_URL,  // e.g. 'http://localhost:5174'
      credentials: true,
    })
  );

  // ถ้าใช้ HTTPS หลัง proxy (Nginx/Cloudflare/Render/Heroku) ให้เปิด trust proxy
  if (COOKIE_SECURE === 'true') {
    app.set('trust proxy', 1);
  }

  // เซสชันเก็บใน Mongo
  app.use(
    session({
      name: 'sid', // ชื่อคุกกี้
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: MONGO_URI,
        ttl: parseInt(SESSION_TTL_HOURS, 10) * 60 * 60, // วินาที
      }),
      cookie: {
        httpOnly: true,
        secure: COOKIE_SECURE === 'true', // ต้องเป็น true เมื่อใช้ HTTPS
        sameSite: COOKIE_SAMESITE,        // ถ้าข้ามโดเมนใช้ 'None' + secure=true
        maxAge: parseInt(SESSION_TTL_HOURS, 10) * 60 * 60 * 1000,
      },
      rolling: true, // ต่ออายุคุกกี้ทุก request
    })
  );

  /* -------- Routes -------- */
  const authRoutes = require('./router/auth');
  app.use('/api/auth', authRoutes);

  // ถ้ามีไฟล์เหล่านี้อยู่ ให้เปิดใช้งานได้เลย
  try {
    app.use('/api/profile', require('./router/profile'));
  } catch {}
  try {
    app.use('/api/bookings', require('./router/booking'));
  } catch {}
  try {
    app.use('/api/admin/history', require('./router/admin_history'));
  } catch {}

  // เสิร์ฟไฟล์อัปโหลด
  app.use('/uploads', express.static('uploads'));

  // Health check
  app.get('/health', (_req, res) => res.json({ ok: true }));

  // Error handler
  app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ ok: false, error: err.message });
  });

  /* -------- Start -------- */
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
