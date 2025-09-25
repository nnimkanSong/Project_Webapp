const mongoose = require('mongoose')


const UserSchema = new mongoose.Schema({
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
    resetOtpHash: String,
    resetOtpExpires: Date,
    resetOtpAttempts: { type: Number, default: 0 }
})

module.exports = mongoose.model('User', UserSchema)
