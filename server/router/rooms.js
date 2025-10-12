// router/rooms.js
const express = require("express");
const router = express.Router();
const Room = require("../model/room");
const auth = require("../middleware/auth");

router.get("/", auth, async (_req, res) => {
  const rooms = await Room.find({ active: true }).sort({ code: 1 }).lean();
  res.json({
    rooms: rooms.map(r => ({
      _id: r._id,
      code: r.code,
      building: r.building,
      floor: r.floor,
      capacity: r.capacity,
      equipment: r.equipment,
      openAt: r.openAt,
      closeAt: r.closeAt,
    }))
  });
});

module.exports = router;
