// models/Booking.js
const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema(
  {
    userid: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    room: { type: String, required: true, enum: ['E107', 'E111', 'E113', 'B317'] },
    date: { type: Date, required: true },
    start_time: { type: String, required: true },
    end_time: { type: String, required: true },
    people: { type: Number, required: true, min: 1 },
    objective: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', BookingSchema);
