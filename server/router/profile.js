// server/router/profile.js
const express = require('express');
// const bcrypt = require('bcrypt'); // ❌ ไม่ได้ใช้ ลบทิ้ง
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const auth = require('../middleware/auth');
const User = require('../model/user');
const cloudinary = require('../utils/cloudinary'); // ✅ ใช้ Cloudinary

const router = express.Router();

/* ---------- Multer: เก็บไฟล์ชั่วคราวก่อนอัป ---------- */
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) =>
    cb(null, `u_${Date.now()}${path.extname(file.originalname)}`),
});
const fileFilter = (_req, file, cb) => {
  if (/^image\/(png|jpe?g|gif|webp)$/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Only image files are allowed'));
};
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

// helper: สร้าง URL สำหรับไฟล์เก่า (ถ้าเคยใช้ Google Drive)
const VIEW_URL = (id) => `https://drive.google.com/uc?export=view&id=${id}`;

/* ================== ROUTES ================== */

/* ---------- POST /api/profile/photo (Cloudinary) ---------- */
router.post('/photo', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });

    // อัปขึ้น Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'profile',
      public_id: `u_${req.user.id}_${Date.now()}`,
      resource_type: 'image',
    });

    // ลบไฟล์ชั่วคราว
    try { fs.unlinkSync(req.file.path); } catch {}

    // เก็บ URL ลง DB
    await User.findByIdAndUpdate(req.user.id, {
      $set: { photoUrl: result.secure_url },
    });

    return res.json({ url: result.secure_url });
  } catch (err) {
    console.error('Upload error:', err);
    // ลบไฟล์ชั่วคราวหากยังอยู่
    try { if (req.file?.path) fs.unlinkSync(req.file.path); } catch {}
    return res.status(500).json({ error: 'Upload failed' });
  }
});

/* ---------- GET /api/profile/me ---------- */
router.get('/me', auth, async (req, res) => {
  const u = await User.findById(req.user.id)
    .select('username email student_number user_type photoUrl photoDriveFileId'); // ✅ เพิ่ม user_type

  if (!u) return res.status(404).json({ error: 'Not found' });

  // ถ้ามี photoUrl (ใหม่) ใช้เลย, ถ้าไม่มีแต่มี fileId (เก่า) ก็ render url ดูได้
  const photoUrl = u.photoUrl
    ? u.photoUrl
    : (u.photoDriveFileId ? VIEW_URL(u.photoDriveFileId) : 'https://placehold.co/200x200?text=Profile');

  res.json({
    username: u.username,
    email: u.email,
    student_number: u.student_number || '',
    user_type: u.user_type || 'user', // ✅ ส่ง user_type ให้หน้า Profile ใช้แสดงแทน password
    photoUrl,
  });
});

/* ---------- PUT /api/profile ---------- */
router.put('/', auth, async (req, res) => {
  const { username, student_number } = req.body;

  try {
    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { username, student_number } }, // ❗️ไม่อนุญาตแก้ user_type ที่นี่
      { new: true, runValidators: true }
    ).select('username email student_number user_type photoUrl photoDriveFileId'); // ✅ เพิ่ม user_type

    if (!updated) return res.status(404).json({ error: 'Not found' });

    const photoUrl = updated.photoUrl
      ? updated.photoUrl
      : (updated.photoDriveFileId ? VIEW_URL(updated.photoDriveFileId) : 'https://placehold.co/200x200?text=Profile');

    res.json({
      username: updated.username,
      email: updated.email,
      student_number: updated.student_number || '',
      user_type: updated.user_type || 'user', // ✅ ส่งกลับด้วยให้ front-end อัปเดต state
      photoUrl,
    });
  } catch (e) {
    if (e?.code === 11000 && e?.keyPattern?.student_number) {
      return res.status(409).json({ error: 'student_number already in use' });
    }
    console.error('Profile update error:', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
