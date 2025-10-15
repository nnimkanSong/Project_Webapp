const mongoose = require("mongoose");

const PictureSchema = new mongoose.Schema({
  url: { type: String, required: true },
  caption: { type: String },
}, { timestamps: true });

// แนะนำบังคับชื่อ collection ให้ชัด
module.exports = mongoose.model("Picture", PictureSchema, "pictures");
