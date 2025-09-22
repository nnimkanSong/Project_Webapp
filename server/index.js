const express = require('express');
const mongoose = require('mongoose')
const  cors = require('cors');
require('dotenv').config();

const app = express();

const authRoutes = require('./router/auth')
//midleware
app.use(cors({ origin: 'http://localhost:5174' }))
app.use(express.json())

mongoose.connect(process.env.MONGO_URI)

app.use('/api/auth', authRoutes)

const port = process.env.PORT  || 5000;


app.listen(port, () => {
  console.log(`Server runing on port ${port}`)
})

