// server/router/admin_users.js
const express = require("express");
const router = express.Router();
const User = require("../model/user"); // แก้ path ตามโปรเจกต์ของคุณ

// GET /api/admin/users
router.get("/", async (req, res) => {
  try {
    const users = await User.find().select("-password"); // ไม่ส่ง password กลับ
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Error fetching users" });
  }
});

// DELETE /api/admin/users/:id
router.delete("/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting user" });
  }
});

module.exports = router;
