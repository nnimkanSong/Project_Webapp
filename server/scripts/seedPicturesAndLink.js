// server/scripts/seedPicturesAndLink.js
require("dotenv").config();
const mongoose = require("mongoose");

// ✅ โมเดล
const Picture = require("../model/Picture"); // ต้องเป็น module.exports ถูกต้อง
const Room = require("../model/room");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected DB:", mongoose.connection.name);

    // 1) ใส่รูปตัวอย่าง (URL จาก Cloudinary ที่คุณเก็บไว้)
    const pics = await Picture.insertMany([
      { url: "https://res.cloudinary.com/dkgku29hb/image/upload/v1760353307/profile/u_68ecbfe4e64eb05b2655430c_1760353307227.jpg", caption: "โต๊ะ" },
      { url: "https://res.cloudinary.com/<your>/image/upload/v123/e113_2.jpg", caption: "ไวท์บอร์ด" },
      { url: "https://res.cloudinary.com/<your>/image/upload/v123/e113_3.jpg", caption: "โปรเจคเตอร์" },
    ]);
    console.log("✅ Inserted pictures:", pics.map(p => p._id.toString()));

    // 2) อัปเซิร์ทห้อง E113 แล้วผูก pictures
    const room = await Room.findOneAndUpdate(
      { code: "E113" },
      { $setOnInsert: { code: "E113", building: "E", floor: "1", active: true } },
      { new: true, upsert: true }
    );

    room.pictures = [
      { picture: pics[0]._id, isPrimary: true,  sortOrder: 0 },
      { picture: pics[1]._id, isPrimary: false, sortOrder: 1 },
      { picture: pics[2]._id, isPrimary: false, sortOrder: 2 },
    ];
    await room.save();
    console.log("✅ Linked pictures to room:", room.code);

    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error("❌ Seed error:", e);
    process.exit(1);
  }
})();
