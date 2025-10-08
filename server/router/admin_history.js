// server/router/admin_history.js
const express = require("express");
const router = express.Router();
const Booking = require("../model/book");
const auth = require("../middleware/auth");

// ---- helpers ----
function shapeUser(bk) {
  // ถ้า populate แล้วจะเป็น object; ถ้ายังไม่ populate จะเป็น ObjectId
  const u = bk.userid && typeof bk.userid === "object" ? bk.userid : {};

  return {
    username:
      u.username ??
      bk.username ??              // เผื่อเคยฝังตอนสร้าง
      bk.student_name ??          // snapshot ชื่อใน Booking เก่า
      "",
    email:
      u.email ??
      bk.email ??
      bk.student_email ??         // snapshot อีเมล
      "",
    studentNumber:
      u.studentNumber ??
      bk.studentNumber ??         // snapshot หมายเลข นส.
      bk.student_number ??        // (เผื่อชื่อเก่า snake_case)
      "",
  };
}

function shapeBooking(bk) {
  return {
    id: bk._id.toString(),
    status: bk.status,
    room: bk.room,
    date: bk.date,                                  // Date only
    startTime: bk.startTime ?? bk.start_time,       // รองรับสองแบบ
    endTime:   bk.endTime   ?? bk.end_time,
    people: bk.people,
    objective: bk.objective,
    tracking: bk.tracking || "",
    createdAt: bk.createdAt,
    updatedAt: bk.updatedAt,
    user: shapeUser(bk),
  };
}

/* ======================= GET: รายการทั้งหมด ======================= */
router.get("/", auth, async (_req, res) => {
  try {
    const list = await Booking.find({})
      .sort({ createdAt: -1 })
      .populate({
        path: "userid", // <- ตรงกับ schema จริง
        select: "username email studentNumber",
        strictPopulate: false, // กันกรณีเอกสารเก่าไม่ตรง schema
      })
      .lean();

    res.json({ rows: list.map(shapeBooking) });
  } catch (err) {
    console.error("Admin list bookings error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

/* ======================= PATCH: อนุมัติ ======================= */
router.patch("/:id/approve", auth, async (req, res) => {
  try {
    const bk = await Booking.findById(req.params.id).populate({
      path: "userid",
      select: "username email studentNumber",
      strictPopulate: false,
    });
    if (!bk) return res.status(404).json({ message: "ไม่พบรายการ" });

    if (bk.status === "cancel" || bk.status === "done") {
      return res.status(400).json({ message: "สถานะนี้แก้ไขไม่ได้" });
    }

    bk.status = "active";
    bk.tracking = bk.tracking || "อนุมัติแล้ว";
    await bk.save();

    const fresh = await Booking.findById(bk._id)
      .populate({
        path: "userid",
        select: "username email studentNumber",
        strictPopulate: false,
      })
      .lean();

    res.json({ message: "อนุมัติสำเร็จ", booking: shapeBooking(fresh) });
  } catch (err) {
    console.error("approve error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

/* ======================= PATCH: ยกเลิก ======================= */
router.patch("/:id/cancel", auth, async (req, res) => {
  try {
    const bk = await Booking.findById(req.params.id).populate({
      path: "userid",
      select: "username email studentNumber",
      strictPopulate: false,
    });
    if (!bk) return res.status(404).json({ message: "ไม่พบรายการ" });

    if (bk.status === "done") {
      return res.status(400).json({ message: "เสร็จสิ้นแล้ว ยกเลิกไม่ได้" });
    }

    bk.status = "cancel";
    bk.tracking = bk.tracking || "ถูกยกเลิกโดยผู้ดูแล";
    await bk.save();

    const fresh = await Booking.findById(bk._id)
      .populate({
        path: "userid",
        select: "username email studentNumber",
        strictPopulate: false,
      })
      .lean();

    res.json({ message: "ยกเลิกสำเร็จ", booking: shapeBooking(fresh) });
  } catch (err) {
    console.error("cancel error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
