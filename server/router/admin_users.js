// server/router/admin_users.js
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const User = require("../model/user");
const auth = require("../middleware/auth");

// --- ตรวจ role ---
function requireAdmin(req, res, next) {
  const role = String(
    req.user?.role ?? req.user?.userType ?? req.user?.user_type ?? req.user?.type ?? ""
  ).toLowerCase();

  const isAdmin = ["admin", "superadmin", "staff"].includes(role);
  if (isAdmin) return next();

  console.log("requireAdmin blocked. req.user =", req.user);
  return res.status(403).json({ error: "Admin only" });
}

/* ====================== GET: ผู้ใช้ทั้งหมด ====================== */
router.get("/", auth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({})
      .select("username email studentNumber userType isActive createdAt lastLoginAt") // เลือกเฉพาะฟิลด์ที่จำเป็น
      .sort({ createdAt: -1 })
      .lean();

    res.json({ total: users.length, users });
  } catch (err) {
    console.error("admin/users GET error:", err);
    res.status(500).json({ message: "Error fetching users" });
  }
});

/* ====================== DELETE: ลบผู้ใช้ ====================== */
router.delete("/:id", auth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid user ID" });

    const deleted = await User.findByIdAndDelete(id);
    if (!deleted)
      return res.status(404).json({ message: "User not found" });

    res.json({ message: "User deleted successfully", userId: id });
  } catch (err) {
    console.error("admin/users DELETE error:", err);
    res.status(500).json({ message: "Error deleting user" });
  }
});

module.exports = router;
