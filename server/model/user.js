// server/model/user.js
const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },  // รหัสผ่านที่แฮชแล้ว
  isVerified: { type: Boolean, default: true } // ผู้ใช้ที่ถูกสร้างจาก verify เสร็จ ถือว่า verified แล้ว
});

module.exports = mongoose.model('User', UserSchema);
