const mongoose = require('mongoose');

const Equipment = new mongoose.Schema(
  {
    imageUrl: { type: String, required: true }, // เก็บ URL รูป
    title: String,
    description: String,
    extra: String,
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EquipmentItem', equipmentItemSchema);