const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const bearer = req.headers.authorization?.split(' ')[1];
  const token = req.cookies?.token || bearer;

  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // ตอนนี้ req.user = { id: ... }
    req.user = { id: payload.userId };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
