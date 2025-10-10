const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    // ✅ ดึง token จาก cookie ก่อน แล้ว fallback ไปหา header
    const bearer = req.headers.authorization?.split(" ")[1];
    const token = req.cookies?.token || bearer;

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    // ✅ ถอดรหัส JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ เก็บ userId ไว้ใน req.userId เพื่อให้ route ถัดไปใช้งานได้
    req.userId = decoded.userId || decoded.user_id || decoded.id;

    // Debug ดู payload ที่ได้
    console.log("✅ Decoded token payload:", decoded);

    next();
  } catch (err) {
    console.error("❌ JWT verify error:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
