const mongoose = require("mongoose");

const RoomPictureSub = new mongoose.Schema({
  picture:   { type: mongoose.Schema.Types.ObjectId, ref: "Picture", required: true },
  sortOrder: { type: Number, default: 0 },
  isPrimary: { type: Boolean, default: false },
}, { _id: false });

const RoomSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  building: String,
  floor: String,
  capacity: Number,
  equipment: [String],
  openAt: String,
  closeAt: String,
  active: { type: Boolean, default: true },
  pictures: [RoomPictureSub],
}, { timestamps: true });

RoomSchema.index({ code: 1 }, { unique: true });
module.exports = mongoose.model("Room", RoomSchema); // ใช้คอลเลกชัน rooms