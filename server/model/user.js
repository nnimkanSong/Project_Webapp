// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
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

  photoUrl: { type: String, default: 'https://placehold.co/200x200' },

  // เก็บ hash เท่านั้น
  passwordHash: { type: String, required: true },

  studentNumber: {
    type: String,
    required: true,
    unique: true,
    index: true,
    match: [/^\d{8}$/, 'studentNumber must be 8 digits'],
  },

  userType: { type: String, enum: ['user', 'admin', 'vip'], default: 'user' },

  emailVerified: { type: Boolean, default: false },
  verifiedAt: { type: Date, default: null },

  // ✅ ให้เป็น optional string; ถ้าจะใช้จริงให้ใส่ 'google' หรือ 'email-link'
  verificationMethod: { type: String, enum: ['google', 'email-link'] },

  googleId: { type: String, default: null },
  isKmitl: { type: Boolean, default: false },

  // ----- Password reset -----
  resetOtpHash: String,
  resetOtpExpires: Date,
  resetOtpAttempts: { type: Number, default: 0 },

  resetTokenHash: String,
  resetTokenExpires: Date,

  sessionVersion: { type: Number, default: 0 },
  passwordChangedAt: Date,
}, { timestamps: true });

// ❌ ลบสองบรรทัด TTL เดิม เพราะจะลบทั้งเอกสารผู้ใช้
// userSchema.index({ resetOtpExpires: 1 }, { expireAfterSeconds: 0 });
// userSchema.index({ resetTokenExpires: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('User', userSchema);
