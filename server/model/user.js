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
  isActive: { type: Boolean, default: false, index: true },
  lastLoginAt: { type: Date },
  lastLogoutAt: { type: Date },
  photoUrl: { type: String, default: 'https://placehold.co/200x200' },

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

  verificationMethod: { type: String, enum: ['google', 'email-link'] },

  googleId: { type: String, default: null },
  isKmitl: { type: Boolean, default: false },

  resetOtpHash: String,
  resetOtpExpires: Date,
  resetOtpAttempts: { type: Number, default: 0 },

  resetTokenHash: String,
  resetTokenExpires: Date,

  sessionVersion: { type: Number, default: 0 },
  passwordChangedAt: Date,
}, { timestamps: true });



module.exports = mongoose.model('User', userSchema);
