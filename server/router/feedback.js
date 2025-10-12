const express = require("express");
const router = express.Router();
const Feedback = require("../model/feedback");
const User = require("../model/user");
const auth = require("../middleware/auth_feedback");

// ✅ บันทึก feedback พร้อม student_number และ userId
router.post("/", auth, async (req, res) => {
  try {
    const { room, rating, comment, equipment } = req.body;

    if (!room || !rating || !comment || !equipment) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const feedback = new Feedback({
      userId: user._id,
      studentNumber: user.studentNumber || "N/A",
      room,
      rating,
      comment,
      equipment,
    });

    await feedback.save();
    res.json({ message: "Feedback submitted successfully", feedback });
  } catch (err) {
    console.error("Error saving feedback:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
