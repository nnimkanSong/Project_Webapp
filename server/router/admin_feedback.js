const express = require("express");
const router = express.Router();
const Admin_feedback = require("../model/feedback"); // import model

// GET: ดึง feedback ทั้งหมด
router.get("/", async (req, res) => {
  try {
    const Adminfeedbacks = await Admin_feedback.find().sort({ createdAt: -1 }); // เรียงจากใหม่สุด
    res.json(Adminfeedbacks);
  } catch (error) {
    console.error("Error fetching feedbacks:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
