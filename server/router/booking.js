const express = require('express');
const router = express.Router();
const Booking = require('../model/book');
const User = require('../model/user');
const auth = require('../middleware/auth');

// ✅ ใช้ auth middleware ทุก route
router.post('/', auth, async (req, res) => {
  try {
    const { room, date, startTime, endTime, people, objective } = req.body;

    if (!room || !date || !startTime || !endTime || !people || !objective) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (endTime <= startTime) {
      return res.status(400).json({ error: 'endTime must be after startTime' });
    }

    // ✅ ดึง user จาก DB
    const user = await User.findById(req.user.id).select('username email student_number');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const created = await Booking.create({
      userid: user._id,
      student_number: user.student_number || null,
      student_name: user.username || null,
      student_email: user.email || null,
      room,
      date: new Date(date),
      start_time: startTime,
      end_time: endTime,
      people: Number(people),
      objective
    });

    return res.status(201).json({
      id: created._id,
      username: created.student_name,
      email: created.student_email,
      message: 'Booked'
    });
  } catch (err) {
    console.error('Create booking error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/booking (protected)
router.get('/', auth, async (_req, res) => {
  try {
    const list = await Booking.find().sort({ createdAt: -1 }).limit(10);
    res.json(list);
  } catch (err) {
    console.error('Get booking error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
