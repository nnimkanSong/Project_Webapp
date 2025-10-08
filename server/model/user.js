// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // (optional) external numeric id
  userId: { type: Number, unique: true, sparse: true },

  username: { type: String, required: true, trim: true },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,     // บันทึกเป็นตัวพิมพ์เล็กเสมอ
    index: true,
    trim: true,
  },

  photoUrl: {
    type: String,
    default: 'https://placehold.co/200x200',
  },

  // เก็บ "แฮช" ไม่ใช่รหัสผ่านดิบ
  // หมายเหตุ: อย่าใส่ select:false ในโปรเจ็กต์นี้
  // เพราะ login และ endpoint อื่น ๆ อ่าน field นี้โดยตรง
  passwordHash: { type: String, required: true },

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

  // สถานะการยืนยันอีเมล
  emailVerified: { type: Boolean, default: false },
  verifiedAt: { type: Date, default: null },
  verificationMethod: { type: String, enum: ['google', 'email-link', null], default: null },
  googleId: { type: String, default: null },

  // สำหรับนโยบาย/แสดงผล
  isKmitl: { type: Boolean, default: false },

  // ----- Password reset (ขั้นที่ 1: OTP) -----
  resetOtpHash: String,
  resetOtpExpires: Date,
  resetOtpAttempts: { type: Number, default: 0 },

  // ----- Password reset (ขั้นที่ 2: token หลัง OTP ผ่าน) -----
  resetTokenHash: String,
  resetTokenExpires: Date,

  // ----- ความปลอดภัย session -----
  sessionVersion: { type: Number, default: 0 },
  passwordChangedAt: Date,
}, { timestamps: true });

// TTL indexes — หมดอายุอัตโนมัติเมื่อถึงเวลา (MongoDB TTL monitor ~60s)
userSchema.index({ resetOtpExpires: 1 }, { expireAfterSeconds: 0 });
userSchema.index({ resetTokenExpires: 1 }, { expireAfterSeconds: 0 });

// (ทางเลือก) ปิดการส่ง field อ่อนไหวกลับไปยัง API response (ถ้ามีการใช้ toJSON/toObject ฝั่งเซิร์ฟเวอร์)
// userSchema.set('toJSON', {
//   transform: (_, ret) => {
//     delete ret.passwordHash;
//     delete ret.resetOtpHash;
//     delete ret.resetOtpExpires;
//     delete ret.resetTokenHash;
//     delete ret.resetTokenExpires;
//     delete ret.__v;
//     return ret;
//   }
// });

module.exports = mongoose.model('User', userSchema);
