// server/scripts/seedPictures.js
require("dotenv").config();
const mongoose = require("mongoose");
const Picture = require("../model/Picture");

/**
 * ใส่ URL/คำบรรยายที่ต้องการอินเสิร์ต
 * - ใช้ secure_url (https) จาก Cloudinary
 * - จะไม่ซ้ำ: ถ้ามี url เดิมอยู่แล้วจะข้าม/อัปเดต caption ให้
 */
const PICTURES = [
  { url: "https://res.cloudinary.com/dkgku29hb/image/upload/v1760518725/S__14254104_p29v6r.jpg", caption: "E107 - มุมที่ 1" },
  { url: "https://res.cloudinary.com/dkgku29hb/image/upload/v1760518306/S__14254086_udgn2z.jpg", caption: "E107 - มุมที่ 2" },
  { url: "https://res.cloudinary.com/dkgku29hb/image/upload/v1760518381/S__14254088_wbcdlj.jpg", caption: "E107 - มุมที่ 3" },
  { url: "https://res.cloudinary.com/dkgku29hb/image/upload/v1760518697/S__14254095_kjrbh0.jpg", caption: "E107 - มุมที่ 4" },
  { url: "https://res.cloudinary.com/dkgku29hb/image/upload/v1760518692/S__14254096_tu6qdh.jpg", caption: "E107 - มุมที่ 5" },
  { url: "https://res.cloudinary.com/dkgku29hb/image/upload/v1760518691/S__14254098_cjm2kj.jpg", caption: "E107 - มุมที่ 6" },
  { url: "https://res.cloudinary.com/dkgku29hb/image/upload/v1760520015/S__14254103_cdz9xj.jpg", caption: "E113 - มุมที่ 1" },
  { url: "https://res.cloudinary.com/dkgku29hb/image/upload/v1760519719/S__14254085_zr0ker.jpg", caption: "E113 - มุมที่ 2" },
  { url: "https://res.cloudinary.com/dkgku29hb/image/upload/v1760519719/S__14254084_bxrmee.jpg", caption: "E113 - มุมที่ 3" },
  { url: "https://res.cloudinary.com/dkgku29hb/image/upload/v1760519987/S__14254107_x4gzfz.jpg", caption: "E113 - มุมที่ 4" },
  { url: "https://res.cloudinary.com/dkgku29hb/image/upload/v1760519988/S__14254108_cwkmru.jpg", caption: "E113 - มุมที่ 5" },
  { url: "https://res.cloudinary.com/dkgku29hb/image/upload/v1760459743/CHP-5992_ssyqkx.jpg", caption: "E111 - มุมที่ 1" },
  { url: "https://res.cloudinary.com/dkgku29hb/image/upload/v1760459742/CHP-5996_yavbqp.jpg", caption: "E111 - มุมที่ 2" },
  { url: "https://res.cloudinary.com/dkgku29hb/image/upload/v1760460528/CHP-5964_ezoyoa.jpg", caption: "E111 - มุมที่ 3" },
  { url: "https://res.cloudinary.com/dkgku29hb/image/upload/v1760460460/CHP-5967_zmg27j.jpg", caption: "E111 - มุมที่ 4" },
  { url: "https://res.cloudinary.com/dkgku29hb/image/upload/v1760460460/CHP-5969_ljcpd1.jpg", caption: "E111 - มุมที่ 3" },
];

(async () => {
  try {
    if (!process.env.MONGO_URI) throw new Error("Missing MONGO_URI in .env");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected DB:", mongoose.connection.name);

    // สร้าง unique index (เผื่อยังไม่ถูกสร้าง)
    await Picture.collection.createIndex({ url: 1 }, { unique: true }).catch(() => {});

    const results = [];
    for (const { url, caption } of PICTURES) {
      if (!url) continue;
      // upsert ตาม url (กันซ้ำ)
      const doc = await Picture.findOneAndUpdate(
        { url },
        { $setOnInsert: { url }, $set: { caption } },
        { new: true, upsert: true }
      ).lean();
      results.push(doc);
    }

    console.log("✅ Inserted/Upserted:", results.length);
    results.forEach((d, i) => console.log(`${i + 1}. ${d._id}  ${d.url}`));
  } catch (e) {
    console.error("❌ Seed error:", e.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
