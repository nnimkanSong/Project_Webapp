const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = require('../model/user');
const PendingUser = require('../model/pendingUser');
const sendEmail = require('../utils/sendEmail');
const { OAuth2Client } = require('google-auth-library');

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/* -------------------------- helpers -------------------------- */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
function isKMITLEmail(email) {
  return /^[a-zA-Z0-9._%+-]+@kmitl\.ac\.th$/.test(email);
}
function isStrongPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(password);
}

/* -------------------------- REGISTER ------------------------- */
router.post('/register', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const student_number = req.body.student_number ?? null;

    if (!isKMITLEmail(email)) {
      return res.status(400).json({ error: 'Email must be a KMITL email (@kmitl.ac.th)' });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 chars and include upper, lower, number, and special char',
      });
    }

    const existsUser = await User.findOne({ email });
    if (existsUser) return res.status(400).json({ error: 'Email already registered' });

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
      expiresAt,
      student_number,
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

/* -------------------------- VERIFY OTP ----------------------- */
router.post('/verify-otp', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();

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
      student_number: pending.student_number ?? null,
      emailVerified: true,
      verifiedAt: new Date(),
      verificationMethod: 'email-link',
      isKmitl: true,
    });

    await PendingUser.deleteOne({ email });

    return res.json({ message: 'Email verified. Account created.', userId: user._id });
  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({ error: error.message });
  }
});

/* -------------------------- RESEND OTP ----------------------- */
router.post('/resend-otp', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();

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

/* -------------------------- LOGIN ---------------------------- */
router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    if (user.emailVerified === false) {
      return res.status(403).json({ error: 'Please verify your email first' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    return res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: error.message });
  }
});

/* --------------- VERIFY BY GOOGLE (Email only) --------------- */
router.post('/verify-google-email', async (req, res) => {
  try {
    const expectedEmail = String(req.body.expectedEmail || '').trim().toLowerCase();
    const credential = req.body.credential;

    if (!credential || !expectedEmail) {
      return res.status(400).json({ error: 'Missing credential or expectedEmail' });
    }

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = String(payload?.email || '').toLowerCase();
    const email_verified = payload?.email_verified;
    const googleId = payload?.sub;

    if (!email_verified) {
      return res.status(400).json({ error: 'Email not verified by Google' });
    }
    if (email !== expectedEmail) {
      return res.status(400).json({ error: 'Email mismatch' });
    }

    // (ออปชัน) จำกัดโดเมน kmitl
    // if (!email.endsWith('@kmitl.ac.th')) return res.status(403).json({ error: 'Only @kmitl.ac.th allowed' });

    // ✅ มี User แล้ว → อัปเดตธง
    let user = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          emailVerified: true,
          verifiedAt: new Date(),
          verificationMethod: 'google',
          googleId,
          isKmitl: email.endsWith('@kmitl.ac.th'),
        },
      },
      { new: true }
    );

    // 🟨 ยังไม่มี User → mark ใน Pending (ถ้าใช้)
    if (!user) {
      const pending = await PendingUser.findOne({ email });
      if (pending) {
        pending.googleVerified = true; // (เพิ่มใน schema ของ PendingUser ถ้ายังไม่มี)
        await pending.save();
      }
    }

    return res.json({ email, verified: true });
  } catch (err) {
    console.error('verify-google-email error:', err);
    return res.status(401).json({ error: 'Invalid Google token' });
  }
});

module.exports = router;
