const express = require('express');
const mongoose = require('mongoose')
const  cors = require('cors');
require('dotenv').config();

const app = express();

const authRoutes = require('./router/auth')
const bookingRoutes = require('./router/booking');
//midleware
app.use(cors({ origin: 'http://localhost:5174' }))
app.use(express.json())

mongoose.connect(process.env.MONGO_URI)

app.use('/api/auth', authRoutes)
app.use('/api', bookingRoutes);

const port = process.env.PORT  || 5000;


app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})