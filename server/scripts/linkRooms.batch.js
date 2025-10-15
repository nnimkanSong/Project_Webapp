// server/scripts/linkRooms.batch.js
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Room = require("../model/room");
const Picture = require("../model/Picture");

const { isValidObjectId, Types } = mongoose;

async function linkOne(code, idStrings, primaryIndex = 0) {
  const ids = idStrings.map(s => {
    if (!isValidObjectId(s)) throw new Error(`[${code}] Invalid ObjectId: ${s}`);
    return new Types.ObjectId(s);
  });

  // ตรวจว่ารูปมีจริง
  const found = await Picture.find({ _id: { $in: ids } }, "url").lean();
  if (found.length !== ids.length) {
    const have = new Set(found.map(f => String(f._id)));
    const missing = ids.filter(i => !have.has(String(i))).map(String);
    throw new Error(`[${code}] picture _id ไม่ครบ: ${missing.join(", ")}`);
  }

  // กัน primary index หลุดช่วง
  if (primaryIndex < 0 || primaryIndex >= ids.length) primaryIndex = 0;

  // เขียน pictures array
  const pictures = ids.map((id, i) => ({
    picture: id,
    isPrimary: i === primaryIndex,
    sortOrder: i,
  }));

  const room = await Room.findOneAndUpdate(
    { code },
    { $setOnInsert: { code, active: true }, $set: { pictures } },
    { new: true, upsert: true }
  ).populate("pictures.picture", "url");

  return {
    code,
    count: room.pictures?.length || 0,
    preview: room.pictures?.map(p => ({
      url: p.picture?.url,
      isPrimary: p.isPrimary,
      sortOrder: p.sortOrder,
    })),
  };
}

(async () => {
  try {
    const cfgPath = path.join(__dirname, "roomPics.config.json");
    if (!fs.existsSync(cfgPath)) throw new Error("ไม่พบ roomPics.config.json");
    const config = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));

    if (!process.env.MONGO_URI) throw new Error("Missing MONGO_URI in .env");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected DB:", mongoose.connection.name);

    const results = [];
    for (const [codeRaw, data] of Object.entries(config)) {
      const code = String(codeRaw).trim().toUpperCase();
      if (!data?.ids?.length) {
        console.log(`- ${code}: ข้าม (ไม่มี ids)`);
        continue;
      }
      const res = await linkOne(code, data.ids, data.primaryIndex ?? 0);
      results.push(res);
    }

    console.log("\n✅ Linked summary:");
    for (const r of results) {
      console.log(`- ${r.code}: ${r.count} images`);
      (r.preview || []).forEach(p =>
        console.log(`   • ${p.sortOrder} ${p.isPrimary ? "[primary]" : "        "} ${p.url}`)
      );
    }
  } catch (e) {
    console.error("❌ Error:", e.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
