const express = require('express');
const router = express.Router();
const Booking = require('../model/book');

router.post('/book', async (req, res) => {
  try {
    const { room, date, startTime, endTime, people, objective } = req.body;

    if (!room || !date || !startTime || !endTime || !people || !objective) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (endTime <= startTime) {
      return res.status(400).json({ error: 'endTime must be after startTime' });
    }

    const created = await Booking.create({
      room,
      date: new Date(date),
      start_time: startTime,
      end_time: endTime,
      people: Number(people),
      objective
    });

    return res.status(201).json({ id: created._id, message: 'Booked' });
  } catch (err) {
    console.error('Create booking error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/book', async (_req, res) => {
  const list = await Booking.find().sort({ createdAt: -1 }).limit(10);
  res.json(list);
});

module.exports = router;