const express = require('express');
const router = express.Router();
const Booking = require('../model/book');
const User = require('../model/user');
const auth = require('../middleware/auth');

// ✅ สร้างการจอง (ของเดิม)
router.post('/', auth, async (req, res) => {
  try {
    const { room, date, startTime, endTime, people, objective } = req.body;

    if (!room || !date || !startTime || !endTime || !people || !objective) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (endTime <= startTime) {
      return res.status(400).json({ error: 'endTime must be after startTime' });
    }

    const user = await User.findById(req.user.id).select('username email student_number');
    if (!user) return res.status(404).json({ error: 'User not found' });

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
      // status, tracking ใช้ค่า default
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

// ✅ ของเดิม (admin/all) – คงไว้
router.get('/', auth, async (_req, res) => {
  try {
    const list = await Booking.find().sort({ createdAt: -1 }).limit(10);
    res.json(list);
  } catch (err) {
    console.error('Get booking error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ✅ ใหม่: เฉพาะของตัวเอง
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('username email student_number photoUrl');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const rows = await Booking.find({ userid: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    // แปลง field เป็น camelCase ให้ frontend ใช้ง่าย
    const bookings = rows.map(b => ({
      _id: b._id,
      room: b.room,
      date: b.date, // ISO string/Date ให้ format ที่ frontend
      startTime: b.start_time,
      endTime: b.end_time,
      people: b.people,
      objective: b.objective,
      status: b.status || 'pending',
      tracking: b.tracking || 'กำลังดำเนินการ...'
    }));

    return res.json({
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        student_number: user.student_number,
        photoUrl: user.photoUrl || 'https://placehold.co/200x200?text=Profile'
      },
      bookings
    });
  } catch (err) {
    console.error('Get my bookings error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ✅ ใหม่: ยกเลิกเฉพาะของตัวเอง
router.patch('/:id/cancel', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const bk = await Booking.findOne({ _id: id, userid: req.user.id });
    if (!bk) return res.status(404).json({ error: 'ไม่พบรายการจองของคุณ' });

    if (bk.status === 'done')
      return res.status(400).json({ error: 'รายการที่เสร็จสิ้นแล้ว ยกเลิกไม่ได้' });

    bk.status = 'cancel';
    await bk.save();

    return res.json({
      message: 'ยกเลิกสำเร็จ',
      booking: {
        _id: bk._id,
        room: bk.room,
        date: bk.date,
        startTime: bk.start_time,
        endTime: bk.end_time,
        people: bk.people,
        objective: bk.objective,
        status: bk.status,
        tracking: bk.tracking
      }
    });
  } catch (err) {
    console.error('Cancel booking error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
