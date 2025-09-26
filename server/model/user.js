const mongoose = require('mongoose')


const UserSchema = new mongoose.Schema({
    user_id: {
        type: Number,
        required: true,
        uninque: true
    },
    username: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        uninque: true
    },
    password: {
        type: String,
        require: true
    },
    student_number: {
        type: String,
        required: false,
        uninque: true
    },
    user_type: {
        type: String,
        enum: ['vip','admin', 'user'],
        default: 'user'
    },
    resetOtpHash: String,
    resetOtpExpires: Date,
    resetOtpAttempts: { type: Number, default: 0 }
})

module.exports = mongoose.model('User', UserSchema)