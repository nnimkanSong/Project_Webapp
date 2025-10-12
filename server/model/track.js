// server/models/Tracking.js
const mongoose = require('mongoose');

const trackingSchema = new mongoose.Schema({
  ts: { type: Date, default: Date.now },
  totalRooms: Number,
  available: Number,
  inUse: Number,
  renovation: { type: Number, default: 0 }, // เผื่ออนาคต
  breakdown: [{
    room: String,
    status: { type: String, enum: ['available','in-use','renovation'] }
  }]
}, { timestamps: true });

module.exports = mongoose.model('track', trackSchema);
