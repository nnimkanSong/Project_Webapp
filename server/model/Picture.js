const mongoose = require("mongoose");
const PictureSchema = new mongoose.Schema({
  url: { type: String, required: true }, // เก็บ secure_url จาก Cloudinary ที่คุณ “ใส่ไว้ใน DB แล้ว”
  caption: { type: String },
}, { timestamps: true });
module.exports = mongoose.model("Picture", PictureSchema);
