// server/index.js
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');

const app = express();

const {
  MONGO_URI,
  CLIENT_URL = 'http://localhost:5174',
  SESSION_SECRET = 'change-me',
  COOKIE_SECURE = 'false',
  COOKIE_SAMESITE = 'Lax',
  SESSION_TTL_HOURS = '24',
  PORT = 5000,
} = process.env;

if (!MONGO_URI) {
  console.error('❌ Missing MONGO_URI in .env');
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((e) => {
    console.error('❌ MongoDB connection error:', e);
    process.exit(1);
  });

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

if (COOKIE_SECURE === 'false') {
  app.set('trust proxy', 1);
}

app.use(
  session({
    name: 'sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: MONGO_URI,
      ttl: parseInt(SESSION_TTL_HOURS, 10) * 60 * 60,
    }),
    cookie: {
      httpOnly: true,
      sameSite: COOKIE_SAMESITE,
      secure: COOKIE_SECURE === 'true',
      path: '/',
      maxAge: parseInt(SESSION_TTL_HOURS, 10) * 60 * 60 * 1000,
    },
    rolling: true,
  })
);

const authRoutes = require('./router/auth');
app.use('/api/auth', authRoutes);

try { app.use('/api/profile', require('./router/profile')); } catch {}
try { app.use('/api/bookings', require('./router/booking')); } catch {}
try { app.use('/api/admin/history', require('./router/admin_history')); } catch {}

app.use('/uploads', express.static('uploads'));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ ok: false, error: err.message });
});

app.listen(Number(PORT), () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
