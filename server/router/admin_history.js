// server/router/admin_history.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Booking = require("../model/book");
const auth = require("../middleware/auth");

// ---- simple admin guard (ปรับให้ตรงระบบของคุณได้) ----
function requireAdmin(req, res, next) {
  const role = String(
    req.user?.role ?? req.user?.userType ?? req.user?.user_type ?? req.user?.type ?? ""
  ).toLowerCase();
  const isAdmin = ["admin", "superadmin", "staff"].includes(role);
  if (isAdmin) return next();

  console.log("requireAdmin blocked. req.user =", req.user);
  return res.status(403).json({ error: "Admin only" });
}

// ---- helpers ----
function shapeUser(bk) {
  // ถ้า populate แล้วจะเป็น object; ถ้ายังไม่ populate จะเป็น ObjectId
  const u = bk.userid && typeof bk.userid === "object" ? bk.userid : {};

  return {
    username:
      u.username ??
      bk.username ??              // snapshot ชื่อใน Booking เก่า
      bk.student_name ??
      "",
    email:
      u.email ??
      bk.email ??
      bk.student_email ??
      "",
    studentNumber:
      u.studentNumber ??
      bk.studentNumber ??
      bk.student_number ??
      "",
  };
}

function shapeBooking(bk) {
  // ดึง label ห้อง: ถ้า populate แล้วใช้ code, ถ้าไม่มีก็ fallback เป็น string เดิม
  const roomLabel =
    (bk.roomId && typeof bk.roomId === "object" && bk.roomId?.code) ||
    (typeof bk.room === "string" ? bk.room : "—");

  return {
    id: bk._id.toString(),
    status: bk.status,
    room: roomLabel,
    date: bk.date || null,                             // Date only
    startTime: bk.startTime ?? bk.start_time ?? "",    // รองรับสองแบบ
    endTime:   bk.endTime   ?? bk.end_time   ?? "",
    people: bk.people ?? null,
    objective: bk.objective ?? "",
    tracking: bk.tracking || "",
    createdAt: bk.createdAt,
    updatedAt: bk.updatedAt,
    user: shapeUser(bk),
  };
}

router.get("/bookings/count", auth, requireAdmin, async (req, res) => {
  try {
    const status = String(req.query.status || "pending").toLowerCase();
    const count = await Booking.countDocuments({ status });
    res.json({ count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "count_failed" });
  }
});

/* ======================= GET: รายการทั้งหมด ======================= */
// แนะนำให้ทำ pagination ในโลกจริง: ?page=&limit=
router.get("/", auth, requireAdmin, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip  = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      Booking.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: "userid",
          select: "username email studentNumber",
          strictPopulate: false,
        })
        .populate({
          path: "roomId",
          select: "code building floor",
          strictPopulate: false,
        })
        .lean(),
      Booking.countDocuments({}),
    ]);

    res.json({
      page, limit, total,
      rows: rows.map(shapeBooking),
    });
  } catch (err) {
    console.error("Admin list bookings error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

/* ======================= PATCH: อนุมัติ ======================= */

// … keep other code …

router.patch("/:id/approve", auth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid booking id" });
    }

    const bk = await Booking.findById(id)
      .populate({ path: "userid", select: "username email studentNumber", strictPopulate: false })
      .populate({ path: "roomId", select: "code", strictPopulate: false });

    if (!bk) {
      console.warn("[approve] not found id:", id);
      return res.status(404).json({ message: "ไม่พบรายการ" });
    }

    if (bk.status === "cancel" || bk.status === "done") {
      console.warn("[approve] blocked by status:", bk.status, "id:", id);
      return res.status(400).json({ message: `สถานะ '${bk.status}' ไม่อนุญาตให้อนุมัติ` });
    }

    // เปลี่ยนสถานะ → active
    bk.status = "active";
    bk.tracking = `อนุมัติแล้ว (${new Date().toISOString()})`;

    await bk.save(); // ถ้าพังจะตกมา catch

    const fresh = await Booking.findById(id)
      .populate({ path: "userid", select: "username email studentNumber", strictPopulate: false })
      .populate({ path: "roomId", select: "code", strictPopulate: false })
      .lean();

    return res.json({ message: "อนุมัติสำเร็จ", booking: shapeBooking(fresh) });
  } catch (err) {
    console.error("approve error (id=", req.params?.id, "):", err);
    // ส่งรายละเอียดบางส่วนให้ FE เห็น (dev time)
    return res.status(500).json({ message: "Internal Server Error", detail: err?.message });
  }
});

router.patch("/:id/cancel", auth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid booking id" });
    }

    const bk = await Booking.findById(id)
      .populate({ path: "userid", select: "username email studentNumber", strictPopulate: false })
      .populate({ path: "roomId", select: "code", strictPopulate: false });

    if (!bk) {
      console.warn("[cancel] not found id:", id);
      return res.status(404).json({ message: "ไม่พบรายการ" });
    }

    if (bk.status === "done") {
      console.warn("[cancel] blocked by status: done", "id:", id);
      return res.status(400).json({ message: "เสร็จสิ้นแล้ว ยกเลิกไม่ได้" });
    }

    bk.status = "cancel";
    bk.tracking = `ถูกยกเลิกโดยผู้ดูแล (${new Date().toISOString()})`;

    await bk.save();

    const fresh = await Booking.findById(id)
      .populate({ path: "userid", select: "username email studentNumber", strictPopulate: false })
      .populate({ path: "roomId", select: "code", strictPopulate: false })
      .lean();

    return res.json({ message: "ยกเลิกสำเร็จ", booking: shapeBooking(fresh) });
  } catch (err) {
    console.error("cancel error (id=", req.params?.id, "):", err);
    return res.status(500).json({ message: "Internal Server Error", detail: err?.message });
  }
});


module.exports = router;
