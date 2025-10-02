const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  user_id: {
    type: Number,
    required: false,
    unique: true
  },
  username: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  photoUrl: {
    type: String,
    required: false,
    default: 'https://placehold.co/200x200'
  },
  password: {
    type: String,
    required: true
  },
  student_number: {
    type: String,
    required: false,
    unique: true,
    default: null
  },
  user_type: {
    type: String,
    enum: ['vip','admin', 'user'],
    default: 'user'
  },
  resetOtpHash: String,
  resetOtpExpires: Date,
  resetOtpAttempts: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
