const mongoose = require('mongoose');

const PendingUserSchema = new mongoose.Schema({
  username:    { type: String, required: true },
  email:       { type: String, required: true, unique: true },
  studentNumber: { type: String, required: true, index: true, unique: true }, // ✅
  userType: { type: String, enum: ['user','admin'], default: 'user' }, 
  passwordHash:{ type: String, required: true },
  otpHash:     { type: String, required: true },
  expiresAt:   { type: Date,   required: true }
}, { timestamps: true });

PendingUserSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PendingUser', PendingUserSchema);
