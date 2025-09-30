const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = require('../model/user');
const PendingUser = require('../model/pendingUser');
const sendEmail = require('../utils/sendEmail'); // คาดว่ามีอยู่แล้วในโปรเจ็กต์

const router = express.Router();

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
function isKMITLEmail(email) {
  return /^[a-zA-Z0-9._%+-]+@kmitl\.ac\.th$/.test(email);
}
function isStrongPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(password);
}

// REGISTER (สร้าง Pending + ส่ง OTP)
router.post('/register', async (req, res) => {
  const { username, email, password, student_number } = req.body;

  try {
    if (!isKMITLEmail(email)) {
      return res.status(400).json({ error: "Email must be a KMITL email (@kmitl.ac.th)" });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 chars and include upper, lower, number, and special char'
      });
    }

    const existsUser = await User.findOne({ email });
    if (existsUser) return res.status(400).json({ error: "Email already registered" });

    // เคลียร์ pending เดิม
    await PendingUser.deleteOne({ email });

    const passwordHash = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

    await PendingUser.create({
      username,
      email,
      passwordHash,
      otpHash,
      expiresAt
    });

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif">
        <h2>Verify your email</h2>
        <p>Your OTP is:</p>
        <div style="font-size:24px;font-weight:700;letter-spacing:4px">${otp}</div>
        <p>This code will expire in 3 minutes.</p>
      </div>
    `;

    await sendEmail({ to: email, subject: 'Your OTP Code', html });

    return res.status(200).json({ message: 'OTP sent', email });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// VERIFY OTP -> สร้าง User จริง
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

    const user = await User.create({
      username: pending.username,
      email: pending.email,
      password: pending.passwordHash,
      // จะอัปเดต student_number ตอน register ก็ได้ (ถ้ารับมาด้วย)
      // student_number
    });

    await PendingUser.deleteOne({ email });

    return res.json({ message: 'Email verified. Account created.', userId: user._id });
  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// RESEND OTP
router.post('/resend-otp', async (req, res) => {
  const { email } = req.body;

  try {
    const pending = await PendingUser.findOne({ email });
    if (!pending) return res.status(400).json({ error: 'No pending registration. Please register again.' });

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
    console.error('Resend error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// LOGIN -> ออก token
router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase(); // ✅ normalize
    const { password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    // (ถ้าใช้ isVerified)
    if (user.isVerified === false) {
      return res.status(403).json({ error: 'Please verify your email first' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user._id.toString() }, // ✅ ใช้ userId เป็นหลัก
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: error.message });
  }
});


module.exports = router;
