// router/admin.stats.js
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Booking = require("../model/book");
const Room = require("../model/room");
const User = require("../model/user");
const auth = require("../middleware/auth");

// ===== Admin guard =====
function requireAdmin(req, res, next) {
  const role = String(
    req.user?.role ??
    req.user?.userType ??
    req.user?.user_type ??
    req.user?.type ??
    ""
  ).toLowerCase();
  const isAdmin = ["admin", "superadmin", "staff"].includes(role);
  if (isAdmin) return next();
  console.log("requireAdmin blocked. req.user =", req.user);
  return res.status(403).json({ error: "Admin only" });
}

// --- helpers ---
function startOfMonth(date = new Date()) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ========== KPI + Pies + Recent ==========
router.get("/metrics", auth, requireAdmin, async (_req, res) => {
  try {
    const todayStart = startOfToday();
    const todayEnd = endOfToday();
    const monthStart = startOfMonth();

    // ------------- main queries -------------
    const [
      totalRooms,
      totalBookingsMonth,
      activeUsersMonth,
      pendingToday,
      roomsAggThisMonth,
      recent10,
      totalUsers,
      activeNow,
    ] = await Promise.all([
      Room.countDocuments({}),
      Booking.countDocuments({ createdAt: { $gte: monthStart } }),
      Booking.distinct("userid", { createdAt: { $gte: monthStart } }).then((ids) => ids.length),
      Booking.countDocuments({
        status: { $regex: /^pending$/i },
        createdAt: { $gte: todayStart, $lte: todayEnd },
      }),
      // rooms pie (เฉพาะเดือนนี้ – จะมี fallback ด้านล่าง)
      Booking.aggregate([
        { $match: { createdAt: { $gte: monthStart } } },
        { $group: { _id: "$roomId", value: { $sum: 1 } } },
        {
          $lookup: {
            from: "rooms",
            localField: "_id",
            foreignField: "_id",
            as: "room",
          },
        },
        { $unwind: { path: "$room", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            id: { $ifNull: ["$room.code", { $toString: "$_id" }] },
            label: { $ifNull: ["$room.code", { $toString: "$_id" }] },
            value: 1,
          },
        },
        { $sort: { value: -1 } },
      ]),
      // recent 10
      Booking.find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .populate({ path: "roomId", select: "code" })
        .lean(),
      User.countDocuments({}),
      User.countDocuments({ isActive: true }),
    ]);

    // ---------- fallback: last 30 days ----------
    let roomsPie = roomsAggThisMonth;
    if (!roomsPie.length) {
      const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      roomsPie = await Booking.aggregate([
        { $match: { createdAt: { $gte: last30 } } },
        { $group: { _id: "$roomId", value: { $sum: 1 } } },
        {
          $lookup: {
            from: "rooms",
            localField: "_id",
            foreignField: "_id",
            as: "room",
          },
        },
        { $unwind: { path: "$room", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            id: { $ifNull: ["$room.code", { $toString: "$_id" }] },
            label: { $ifNull: ["$room.code", { $toString: "$_id" }] },
            value: 1,
          },
        },
        { $sort: { value: -1 } },
      ]);
    }

    const nonActiveNow = Math.max(totalUsers - activeNow, 0);

    const recent = recent10.map((b) => ({
      id: String(b._id || "").slice(-6).toUpperCase() || "—",
      room: b.roomId?.code || (typeof b.room === "string" ? b.room : "—"),
      user: b.username || b.user?.name || "—",
      date: new Date(b.date || b.createdAt || Date.now()).toISOString().slice(0, 10),
      time: `${b.start_time || b.startTime || "—"}–${b.end_time || b.endTime || "—"}`,
      status: String(b.status || "pending"),
    }));

    const notifications = [
      `รายการรออนุมัติวันนี้: ${pendingToday}`,
    ];

    return res.json({
      kpi: {
        totalRooms,
        totalBookingsMonth,
        activeUsersMonth,
        pendingToday,
        totalUsers,
        activeNow,
        nonActiveNow,
      },
      usersPie: [
        { id: "Active", label: "Active", value: activeNow },
        { id: "Non Active", label: "Non Active", value: nonActiveNow },
      ],
      roomsPie, // ✅ มีข้อมูลเสมอ (เดือนนี้ หรือย้อนหลัง 30 วัน)
      recent,
      notifications,
    });
  } catch (err) {
    console.error("admin/metrics error", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ========== Monthly Line Series (by room) ==========
router.get("/monthly-series", auth, requireAdmin, async (_req, res) => {
  try {
    const months = [
      { key: 1, label: "Jan" }, { key: 2, label: "Feb" }, { key: 3, label: "Mar" },
      { key: 4, label: "Apr" }, { key: 5, label: "May" }, { key: 6, label: "Jun" },
      { key: 7, label: "Jul" }, { key: 8, label: "Aug" }, { key: 9, label: "Sep" },
      { key: 10, label: "Oct" }, { key: 11, label: "Nov" }, { key: 12, label: "Dec" },
    ];

    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    const agg = await Booking.aggregate([
      { $match: { createdAt: { $gte: yearStart, $lte: yearEnd } } },
      {
        $group: {
          _id: {
            y: { $year: "$createdAt" },
            m: { $month: "$createdAt" },
            roomId: "$roomId",
          },
          value: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "rooms",
          localField: "_id.roomId",
          foreignField: "_id",
          as: "room",
        },
      },
      { $unwind: { path: "$room", preserveNullAndEmptyArrays: true } },
      { $project: { y: "$_id.y", m: "$_id.m", roomCode: "$room.code", value: 1, _id: 0 } },
    ]);

    const byRoom = new Map();
    for (const r of agg) {
      const room = r.roomCode || "Unknown";
      if (!byRoom.has(room)) byRoom.set(room, new Map());
      byRoom.get(room).set(r.m, r.value);
    }

    const series = [];
    for (const [room, map] of byRoom.entries()) {
      const data = months.map((m) => ({ x: m.label, y: map.get(m.key) || 0 }));
      series.push({ id: room, data });
    }

    res.json({ months: months.map((m) => m.label), series });
  } catch (err) {
    console.error("admin/monthly-series error", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Rooms list (optional)
router.get("/rooms", auth, requireAdmin, async (_req, res) => {
  const rooms = await Room.find({}).sort({ code: 1 }).lean();
  res.json({ rooms: rooms.map((r) => ({ _id: r._id, code: r.code, capacity: r.capacity })) });
});

module.exports = router;
