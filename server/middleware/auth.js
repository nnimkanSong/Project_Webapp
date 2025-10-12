// middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("../model/user");

module.exports = async function auth(req, res, next) {
  try {
    const token =
      req.cookies?.token ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null);

    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const uid = payload.userId || payload.id;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const user = await User.findById(uid).select(
      "username email role userType user_type type sessionVersion"
    );
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const rawRole = user.role ?? user.userType ?? user.user_type ?? user.type ?? "user";
    const role = String(rawRole).toLowerCase();

    req.user = {
      id: String(user._id),
      email: user.email,
      username: user.username,
      role,
      userType: role,
      user_type: role,
      type: role,
      sessVer: user.sessionVersion || 0,
    };

    next();
  } catch (err) {
    console.error("auth middleware error:", err);
    return res.status(401).json({ error: "Unauthorized" });
  }
};
