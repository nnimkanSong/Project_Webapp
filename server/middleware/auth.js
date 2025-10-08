// server/middleware/auth.js
const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const bearer = req.headers.authorization?.split(" ")[1];
  const token = req.cookies?.token || bearer;

  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.userId };
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
