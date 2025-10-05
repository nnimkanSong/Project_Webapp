
const express = require('express');
const router = express.Router();
const Booking = require('../model/book');
const auth = require('../middleware/auth');

// ✅ ถ้ายังไม่ใช้ role ตรวจ admin ตอนนี้
//    ก็ถือว่าแค่ login แล้วถึงจะเข้ามาได้

// GET: แสดงการจองทั้งหมด
router.get('/', auth, async (_req, res) => {
  try {
    const list = await Booking.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    console.error('Admin list bookings error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// PATCH: อนุมัติ
router.patch('/:id/approve', auth, async (req, res) => {
  try {
    const bk = await Booking.findById(req.params.id);
    if (!bk) return res.status(404).json({ message: 'ไม่พบรายการ' });
    if (bk.status === 'cancel' || bk.status === 'done') {
      return res.status(400).json({ message: 'สถานะนี้แก้ไขไม่ได้' });
    }
    bk.status = 'active';
    bk.tracking = bk.tracking || 'อนุมัติแล้ว';
    await bk.save();
    res.json({ message: 'อนุมัติสำเร็จ', booking: bk });
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// PATCH: ยกเลิก
router.patch('/:id/cancel', auth, async (req, res) => {
  try {
    const bk = await Booking.findById(req.params.id);
    if (!bk) return res.status(404).json({ message: 'ไม่พบรายการ' });
    if (bk.status === 'done') {
      return res.status(400).json({ message: 'เสร็จสิ้นแล้ว ยกเลิกไม่ได้' });
    }
    bk.status = 'cancel';
    bk.tracking = bk.tracking || 'ถูกยกเลิกโดยผู้ดูแล';
    await bk.save();
    res.json({ message: 'ยกเลิกสำเร็จ', booking: bk });
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;
