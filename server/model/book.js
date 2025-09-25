const mongoose = require('mongoose')

const BookingSchema = new mongoose.Schema({
    bookingid: {
        type: Number,
        required: true
    },
    roomid: {
        type: Number,
        required: true
    },
    userid: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        required: true
    
    }
    

})