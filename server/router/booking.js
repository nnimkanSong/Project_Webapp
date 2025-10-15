// router/bookings.js
const express = require("express");
const router = express.Router();
const Booking = require('../model/book');
const mongoose = require("mongoose");
const User = require('../model/user');
const auth = require('../middleware/auth');
const auth_feedback = require("../middleware/auth_feedback");
const Room = require("../model/room");


// ---------- helpers ----------
function shape(b, roomDoc) {
  const room = roomDoc || (b.room || null);
  return {
    _id: b._id,
    room: {
      id: b.roomId,
      code: b.roomCode,
      building: room?.building ?? undefined,
      floor: room?.floor ?? undefined,
      capacity: room?.capacity ?? undefined,
      equipment: room?.equipment ?? undefined,
      openAt: room?.openAt ?? undefined,
      closeAt: room?.closeAt ?? undefined,
    },
    date: b.date,
    startTime: b.start_time,
    endTime: b.end_time,
    people: b.people,
    objective: b.objective,
    status: b.status || "pending",
    tracking: b.tracking || "กำลังดำเนินการ...",
    user: {
      id: b.userid,
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

function hhmmLt(a, b) {
  // '09:30' < '10:00' ใช้ string เปรียบเทียบได้ แต่ทำให้ชัดเจนไว้
  return a.localeCompare(b) < 0;
}

function hhmmLe(a, b) {
  return a.localeCompare(b) <= 0;
}

// ----------------- CREATE -----------------
router.post("/", auth, async (req, res) => {
  try {
    const { roomId, date, startTime, endTime, people, objective } = req.body;

    if (!roomId || !date || !startTime || !endTime || !people || !objective) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!mongoose.isValidObjectId(roomId)) {
      return res.status(400).json({ error: "Invalid roomId" });
    }

    const room = await Room.findById(roomId).lean();
    if (!room) return res.status(404).json({ error: "Room not found" });

    // ตรวจเวลาเปิด/ปิดห้อง (ถ้ากำหนดไว้)
    if (room.openAt && room.closeAt) {
      if (!hhmmLe(room.openAt, startTime) || !hhmmLe(endTime, room.closeAt)) {
        return res.status(400).json({
          error: `เวลาจองต้องอยู่ระหว่าง ${room.openAt} - ${room.closeAt}`,
        });
      }
    }

    const dateOnly = parseDateOnly(date);
    if (!dateOnly) return res.status(400).json({ error: "Invalid date" });

    // start < end
    const startDT = combineDateTime(dateOnly, startTime);
    const endDT = combineDateTime(dateOnly, endTime);
    if (!(startDT < endDT)) {
      return res.status(400).json({ error: "endTime must be after startTime" });
    }

    // กันเวลาซ้อน (overlap) ในห้องเดียวกัน วันที่เดียวกัน
    // overlap ถ้า: existing.start < newEnd && existing.end > newStart
    const overlap = await Booking.findOne({
      roomId,
      date: dateOnly,
      start_time: { $lt: endTime },
      end_time: { $gt: startTime },
      status: { $in: ["pending", "active"] },
    }).lean();

    if (overlap) {
      return res.status(409).json({
        error: "ช่วงเวลาดังกล่าวมีการจองแล้ว กรุณาเลือกช่วงเวลาอื่น",
      });
    }

    const user = await User.findById(req.user.id).select(
      "username email studentNumber"
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    const created = await Booking.create({
      userid: user._id,
      username: user.username || null,
      email: user.email || null,
      studentNumber: user.studentNumber || null,
      student_name: user.username || null,
      student_email: user.email || null,

      roomId,
      roomCode: room.code,    // ✅ snapshot
      date: dateOnly,
      start_time: startTime,
      end_time: endTime,
      people: Number(people),
      objective: String(objective).trim(),
      status: "pending",
      tracking: "สร้างคำขอแล้ว",
    });

    return res.status(201).json({
      message: "Booked",
      booking: shape(created, room),
    });
  } catch (err) {
    console.error("Create booking error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// ----------------- LIST (admin/all) -----------------
router.get("/", auth, async (_req, res) => {
  try {
    const list = await Booking.find().sort({ createdAt: -1 }).limit(50).lean();
    // เติมข้อมูลห้องแบบรวดเร็วด้วย map<roomId, room>
    const roomIds = [...new Set(list.map(b => String(b.roomId)))];
    const rooms = await Room.find({ _id: { $in: roomIds } }).lean();
    const roomMap = new Map(rooms.map(r => [String(r._id), r]));
    res.json({
      rows: list.map(b => shape(b, roomMap.get(String(b.roomId)))),
    });
  } catch (err) {
    console.error("Get booking error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ----------------- LIST MINE -----------------
// router/bookings.js  (เฉพาะ /me)
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "username email studentNumber photoUrl"
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    // ✅ ดึงได้ทั้งสองฟิลด์
    const rows = await Booking.find({
      $or: [{ userid: req.user.id }, { userId: req.user.id }],
    })
      .sort({ createdAt: -1 })
      .lean();

    // (ถ้าฝั่งคุณยังไม่ได้ใส่ room เป็นออบเจ็กต์)
    // ให้เติม mapping/shape เหมือนในคำตอบก่อนหน้า หรืออย่างน้อยคืน roomCode มาด้วย

    return res.json({
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        studentNumber: user.studentNumber,
        photoUrl: user.photoUrl || "https://placehold.co/200x200?text=Profile",
      },
      bookings: rows.map((b) => ({
        _id: b._id,
        room: b.room || { code: b.roomCode }, // เผื่อสองรูปแบบ
        roomCode: b.roomCode,                  // เผื่อ FE เรียกใช้ตรง ๆ
        date: b.date,
        startTime: b.start_time || b.startTime,
        endTime: b.end_time || b.endTime,
        people: b.people,
        objective: b.objective,
        status: b.status,
        tracking: b.tracking,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      })),
    });
  } catch (err) {
    console.error("Get my bookings error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});


// ----------------- CANCEL (mine only) -----------------
router.patch("/:id/cancel", auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid booking id" });
    }

    // 1) อ่านแบบ lean() เพื่อไม่ไปชน validator ของเอกสารเก่า
    const bk = await Booking.findById(id).lean();
    if (!bk) return res.status(404).json({ error: "ไม่พบรายการจองนี้" });

    const ownerId = bk.userid || bk.userId; // รองรับทั้งสองยุค
    if (!ownerId || String(ownerId) !== String(req.user.id)) {
      return res.status(403).json({ error: "ไม่อนุญาตให้ยกเลิกรายการนี้" });
    }

    if (bk.status === "done")
      return res.status(400).json({ error: "รายการที่เสร็จสิ้นแล้ว ยกเลิกไม่ได้" });
    if (bk.status === "cancel")
      return res.status(400).json({ error: "ยกเลิกไปแล้ว" });

    // 2) อัปเดตแบบไม่รัน validator (กันกรณีไม่มี roomId ในเอกสารเก่า)
    await Booking.updateOne(
      { _id: id },
      { $set: { status: "cancel", tracking: "ยกเลิกโดยผู้ใช้" } },
      { runValidators: false }
    );

    // 3) สร้าง payload ตอบกลับจาก bk เดิม + ฟิลด์ที่แก้
    const patched = { ...bk, status: "cancel", tracking: "ยกเลิกโดยผู้ใช้" };

    // ถ้าใช้ shape(room) อยู่:
    let roomDoc = null;
    if (patched.roomId) {
      roomDoc = await Room.findById(patched.roomId).lean().catch(() => null);
    }
    return res.json({
      message: "ยกเลิกสำเร็จ",
      booking: shape(patched, roomDoc), // ฟังก์ชัน shape เดิมของคุณ
    });
  } catch (err) {
    console.error("Cancel booking error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});


// ----------------- EDIT people & objective (mine only) -----------------
router.patch("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { people, objective } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid booking id" });
    }

    if (people !== undefined) {
      const n = Number(people);
      if (!Number.isFinite(n) || n < 1) {
        return res.status(400).json({ error: "people ต้องเป็นตัวเลข >= 1" });
      }
    }
    if (objective !== undefined && String(objective).trim().length === 0) {
      return res.status(400).json({ error: "objective ห้ามว่าง" });
    }

    const bk = await Booking.findById(id);
    if (!bk) return res.status(404).json({ error: "ไม่พบรายการจองนี้" });

    const ownerId = bk.userid;
    if (!ownerId || String(ownerId) !== String(req.user.id)) {
      return res.status(403).json({ error: "ไม่อนุญาตให้แก้ไขรายการนี้" });
    }
    if (bk.status === "cancel" || bk.status === "done") {
      return res.status(400).json({ error: "สถานะนี้ไม่อนุญาตให้แก้ไข" });
    }

    if (people !== undefined) bk.people = Number(people);
    if (objective !== undefined) bk.objective = String(objective).trim();
    await bk.save();

    const room = await Room.findById(bk.roomId).lean();
    return res.json({ message: "อัปเดตสำเร็จ", booking: shape(bk.toObject(), room) });
  } catch (err) {
    console.error("Update booking error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
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


    res.json({
      studentNumber: user.studentNumber || "N/A",
      room: latestBooking ? latestBooking.roomCode : "N/A",
    });
  } catch (err) {
    console.error("❌ Error fetching latest booking:", err);
    res.status(500).json({ error: "Server error" });
  }
  });
  
module.exports = router;
