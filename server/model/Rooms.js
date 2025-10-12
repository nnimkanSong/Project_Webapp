// server/models/Room.js
const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  capacity: Number,
  building: String,
  floor: String,
  active: { type: Boolean, default: true }
});

module.exports = mongoose.model('Rooms', RoomSchema);
