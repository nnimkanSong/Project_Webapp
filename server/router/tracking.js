// server/router/tracking.js
const express = require('express');
const router = express.Router();
const Booking = require('../model/book');
const Room = require('../model/Rooms'); // ✅ ใช้ชื่อไฟล์/โมเดลเดียวกับที่อื่น

// สร้าง Date ตอนนี้แบบโซนเวลาไทย (กัน timezone เพี้ยน)
function nowInBKK() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
}

// "YYYY-MM-DD (Date only)" + "HH:mm" -> Date
function composeDateTime(dateOnly, hhmm) {
  const [h, m] = String(hhmm || '00:00').split(':').map(v => parseInt(v, 10) || 0);
  const d = new Date(dateOnly);
  d.setHours(h, m, 0, 0);
  return d;
}

async function computeSnapshotNow() {
  const now = nowInBKK();

  const startOfDay = new Date(now); startOfDay.setHours(0,0,0,0);
  const endOfDay   = new Date(now); endOfDay.setHours(23,59,59,999);

  // ✅ ดึงรายชื่อห้องที่ใช้งานอยู่ในระบบ (ถ้าไม่มี field active ให้เอา {} แทน)
  const rooms = await Room.find({ /* active: true */ }).select('code').lean();
  const roomCodes = rooms.map(r => r.code);

  // ✅ ดึง booking ของ "วันนี้" และสถานะ active
  //    เลือกฟิลด์ที่ต้องใช้ให้ครบ: roomCode, roomId (เผื่อ populate ทีหลัง)
  const todaysActive = await Booking.find({
    status: 'active',
    date: { $gte: startOfDay, $lte: endOfDay },
  })
  .select('roomCode roomId date start_time end_time')
  .populate({ path: 'roomId', select: 'code', strictPopulate: false })
  .lean();

  const inUseSet = new Set();

  for (const bk of todaysActive) {
    const start = composeDateTime(bk.date, bk.start_time);
    let end = composeDateTime(bk.date, bk.end_time);
    if (end <= start) end = new Date(end.getTime() + 24*60*60*1000); // ข้ามเที่ยงคืน

    if (start <= now && now < end) {
      // ✅ หาชื่อห้อง (code) จาก booking: roomCode > roomId.code > (fallback เดิม)
      const code =
        bk.roomCode ||
        (bk.roomId && typeof bk.roomId === 'object' ? bk.roomId.code : undefined);

      if (code) inUseSet.add(code);
    }
  }

  const renoSet = new Set(); // เผื่อใช้ในอนาคต

  const breakdown = roomCodes.map(code => {
    if (renoSet.has(code)) return { room: code, status: 'renovation' };
    if (inUseSet.has(code)) return { room: code, status: 'in-use' };
    return { room: code, status: 'available' };
  });

  const totalRooms = roomCodes.length;
  const inUse = breakdown.filter(b => b.status === 'in-use').length;
  const renovation = breakdown.filter(b => b.status === 'renovation').length;
  const available = totalRooms - inUse - renovation;

  return { ts: now, totalRooms, available, inUse, renovation, breakdown };
}

router.get('/now', async (_req, res) => {
  try {
    const snap = await computeSnapshotNow();
    res.json(snap);
  } catch (err) {
    console.error('tracking /now error:', err);
    res.status(500).json({ error: 'Failed to compute tracking' });
  }
});

module.exports = router;
