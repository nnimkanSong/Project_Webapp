const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const User = require("../model/user");
const auth = require("../middleware/auth");

function requireAdmin(req, res, next) {
  const role = String(
    req.user?.role ?? req.user?.userType ?? req.user?.user_type ?? req.user?.type ?? ""
  ).toLowerCase();
  const isAdmin = ["admin", "superadmin", "staff"].includes(role);
  if (isAdmin) return next();
  return res.status(403).json({ error: "Admin only" });
}

const asRole = (u) =>
  String(u.role ?? u.userRole ?? u.userType ?? u.user_type ?? u.type ?? "").toLowerCase();

const isAdminRole = (u) => ["admin", "superadmin", "staff"].includes(asRole(u));

/* ====================== GET: ผู้ใช้ทั้งหมด (รองรับ ?role=) ====================== */
router.get("/", auth, requireAdmin, async (req, res) => {
  try {
    const roleFilter = String(req.query.role || "").toLowerCase(); // '', 'user', 'admin'

    const users = await User.find({})
      .select(
        "username email studentNumber role userRole userType user_type type photoUrl isActive createdAt lastLoginAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    const filtered =
      roleFilter === "admin"
        ? users.filter(isAdminRole)
        : roleFilter === "user"
        ? users.filter((u) => !isAdminRole(u))
        : users;

    res.json({ total: filtered.length, users: filtered });
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
    if (!deleted) return res.status(404).json({ message: "User not found" });

    res.json({ message: "User deleted successfully", userId: id });
  } catch (err) {
    console.error("admin/users DELETE error:", err);
    res.status(500).json({ message: "Error deleting user" });
  }
});

module.exports = router;
