// server/index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Routes & middleware
const authRoutes = require('./router/auth');
const profileRoutes = require('./router/profile');
const adminBookingRoutes = require('./router/admin_history');
const feedbackRoutes = require("./router/feedback");
const admin_feedbackRoutes = require("./router/admin_feedback");

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5174',
  credentials: true
}));
app.use(express.json());

// DB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((e) => console.error('MongoDB error:', e));

// Routes
app.use('/api/auth', authRoutes);                 // public
app.use('/api/bookings', require('./router/booking')); // ✅ ใช้ไฟล์เดียว ชัดเจน
app.use('/api/profile', profileRoutes);
app.use("/api/admin/history", require("./router/admin_history"));
app.use('/uploads', express.static('uploads'));
app.use("/api/feedback", feedbackRoutes);
app.use("/api/admin/feedbacks", admin_feedbackRoutes);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));
