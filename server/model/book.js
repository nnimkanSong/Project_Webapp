const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema(
  {
    // อ้างผู้ใช้
    userid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: false },
    email: { type: String, required: false },

    // snapshot ผู้จอง ณ ตอนจอง
    student_number: { type: String, required: false },
    student_name:   { type: String, required: false },
    student_email:  { type: String, required: false },

    // รายละเอียดการจอง
    room: { type: String, required: true, enum: ['E107', 'E111', 'E113', 'B317'] },
    date: { type: Date, required: true },
    start_time: { type: String, required: true },
    end_time: { type: String, required: true },
    people: { type: Number, required: true, min: 1 },
    objective: { type: String, required: true, trim: true },

    // ✅ สำหรับ UI
    status: {
      type: String,
      enum: ['pending', 'active', 'done', 'cancel'],
      default: 'pending'
    },
    tracking: { type: String, default: 'กำลังดำเนินการ...' }
  },
  { timestamps: true }
);

BookingSchema.index({ userid: 1, createdAt: -1 });

module.exports = mongoose.model('Booking', BookingSchema);
