const express = require('express');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');

const auth = require('../middleware/auth');
const User = require('../model/user');
const router = express.Router();

// จัดเก็บไฟล์ + ตรวจ mimetype + จำกัดขนาด
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `u_${Date.now()}${ext}`);
  }
});
const fileFilter = (_req, file, cb) => {
  if (/^image\/(png|jpe?g|gif|webp)$/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Only image files are allowed'));
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024 } });

// GET /api/profile/me
router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id).select('username email student_number photoUrl user_type');
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

// PUT /api/profile (แก้ได้เฉพาะ username, student_number, photoUrl)
router.put('/', auth, async (req, res) => {
  const { username, student_number, photoUrl } = req.body;

  try {
    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { username, student_number, photoUrl } },
      { new: true, runValidators: true }
    ).select('username email student_number photoUrl user_type');

    res.json(updated);
  } catch (e) {
    if (e?.code === 11000 && e?.keyPattern?.student_number) {
      return res.status(409).json({ error: 'student_number already in use' });
    }
    console.error('Profile update error:', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/profile/photo (multipart/form-data)
router.post('/photo', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/uploads/${req.file.filename}`;
  await User.findByIdAndUpdate(req.user.id, { $set: { photoUrl: url } });
  res.json({ url });
});

// POST /api/profile/change-password
router.post('/change-password', auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'oldPassword and newPassword are required' });
  }

  const user = await User.findById(req.user.id).select('password');
  if (!user) return res.status(404).json({ error: 'Not found' });

  const ok = await bcrypt.compare(oldPassword, user.password);
  if (!ok) return res.status(400).json({ error: 'Old password is incorrect' });

  const hash = await bcrypt.hash(newPassword, 10);
  await User.findByIdAndUpdate(req.user.id, { $set: { password: hash } });
  res.json({ ok: true });
});

module.exports = router;
