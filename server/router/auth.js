// server/router/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../model/user');
const PendingUser = require('../model/pendingUser'); // ✅ ADDED
const sendEmail = require('../utils/sendEmail');
const router = express.Router();

// ===== Helpers =====
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isStrongPassword(password) {
  // >=8 ตัว, มี a-z, A-Z, 0-9, และอักษรพิเศษ
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(password);
}

// ===== REGISTER (ไม่สร้าง User ทันที) =====
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // strong password
    if (!isStrongPassword(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 chars and include upper, lower, number, and special char'
      });
    }

    // ห้ามซ้ำทั้งใน User และ PendingUser
    const existsUser = await User.findOne({ email });
    if (existsUser) return res.status(400).json({ error: 'Email already registered' });

    // ถ้ามี pending อยู่แล้ว ให้ลบทิ้ง/เขียนทับ
    await PendingUser.deleteOne({ email });

    const passwordHash = await bcrypt.hash(password, 10);

    // เตรียม OTP
    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 นาที

    // บันทึกลง PendingUser เท่านั้น
    await PendingUser.create({
      username,
      email,
      passwordHash,
      otpHash,
      expiresAt
    });

    // ส่งอีเมล OTP
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif">
        <h2>Verify your email</h2>
        <p>Your OTP is:</p>
        <div style="font-size:24px;font-weight:700;letter-spacing:4px">${otp}</div>
        <p>This code will expire in 10 minutes.</p>
      </div>
    `;
    await sendEmail({ to: email, subject: 'Your OTP Code', html });

    // **ยังไม่สร้าง User** ส่งกลับเพื่อให้หน้าเว็บเปิด popup
    return res.status(200).json({ message: 'OTP sent', email });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ===== VERIFY OTP (ค่อยสร้าง User ที่แท้จริง) =====
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  try {
    const pending = await PendingUser.findOne({ email });
    if (!pending) return res.status(400).json({ error: 'No pending registration for this email' });

    if (pending.expiresAt < new Date()) {
      await PendingUser.deleteOne({ email });
      return res.status(400).json({ error: 'OTP expired. Please register again.' });
    }

    const ok = await bcrypt.compare(otp, pending.otpHash);
    if (!ok) return res.status(400).json({ error: 'Invalid OTP' });

    // สร้าง User จริง
    const user = await User.create({
      username: pending.username,
      email: pending.email,
      password: pending.passwordHash, // ใช้ hash ที่เก็บไว้แล้ว
      isVerified: true
    });

    // ลบ pending
    await PendingUser.deleteOne({ email });

    return res.json({ message: 'Email verified. Account created.', userId: user._id });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ===== RESEND OTP =====
router.post('/resend-otp', async (req, res) => {
  const { email } = req.body;

  try {
    // ต้องมี pending registration อยู่
    const pending = await PendingUser.findOne({ email });
    if (!pending) return res.status(400).json({ error: 'No pending registration. Please register again.' });

    // ออกใหม่
    const otp = generateOTP();
    pending.otpHash = await bcrypt.hash(otp, 10);
    pending.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await pending.save();

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif">
        <h2>Verify your email (Resend)</h2>
        <p>Your new OTP is:</p>
        <div style="font-size:24px;font-weight:700;letter-spacing:4px">${otp}</div>
        <p>This code will expire in 10 minutes.</p>
      </div>
    `;
    await sendEmail({ to: email, subject: 'Your New OTP Code', html });

    return res.json({ message: 'New OTP sent' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ===== LOGIN (ผู้ใช้ที่สร้างผ่าน verify เท่านั้นจึงมีอยู่จริง) =====
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    // หากยังไม่ verify จะไม่มี User record อยู่ (อยู่ใน PendingUser เท่านั้น)
    const user = await User.findOne({ email });
    if (!user) return res.status(403).json({ error: 'Please verify your email first' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    return res.json({ token });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
