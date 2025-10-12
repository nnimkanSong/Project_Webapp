// models/Room.js
const mongoose = require('mongoose');
const RoomSchema = new mongoose.Schema({
    code: { type: String, unique: true, required: true }, // 'E107'
    building: { type: String },
    floor: { type: String },
    capacity: { type: Number },
    equipment: [{ type: String }],      // ['projector','whiteboard']
    openAt: { type: String },         // '08:00'
    closeAt: { type: String },         // '18:00'
    active: { type: Boolean, default: true },
}, { timestamps: true });

RoomSchema.index({ code: 1 }, { unique: true });
module.exports = mongoose.model('Room', RoomSchema);
