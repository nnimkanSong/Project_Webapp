const express = require("express");
const router = express.Router();
const Booking = require('../model/book');
const User = require('../model/user');
const auth = require('../middleware/auth');
const auth_feedback = require("../middleware/auth_feedback");

// ---------- helpers ----------
function shape(b) {
  return {
    _id: b._id,
    room: b.room,
    date: b.date,
    startTime: b.startTime ?? b.start_time,   // map -> camel
    endTime:   b.endTime   ?? b.end_time,     // map -> camel
    people: b.people,
    objective: b.objective,
    status: b.status || "pending",
    tracking: b.tracking || "กำลังดำเนินการ...",
    user: {
      id: b.userId || b.userid,               // รองรับทั้งสองชื่อ
      username: b.username ?? b.student_name,
      email: b.email ?? b.student_email,
      studentNumber: b.studentNumber,
    },
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

function parseDateOnly(input) {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function combineDateTime(dateOnly, timeHHmm) {
  const d = new Date(dateOnly);
  const [hh = "0", mm = "0"] = String(timeHHmm).split(":");
  d.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
  return d;
}

// ----------------- CREATE -----------------
router.post("/", auth, async (req, res) => {
  try {
    const { room, date, startTime, endTime, people, objective } = req.body;

    if (!room || !date || !startTime || !endTime || !people || !objective) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const dateOnly = parseDateOnly(date);
    if (!dateOnly) {
      return res.status(400).json({ message: "Invalid date" });
    }

    const startDT = combineDateTime(dateOnly, startTime);
    const endDT   = combineDateTime(dateOnly, endTime);
    if (!(startDT < endDT)) {
      return res.status(400).json({ message: "endTime must be after startTime" });
    }

    const user = await User.findById(req.user.id).select(
      "username email studentNumber"
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    // ✅ บันทึกลงฟิลด์ตามสคีมาปัจจุบัน (snake_case)
    const created = await Booking.create({
      userid: user._id,
      username: user.username || null,
      email: user.email || null,
      studentNumber: user.studentNumber || null,
      student_name: user.username || null,     // snapshot (ถ้าใช้อยู่)
      student_email: user.email || null,

      room,
      date: dateOnly,
      start_time: startTime,                   // snake_case
      end_time: endTime,                       // snake_case
      people: Number(people),
      objective: String(objective).trim(),
      status: "pending",
      tracking: "สร้างคำขอแล้ว",
    });

    return res.status(201).json({
      message: "Booked",
      booking: shape(created),                 // ส่งกลับ camelCase ให้ FE
    });
  } catch (err) {
    console.error("Create booking error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// ----------------- LIST (admin/all) -----------------
router.get("/", auth, async (_req, res) => {
  try {
    const list = await Booking.find().sort({ createdAt: -1 }).limit(50).lean();
    res.json({ rows: list.map(shape) });
  } catch (err) {
    console.error("Get booking error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ----------------- LIST MINE -----------------
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "username email studentNumber photoUrl"
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    // ✅ ค้นด้วย userid ให้ตรงกับสคีมา
    const rows = await Booking.find({ userid: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        studentNumber: user.studentNumber,
        photoUrl: user.photoUrl || "https://placehold.co/200x200?text=Profile",
      },
      bookings: rows.map(shape),
    });
  } catch (err) {
    console.error("Get my bookings error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// ----------------- CANCEL (mine only) -----------------
router.patch("/:id/cancel", auth, async (req, res) => {
  try {
    const { id } = req.params;

    const bk = await Booking.findById(id);
    if (!bk) return res.status(404).json({ message: "ไม่พบรายการจองนี้" });

    const ownerId = bk.userId || bk.userid;
    if (!ownerId || String(ownerId) !== String(req.user.id)) {
      return res.status(403).json({ message: "ไม่อนุญาตให้ยกเลิกรายการนี้" });
    }

    if (bk.status === "done")
      return res.status(400).json({ message: "รายการที่เสร็จสิ้นแล้ว ยกเลิกไม่ได้" });
    if (bk.status === "cancel")
      return res.status(400).json({ message: "ยกเลิกไปแล้ว" });

    bk.status = "cancel";
    bk.tracking = bk.tracking || "ยกเลิกโดยผู้ใช้";
    await bk.save();

    return res.json({ message: "ยกเลิกสำเร็จ", booking: shape(bk) });
  } catch (err) {
    console.error("Cancel booking error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// ----------------- EDIT people & objective (mine only) -----------------
router.patch("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { people, objective } = req.body;

    if (people !== undefined) {
      const n = Number(people);
      if (!Number.isFinite(n) || n < 1) {
        return res.status(400).json({ message: "people ต้องเป็นตัวเลข >= 1" });
      }
    }
    if (objective !== undefined && String(objective).trim().length === 0) {
      return res.status(400).json({ message: "objective ห้ามว่าง" });
    }

    const bk = await Booking.findById(id);
    if (!bk) return res.status(404).json({ message: "ไม่พบรายการจองนี้" });

    const ownerId = bk.userId || bk.userid;
    if (!ownerId || String(ownerId) !== String(req.user.id)) {
      return res.status(403).json({ message: "ไม่อนุญาตให้แก้ไขรายการนี้" });
    }
    if (bk.status === "cancel" || bk.status === "done") {
      return res.status(400).json({ message: "สถานะนี้ไม่อนุญาตให้แก้ไข" });
    }

    if (people !== undefined)   bk.people = Number(people);
    if (objective !== undefined) bk.objective = String(objective).trim();
    await bk.save();

    return res.json({ message: "อัปเดตสำเร็จ", booking: shape(bk) });
  } catch (err) {
    console.error("Update booking error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
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
      studentNumber: user.studentNumber || "N/A",
      room: latestBooking ? latestBooking.room : "N/A",
    });
  } catch (err) {
    console.error("❌ Error fetching latest booking:", err);
    res.status(500).json({ error: "Server error" });
  }
  });
  
module.exports = router;
