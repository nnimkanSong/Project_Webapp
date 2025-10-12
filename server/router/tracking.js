// server/routes/tracking.js
const express = require('express');
const router = express.Router();
const Booking = require('../model/book');
const Room = require('../model/Rooms'); // ✅ import model ห้อง

// ฟังก์ชันแปลง Date + Time (เช่น "2025-10-11" + "14:30") → Date object
function composeDateTime(dateOnly, hhmm) {
  const [h, m] = (hhmm || '00:00').split(':').map(n => parseInt(n, 10) || 0);
  const d = new Date(dateOnly);
  d.setHours(h, m, 0, 0);
  return d;
}

// ฟังก์ชันคำนวณ snapshot ปัจจุบัน
async function computeSnapshotNow() {
  const now = new Date();

  // วันนี้
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay   = new Date(now); endOfDay.setHours(23, 59, 59, 999);

  // ✅ ดึงห้องที่ active ทั้งหมด
  const rooms = await Room.find({ active: true }).select("code");
  const roomCodes = rooms.map(r => r.code);

  // ✅ ดึง booking ที่ active ของวันนี้
  const todaysActive = await Booking.find({
    status: 'active',
    date: { $gte: startOfDay, $lte: endOfDay }
  }).select('room date start_time end_time');

  // เช็กว่าห้องไหน "ใช้งานอยู่"
  const inUseSet = new Set();
  for (const bk of todaysActive) {
    const start = composeDateTime(bk.date, bk.start_time);
    let end = composeDateTime(bk.date, bk.end_time);
    if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000); // ข้ามเที่ยงคืน

    if (start <= now && now < end) {
      inUseSet.add(bk.room);
    }
  }

  // (ถ้ามีระบบ renovation ในอนาคต ค่อยเติม)
  const renoSet = new Set();

  // ✅ สร้าง breakdown สำหรับทุกห้อง
  const breakdown = roomCodes.map(room => {
    if (renoSet.has(room)) return { room, status: 'renovation' };
    if (inUseSet.has(room)) return { room, status: 'in-use' };
    return { room, status: 'available' };
  });

  const totalRooms = roomCodes.length;
  const inUse = breakdown.filter(b => b.status === 'in-use').length;
  const renovation = breakdown.filter(b => b.status === 'renovation').length;
  const available = totalRooms - inUse - renovation;

  return { ts: now, totalRooms, available, inUse, renovation, breakdown };
}

// ✅ Route หลักให้ frontend เรียก
router.get('/now', async (req, res) => {
  try {
    const snap = await computeSnapshotNow();
    res.json(snap);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute tracking' });
  }
});

module.exports = router;
