// model/book.js
const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema(
  {
    userid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String },
    email: { type: String },

    studentNumber: { type: String },
    student_name:   { type: String },
    student_email:  { type: String },

    roomId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    roomCode: { type: String, required: true }, // ✅ snapshot เพื่ออ่านง่าย (E107, B317)
    date: { type: Date, required: true },
    start_time: { type: String, required: true }, // 'HH:mm'
    end_time: { type: String, required: true },   // 'HH:mm'
    people: { type: Number, required: true, min: 1 },
    objective: { type: String, required: true, trim: true },

    status: {
      type: String,
      enum: ['pending', 'active', 'done', 'cancel'],
      default: 'pending'
    },
    tracking: { type: String, default: 'กำลังดำเนินการ...' }
  },
  { timestamps: true }
);
BookingSchema.index({ status: 1 });
BookingSchema.index({ userid: 1, createdAt: -1 });
BookingSchema.index({ roomId: 1, date: 1, start_time: 1, end_time: 1 }); // ✅ ช่วย query ชนกัน

module.exports = mongoose.model('Booking', BookingSchema);
