const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  student_number: String,
  room: String,
  rating: Number,
  comment: String,
  equipment: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Feedback", feedbackSchema);
