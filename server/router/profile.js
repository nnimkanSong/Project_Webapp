// server/router/profile.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const auth = require("../middleware/auth");
const User = require("../model/user");
const cloudinary = require("../utils/cloudinary");

const router = express.Router();

/* ---------- Multer: เก็บไฟล์ชั่วคราวก่อนอัป ---------- */
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) =>
    cb(null, `u_${Date.now()}${path.extname(file.originalname)}`),
});

const fileFilter = (_req, file, cb) => {
  if (/^image\/(png|jpe?g|gif|webp)$/.test(file.mimetype)) cb(null, true);
  else cb(new Error("Only image files are allowed"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

const VIEW_URL = (id) => `https://drive.google.com/uc?export=view&id=${id}`;

/* ================== ROUTES ================== */

/* ---------- POST /api/profile/photo (Cloudinary) ---------- */
router.post("/photo", auth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "profile",
      public_id: `u_${req.user.id}_${Date.now()}`,
      resource_type: "image",
    });

    // ลบไฟล์ชั่วคราว
    try {
      fs.unlinkSync(req.file.path);
    } catch {}

    // เก็บ URL ลง DB
    await User.findByIdAndUpdate(req.user.id, {
      $set: { photoUrl: result.secure_url },
    });

    return res.json({ url: result.secure_url });
  } catch (err) {
    console.error("Upload error:", err);
    try {
      if (req.file?.path) fs.unlinkSync(req.file.path);
    } catch {}
    return res.status(500).json({ error: "Upload failed" });
  }
});

/* ---------- GET /api/profile/me ---------- */
router.get("/me", auth, async (req, res) => {
  try {
    const u = await User.findById(req.user.id).select(
      "username email studentNumber userType photoUrl photoDriveFileId"
    ); // ✅ field ชื่อใหม่ตรงกับ model

    if (!u) return res.status(404).json({ error: "Not found" });

    const photoUrl = u.photoUrl
      ? u.photoUrl
      : u.photoDriveFileId
      ? VIEW_URL(u.photoDriveFileId)
      : "https://placehold.co/200x200?text=Profile";

    return res.json({
      username: u.username,
      email: u.email,
      studentNumber: u.studentNumber || "", // ✅ ใช้ studentNumber (camelCase)
      userType: u.userType || "user",
      photoUrl,
    });
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------- PUT /api/profile ---------- */
router.put("/", auth, async (req, res) => {
  const { username, studentNumber } = req.body;

  try {
    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { username, studentNumber } }, // ✅ ใช้ field เดียวกัน
      { new: true, runValidators: true }
    ).select("username email studentNumber userType photoUrl photoDriveFileId");

    if (!updated) return res.status(404).json({ error: "Not found" });

    const photoUrl = updated.photoUrl
      ? updated.photoUrl
      : updated.photoDriveFileId
      ? VIEW_URL(updated.photoDriveFileId)
      : "https://placehold.co/200x200?text=Profile";

    res.json({
      username: updated.username,
      email: updated.email,
      studentNumber: updated.studentNumber || "",
      userType: updated.userType || "user",
      photoUrl,
    });
  } catch (e) {
    if (e?.code === 11000 && e?.keyPattern?.studentNumber) {
      return res.status(409).json({ error: "Student number already in use" });
    }
    console.error("Profile update error:", e);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
