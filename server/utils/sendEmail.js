// server/utils/sendEmail.js (ใช้ Mailtrap HTTP API + fetch ของ Node 20)
const TOKEN = process.env.MAILTRAP_TOKEN || process.env.SMTP_PASS; // ใช้ API token เดิมได้
const FROM_EMAIL = process.env.MAIL_FROM || "noreply@kmitl-rbs.online";
const FROM_NAME  = process.env.MAIL_FROM_NAME || "KMITL-RBS";

module.exports = async function sendEmail(arg1, arg2, arg3, arg4) {
  const opts = (typeof arg1 === "object" && arg1 !== null)
    ? arg1
    : { to: arg1, subject: arg2, html: arg3, text: arg4 };

  if (!opts?.to) throw new Error("No recipients defined");

  const payload = {
    from: { email: FROM_EMAIL, name: FROM_NAME },
    to:   [{ email: String(opts.to) }],
    subject: opts.subject,
    text: opts.text || undefined,
    html: opts.html,
  };

  const res = await fetch("https://send.api.mailtrap.io/api/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Mailtrap API ${res.status}: ${body}`);
  }
  return res.json();
};
