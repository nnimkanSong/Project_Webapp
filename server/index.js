const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Routes & middleware
const authRoutes = require('./router/auth');
const bookingRoutes = require('./router/booking');
const verify = require('./middleware/auth');
const profileRoutes = require('./router/profile');

// Middlewares
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
app.use('/api/auth', authRoutes);           // public
app.use('/api/booking', verify, bookingRoutes); // protected
app.use("/api/bookings", require("./router/booking"));
// เส้นอื่น ๆ เหมือนเดิม...
app.use('/uploads', express.static('uploads')); // ให้เข้าถึงไฟล์ /uploads ด้วย URL
app.use('/api/profile', profileRoutes);
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));
app.listen(5000, () => console.log("Server on :5000"));
