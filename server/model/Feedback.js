const feedbackSchema = new mongoose.Schema({
  room: { type: String, required: true },
  rating: { type: Number, required: true },
  comment: { type: String, required: true },
  equipment: { type: String, required: true },
  submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Feedback', feedbackSchema);