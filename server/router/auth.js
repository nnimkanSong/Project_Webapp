// server/router/auth.js
const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

const User = require("../model/user");
const PendingUser = require("../model/pendingUser");
const sendEmail = require("../utils/sendEmail");
const auth = require("../middleware/auth"); // ✅ ตรวจ JWT จากคุกกี้/Bearer

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const { SESSION_COOKIE_NAME = "connect.sid" } = process.env;



// ---- helpers ----
function generateOTP() {
  // cryptographically stronger than Math.random()
  return crypto.randomInt(100000, 1000000).toString();
}
function isKMITLEmail(email) {
  return /^[a-zA-Z0-9._%+-]+@kmitl\.ac\.th$/.test(String(email));
}
function isStrongPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(String(password));
}
// --- top of file (หลัง require ต่าง ๆ) ---

const {
  RESET_TTL_MIN = "10",                // อายุ token นาที
  RESET_COOKIE_NAME = "reset_token_dev",  // ใช้ __Host.* เมื่อรัน HTTPS + path=/ + ไม่มี domain
  COOKIE_SECURE = "false",             // production(HTTPS) => 'true'
  COOKIE_SAMESITE = "Lax",             // 'None' ต้องคู่กับ secure:true
} = process.env;

/** สร้าง cookie HttpOnly สำหรับ reset token */
function setResetCookie(res, rawToken) {
  const maxAgeMs = Number(RESET_TTL_MIN) * 60 * 1000;
  res.cookie(RESET_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: COOKIE_SECURE === "true",
    sameSite: COOKIE_SAMESITE, // 'Lax' หรือ 'None'
    maxAge: maxAgeMs,
    path: "/",                 // ต้องเป็น / โดยเฉพาะถ้าใช้ __Host.*
  });
}

/** ลบ cookie หลังใช้งานหรือหมดอายุ */
function clearResetCookie(res) {
  res.clearCookie(RESET_COOKIE_NAME, {
    httpOnly: true,
    secure: COOKIE_SECURE === "true",
    sameSite: COOKIE_SAMESITE,
    path: "/",
  });
}
function jwtCookieOptions() {
  return {
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000,
  };
}

function signJwt(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1d" });
}

/* =============================== REGISTER =============================== */
router.post("/register", async (req, res) => {
  const { username, email, password, studentNumber } = req.body;

  try {
    if (!username || !email || !password || !studentNumber) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const normEmail = String(email).trim().toLowerCase();
    if (!isKMITLEmail(normEmail)) {
      return res
        .status(400)
        .json({ error: "Email must be a KMITL email (@kmitl.ac.th)" });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({
        error:
          "Password must be at least 8 chars and include upper, lower, number, and special char",
      });
    }
    if (!/^\d{8}$/.test(String(studentNumber))) {
      return res
        .status(400)
        .json({ error: "Student number must be 8 digits" });
    }

    const existsUser = await User.findOne({
      $or: [{ email: normEmail }, { studentNumber }],
    });
    if (existsUser) {
      return res
        .status(409)
        .json({ error: "Email or student number already registered" });
    }

    // เคลียร์ pending เดิมถ้ามี
    await PendingUser.deleteMany({
      $or: [{ email: normEmail }, { studentNumber }],
    });

    const passwordHash = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

    await PendingUser.create({
      username,
      email: normEmail,
      studentNumber,
      userType: "user",
      passwordHash,
      otpHash,
      expiresAt,
      // TODO: เพิ่ม TTL index ที่ schema (expiresAt) เพื่อ auto-cleanup
    });

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif">
        <h2>Verify your email</h2>
        <p>Your OTP is:</p>
        <div style="font-size:24px;font-weight:700;letter-spacing:4px">${otp}</div>
        <p>This code will expire in 3 minutes.</p>
      </div>`;
    await sendEmail({ to: normEmail, subject: "Your OTP Code", html });

    return res.status(200).json({ message: "OTP sent", email: normEmail });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

/* ====================== VERIFY REGISTER OTP ====================== */
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  try {
    const normEmail = String(email).trim().toLowerCase();
    const pending = await PendingUser.findOne({ email: normEmail });
    if (!pending)
      return res
        .status(400)
        .json({ error: "No pending registration for this email" });

    if (pending.expiresAt < new Date()) {
      await PendingUser.deleteOne({ _id: pending._id });
      return res
        .status(400)
        .json({ error: "OTP expired. Please register again." });
    }

    const ok = await bcrypt.compare(String(otp), pending.otpHash);
    if (!ok) return res.status(400).json({ error: "Invalid OTP" });

    const user = await User.create({
      username: pending.username,
      email: pending.email,
      studentNumber: pending.studentNumber,
      userType: pending.userType || "user",
      passwordHash: pending.passwordHash,
      emailVerified: true,
      verifiedAt: new Date(),
      verificationMethod: "email-link",
      isKmitl: true,
    });

    await PendingUser.deleteOne({ _id: pending._id });

    return res.json({
      message: "Email verified. Account created.",
      userId: user._id,
    });
  } catch (error) {
    console.error("Verify error:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

/* =========================== RESEND OTP ========================== */
router.post("/resend-otp", async (req, res) => {
  try {
    const normEmail = String(req.body?.email || "").trim().toLowerCase();
    const pending = await PendingUser.findOne({ email: normEmail });
    if (!pending)
      return res
        .status(400)
        .json({ error: "No pending registration. Please register again." });

    const otp = generateOTP();
    pending.otpHash = await bcrypt.hash(otp, 10);
    pending.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await pending.save();

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif">
        <h2>Verify your email (Resend)</h2>
        <p>Your new OTP is:</p>
        <div style="font-size:24px;font-weight:700;letter-spacing:4px">${otp}</div>
        <p>This code will expire in 10 minutes.</p>
      </div>`;
    await sendEmail({ to: normEmail, subject: "Your New OTP Code", html });
    return res.json({ message: "New OTP sent" });
  } catch (error) {
    console.error("Resend error:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

/* ========================= FORGOT PASSWORD ======================= */
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  try {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const OK_MSG = {
      message: "If an account exists, we've sent a reset code/link.",
    };

    if (!normalizedEmail)
      return res.status(400).json({ error: "Email is required" });
    if (!isKMITLEmail(normalizedEmail)) {
      return res
        .status(400)
        .json({ error: "Email must be a KMITL email (@kmitl.ac.th)" });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.emailVerified) return res.json(OK_MSG);

    const otp = generateOTP();
    user.resetOtpHash = await bcrypt.hash(otp, 10);
    user.resetOtpExpires = new Date(
      Date.now() + Number(RESET_TTL_MIN) * 60 * 1000
    );
    user.resetTokenHash = undefined;
    user.resetTokenExpires = undefined;

    await user.save();

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif">
        <h2>Password Reset Code</h2>
        <p>Your OTP is:</p>
        <div style="font-size:24px;font-weight:700;letter-spacing:4px">${otp}</div>
        <p>This code will expire in ${RESET_TTL_MIN} minutes.</p>
      </div>`;
    await sendEmail({
      to: normalizedEmail,
      subject: "Your Password Reset Code",
      html,
    });

    return res.json(OK_MSG);
  } catch (err) {
    console.error("forgot-password error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/verify-reset-otp", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const otp = String(req.body?.otp || "").trim();

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Invalid email or OTP" });

    if (!user.resetOtpHash || !user.resetOtpExpires) {
      return res.status(400).json({ error: "No OTP in progress. Please request a new code." });
    }
    if (user.resetOtpExpires < new Date()) {
      user.resetOtpHash = undefined;
      user.resetOtpExpires = undefined;
      await user.save();
      return res.status(400).json({ error: "OTP expired. Please request a new code." });
    }

    const ok = await bcrypt.compare(otp, user.resetOtpHash);
    if (!ok) return res.status(400).json({ error: "Invalid OTP" });

    // สร้าง reset token (raw + hash)
    const resetTokenRaw = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetTokenRaw).digest("hex");

    user.resetTokenHash = resetTokenHash;
    user.resetTokenExpires = new Date(Date.now() + Number(RESET_TTL_MIN) * 60 * 1000);
    user.resetOtpHash = undefined;
    user.resetOtpExpires = undefined;
    await user.save();

    // ✅ เก็บ raw token ใน HttpOnly cookie แทนการส่งให้ FE
    setResetCookie(res, resetTokenRaw);

    return res.json({ message: "OTP verified" });
  } catch (error) {
    console.error("verify-reset-otp error:", error);
    return res.status(500).json({ error: "Server error" });
  }
});







router.post("/resend-reset-otp", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const OK_MSG = {
      message: "If an account exists, we've sent a reset code/link.",
    };

    const user = await User.findOne({ email });
    if (!user || !user.emailVerified) {
      // ✅ generic response กัน account enumeration
      return res.json(OK_MSG);
    }

    const otp = generateOTP();
    user.resetOtpHash = await bcrypt.hash(otp, 10);
    user.resetOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.resetTokenHash = undefined;
    user.resetTokenExpires = undefined;

    await user.save();

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif">
        <h2>New Password Reset Code</h2>
        <p>Your new OTP is:</p>
        <div style="font-size:24px;font-weight:700;letter-spacing:4px">${otp}</div>
        <p>This code will expire in 10 minutes.</p>
      </div>`;
    await sendEmail({ to: email, subject: "Your New Password Reset Code", html });

    return res.json(OK_MSG);
  } catch (error) {
    console.error("resend-reset-otp error:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const newPassword = String(req.body?.newPassword || "").trim();
    if (!newPassword) {
      return res.status(400).json({ error: "Password is required" });
    }
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ error: "Weak password" });
    }

    const raw = req.cookies?.[process.env.RESET_COOKIE_NAME || "reset_token_dev"];
    if (!raw) {
      return res.status(400).json({ error: "Missing reset token (cookie not found)" });
    }

    const givenHash = crypto.createHash("sha256").update(raw).digest("hex");

    const user = await User.findOne({ resetTokenHash: givenHash }).select("email username resetTokenHash resetTokenExpires passwordChangedAt");
    if (!user) return res.status(400).json({ error: "Invalid reset token" });
    if (!user.resetTokenExpires || user.resetTokenExpires < new Date()) {
      user.resetTokenHash = undefined;
      user.resetTokenExpires = undefined;
      await user.save();
      res.clearCookie(process.env.RESET_COOKIE_NAME || "reset_token_dev", { path: "/" });
      return res.status(400).json({ error: "Reset token expired" });
    }

    // ✅ Hash รหัสใหม่
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordChangedAt = new Date();
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    user.resetTokenHash = undefined;
    user.resetTokenExpires = undefined;
    await user.save();
    
    res.clearCookie(process.env.RESET_COOKIE_NAME || "reset_token_dev", { path: "/" });
    
    function escapeHtml(s = "") {
      return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    }
    (async () => {
  try {
    const to = String(user?.email || "").trim();
    if (!to) {
      console.warn("reset-password: skip sendEmail — user.email is empty");
      return;
    }

    const appName = process.env.APP_NAME || "KMITL-RBS";
    const displayName =
      (user.fullName && user.fullName.trim()) ||
      (user.username && user.username.trim()) ||
      to.split("@")[0];

    // ใช้เวลาที่บันทึกใน DB (ตั้งไว้ก่อนหน้า: user.passwordChangedAt = new Date())
    const when = user.passwordChangedAt ? new Date(user.passwordChangedAt) : new Date();

    // แสดงทั้งเวลาไทยและ UTC
    const tsTH = when.toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const tsUTC = when.toISOString().replace("T", " ").replace("Z", " UTC");

    const subject = `${appName}: Your password was changed`;

    const html = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height: 1.6; color: #0f172a">
        <h2 style="margin:0 0 12px">${appName} — Password changed</h2>
        <p>Hello ${escapeHtml(displayName)},</p>
        <p>Your password was changed successfully.</p>
        <p>
          <b>Time (Asia/Bangkok)</b>: ${escapeHtml(tsTH)}<br/>
          <b>Time (UTC)</b>: ${escapeHtml(tsUTC)}
        </p>
        <p>If this wasn’t you, please <b>reset your password immediately</b> and contact support.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0; margin:16px 0" />
        <p style="font-size:12px; color:#64748b">This is an automated notification — please do not reply.</p>
      </div>
    `;

    const text =
`Hello ${displayName},

Your password was changed successfully.

Time (Asia/Bangkok): ${tsTH}
Time (UTC): ${tsUTC}

If this wasn't you, please reset your password immediately and contact support.`;

    await sendEmail(to, subject, html, text);
  } catch (mailErr) {
    console.error("reset-password: sendEmail failed:", mailErr);
  }
})();

    return res.json({ message: "Password has been reset" });
  } catch (error) {
    console.error("reset-password error:", error);
    return res.status(500).json({ error: "Server error" });
  }
});










/* ============================== LOGIN ============================ */
router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user.passwordHash) {
      console.error("Login: missing passwordHash for", email);
      return res.status(500).json({ error: "Account misconfigured" });
    }

    if (!user) return res.status(400).json({ error: "Invalid credentials" });
    if (!user.emailVerified)
      return res.status(403).json({ error: "Please verify your email first" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ error: "Invalid credentials" });

    const token = signJwt(user._id.toString());
    res.cookie("token", token, jwtCookieOptions());
    return res.json({ ok: true, message: "Login success" });
  } catch (err) {
    next(err);
  }
});


router.get("/me", auth, async (req, res) => {
  const u = await User.findById(req.user.id).select(
    "email userType sessionVersion"
  );
  if (!u) return res.status(401).json({ ok: false });

  res.json({
    ok: true,
    user: {
      id: req.user.id,
      email: u.email,
      role: u.userType,
      sessVer: u.sessionVersion || 0,
    },
  });
});

router.post("/logout", (_req, res) => {
  // เคลียร์ JWT cookie
  res.clearCookie("token", jwtCookieOptions());
  // เคลียร์คุกกี้อื่น ๆ ที่อาจเหลือจากสมัย session (กันงง)
  const known = [SESSION_COOKIE_NAME, "__Host-sid", "csrf", "theme"];
  for (const name of known) {
    res.clearCookie(name, {
      path: "/",
      sameSite: COOKIE_SAMESITE,
      secure: COOKIE_SECURE === "true",
    });
  }
  return res.json({ ok: true, message: "Logged out" });
});

/* --------------- VERIFY BY GOOGLE (Email only) --------------- */
router.post("/verify-google-email", async (req, res) => {
  try {
    const expectedEmail = String(req.body.expectedEmail || "")
      .trim()
      .toLowerCase();
    const credential = req.body.credential;
    if (!credential || !expectedEmail) {
      return res
        .status(400)
        .json({ error: "Missing credential or expectedEmail" });
    }

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = String(payload?.email || "").toLowerCase();
    const email_verified = payload?.email_verified;
    const googleId = payload?.sub;

    if (!email_verified)
      return res.status(400).json({ error: "Email not verified by Google" });
    if (email !== expectedEmail)
      return res.status(400).json({ error: "Email mismatch" });

    let user = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          emailVerified: true,
          verifiedAt: new Date(),
          verificationMethod: "google",
          googleId,
          isKmitl: email.endsWith("@kmitl.ac.th"),
        },
      },
      { new: true }
    );

    if (!user) {
      const pending = await PendingUser.findOne({ email });
      if (pending) {
        pending.googleVerified = true;
        await pending.save();
      }
    }

    return res.json({ email, verified: true });
  } catch (err) {
    console.error("verify-google-email error:", err);
    return res.status(401).json({ error: "Invalid Google token" });
  }
});



module.exports = router;
