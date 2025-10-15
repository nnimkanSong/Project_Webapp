// server/routes/allImages.js
const express = require("express");
const router = express.Router();
require("../model/Picture");                 // ให้ populate รู้จักโมเดล
const Room = require("../model/room");

// GET /api/images?grouped=1&limit=100
router.get("/images", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 0, 1000); // กันยิงหนัก
    const grouped = String(req.query.grouped || "0") === "1";

    const rooms = await Room.find({ active: true })
      .select("code pictures")
      .populate("pictures.picture", "url caption")
      .lean();

    // แปลงเป็น flat list: [{ url, alt, roomCode, isPrimary, sortOrder }, ...]
    let items = [];
    for (const r of rooms) {
      const pics = (r.pictures || [])
        .filter(p => p.picture?.url)
        .sort((a,b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder)
        .map(p => ({
          url: p.picture.url,
          alt: p.picture.caption || r.code,
          roomCode: r.code,
          isPrimary: !!p.isPrimary,
          sortOrder: p.sortOrder ?? 0,
        }));
      items.push(...pics);
    }

    // ถ้าอยากสลับคละห้อง ให้ sort ตามเวลา/หรือสุ่ม:
    // items.sort(() => Math.random() - 0.5);

    if (limit) items = items.slice(0, limit);

    if (grouped) {
      // กลับแบบแบ่งตามห้อง: { E107: [...], E111: [...], ... }
      const groups = items.reduce((acc, it) => {
        (acc[it.roomCode] ||= []).push(it);
        return acc;
      }, {});
      return res.json({ groups });
    }

    res.json({ items });
  } catch (e) {
    console.error("GET /api/images error:", e);
    res.status(500).json({ message: "Failed to load images" });
  }
});

module.exports = router;
