// server/model/user.js
const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  studentNumber: { type: String, required: true, unique: true, index: true }, // ✅
  userType: { type: String, enum: ['user','admin','uservip'], default: 'user' },
  isVerified: { type: Boolean, default: true },
  otpHash:   { type: String },
  expiresAt: { type: Date  },
  resetTokenHash:    { type: String },
  resetTokenExpires: { type: Date   },
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
