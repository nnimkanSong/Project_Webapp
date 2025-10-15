// server/utils/sendEmail.js
const axios = require("axios");

const TOKEN = process.env.MAILTRAP_TOKEN || process.env.SMTP_PASS;
const FROM_EMAIL = process.env.MAIL_FROM || "noreply@kmitl-rbs.online";
const FROM_NAME = process.env.MAIL_FROM_NAME || "KMITL-RBS";

module.exports = async function sendEmail(arg1, arg2, arg3, arg4) {
  const opts =
    typeof arg1 === "object" && arg1 !== null
      ? arg1
      : { to: arg1, subject: arg2, html: arg3, text: arg4 };

  if (!opts?.to) throw new Error("No recipients defined");

  const payload = {
    from: { email: FROM_EMAIL, name: FROM_NAME },
    to: [{ email: String(opts.to) }],
    subject: opts.subject,
    text: opts.text || undefined,
    html: opts.html,
  };

  try {
    const res = await axios.post(
      "https://send.api.mailtrap.io/api/send",
      payload,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    return res.data;
  } catch (err) {
    console.error("❌ Mailtrap API error:", err.response?.data || err.message);
    throw err;
  }
};
