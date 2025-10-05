// server/router/booking.js
const express = require('express');
const router = express.Router();
const Booking = require('../model/book');
const User = require('../model/user');
const auth = require('../middleware/auth');
const auth_feedback = require("../middleware/auth_feedback");

// สร้างการจอง
router.post('/', auth, async (req, res) => {
  try {
    const { room, date, startTime, endTime, people, objective } = req.body;
    if (!room || !date || !startTime || !endTime || !people || !objective) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    if (endTime <= startTime) {
      return res.status(400).json({ message: 'endTime must be after startTime' });
    }

    const user = await User.findById(req.user.id).select('username email student_number');
    if (!user) return res.status(404).json({ message: 'User not found' });

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
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

// (admin/all)
router.get('/', auth, async (_req, res) => {
  try {
    const list = await Booking.find().sort({ createdAt: -1 }).limit(10);
    res.json(list);
  } catch (err) {
    console.error('Get booking error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// เฉพาะของตัวเอง
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('username email student_number photoUrl');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const rows = await Booking.find({ userid: req.user.id }).sort({ createdAt: -1 }).lean();

    const bookings = rows.map(b => ({
      _id: b._id,
      room: b.room,
      date: b.date,
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
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ✅ ยกเลิกเฉพาะของตัวเอง (หาให้เจอก่อน + เช็คเจ้าของ)
router.patch('/:id/cancel', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const bk = await Booking.findById(id);
    if (!bk) return res.status(404).json({ message: 'ไม่พบรายการจองนี้' });

    if (!bk.userid || String(bk.userid) !== String(req.user.id)) {
      return res.status(403).json({ message: 'ไม่อนุญาตให้ยกเลิกรายการนี้' });
    }

    if (bk.status === 'done')  return res.status(400).json({ message: 'รายการที่เสร็จสิ้นแล้ว ยกเลิกไม่ได้' });
    if (bk.status === 'cancel') return res.status(400).json({ message: 'ยกเลิกไปแล้ว' });

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
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Edit เฉพาะ people & objective
router.patch('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { people, objective } = req.body;

    if (people !== undefined) {
      const n = Number(people);
      if (!Number.isFinite(n) || n < 1) {
        return res.status(400).json({ message: 'people ต้องเป็นตัวเลข >= 1' });
      }
    }
    if (objective !== undefined && String(objective).trim().length === 0) {
      return res.status(400).json({ message: 'objective ห้ามว่าง' });
    }

    const bk = await Booking.findById(id);
    if (!bk) return res.status(404).json({ message: 'ไม่พบรายการจองนี้' });
    if (!bk.userid || String(bk.userid) !== String(req.user.id)) {
      return res.status(403).json({ message: 'ไม่อนุญาตให้แก้ไขรายการนี้' });
    }
    if (bk.status === 'cancel' || bk.status === 'done') {
      return res.status(400).json({ message: 'สถานะนี้ไม่อนุญาตให้แก้ไข' });
    }

    if (people !== undefined)   bk.people = Number(people);
    if (objective !== undefined) bk.objective = String(objective).trim();
    await bk.save();

    return res.json({ message: 'อัปเดตสำเร็จ', booking: bk });
  } catch (err) {
    console.error('Update booking error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ✅ ดึงข้อมูล student_number + room ล่าสุด ด้วย userId จาก token
router.get("/latest", auth_feedback, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(400).json({ error: "Missing userId in token" });

    // 🔹 ดึง student_number จาก Users
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // 🔹 ดึง booking ล่าสุด โดยรองรับทั้ง userId และ userid
    const latestBooking = await Booking.findOne({
      $or: [{ userId: userId }, { userid: userId }],
    }).sort({ createdAt: -1 });

    console.log("✅ userId:", userId);
    console.log("🧾 latestBooking:", latestBooking);

    res.json({
      student_number: user.student_number || "N/A",
      room: latestBooking ? latestBooking.room : "N/A",
    });
  } catch (err) {
    console.error("❌ Error fetching latest booking:", err);
    res.status(500).json({ error: "Server error" });
  }
  });
  
module.exports = router;
