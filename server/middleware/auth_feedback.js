const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId || decoded.user_id || decoded.id;

    // ✅ เช็คค่าที่แกะออกมา
    console.log("Decoded token payload:", decoded);

    next();
  } catch (err) {
    console.error("JWT verify error:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
