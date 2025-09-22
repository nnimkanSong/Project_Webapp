// server/model/pendingUser.js
const mongoose = require('mongoose');

const PendingUserSchema = new mongoose.Schema({
  username: { type: String, required: true },          // เก็บข้อมูลลงจดทะเบียนไว้ชั่วคราว
  email:    { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },      // เก็บ "รหัสผ่านที่แฮชแล้ว"
  otpHash:  { type: String, required: true },
  expiresAt:{ type: Date,   required: true }
}, {
  timestamps: true
});

// TTL index: ลบเอกสารอัตโนมัติหลังหมดอายุ (เผื่อ clock skew +5 นาที)
PendingUserSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 300 });

module.exports = mongoose.model('PendingUser', PendingUserSchema);
