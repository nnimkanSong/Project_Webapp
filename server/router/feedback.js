const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');

router.post('/', async (req, res) => {
  try {
    const { room, rating, comment, equipment } = req.body;

    const feedback = new Feedback({ room, rating, comment, equipment });
    await feedback.save();

    res.status(200).json({ message: 'Feedback saved to mydb.feedbacks' });
  } catch (error) {
    console.error('Error saving feedback:', error);
    res.status(500).json({ message: 'Failed to save feedback' });
  }
});

module.exports = router;