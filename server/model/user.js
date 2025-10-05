// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // optional external id
  userId: { type: Number, unique: true, sparse: true },

  username: { type: String, required: true, trim: true },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true,
    trim: true,
  },

  photoUrl: {
    type: String,
    default: 'https://placehold.co/200x200',
  },

  // เก็บ "แฮช" ไม่ใช่รหัสผ่านดิบ
  passwordHash: { type: String, required: true /* , select: false */ },

  // รหัสนักศึกษา (8 หลัก)
  studentNumber: {
    type: String,
    required: true,
    unique: true,
    index: true,
    match: [/^\d{8}$/, 'studentNumber must be 8 digits'],
  },

  // บทบาทผู้ใช้
  userType: { type: String, enum: ['user', 'admin', 'vip'], default: 'user' },

  // การยืนยันอีเมล
  emailVerified: { type: Boolean, default: false },
  verifiedAt: { type: Date, default: null },
  verificationMethod: { type: String, enum: ['google', 'email-link', null], default: null },
  googleId: { type: String, default: null },

  // สำหรับนโยบาย/แสดงผล
  isKmitl: { type: Boolean, default: false },

  // ----- Password reset (OTP ขั้นที่ 1) -----
  resetOtpHash: String,
  resetOtpExpires: Date,
  resetOtpAttempts: { type: Number, default: 0 },

  // ----- Password reset token (ขั้นที่ 2 หลัง OTP ผ่าน) -----
  resetTokenHash: String,
  resetTokenExpires: Date,

  // ----- ความปลอดภัย session -----
  sessionVersion: { type: Number, default: 0 },
  passwordChangedAt: Date,
}, { timestamps: true });

// TTL indexes (เอกสารที่มีค่านี้จะหมดอายุอัตโนมัติ)
userSchema.index({ resetOtpExpires: 1 }, { expireAfterSeconds: 0 });
userSchema.index({ resetTokenExpires: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('User', userSchema);
