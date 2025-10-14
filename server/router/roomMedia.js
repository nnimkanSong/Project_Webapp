const express = require("express");
const router = express.Router();
const Room = require("../model/room");

router.get("/rooms/:code/images", async (req, res) => {
  try {
    const room = await Room.findOne({ code: req.params.code })
      .populate("pictures.picture", "url caption")
      .lean();
    if (!room) return res.status(404).json({ message: "Room not found" });

    const items = (room.pictures || [])
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder)
      .map(rp => ({
        url: rp.picture?.url,
        alt: rp.picture?.caption || room.code,
        isPrimary: !!rp.isPrimary,
        sortOrder: rp.sortOrder ?? 0,
      }))
      .filter(x => !!x.url);

    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to load images" });
  }
});

module.exports = router;
