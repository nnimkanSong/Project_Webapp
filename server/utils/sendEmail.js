// server/utils/sendEmail.js
const nodemailer = require('nodemailer');

function isTrue(v) {
  return String(v).toLowerCase() === 'true';
}

const SMTP_HOST = (process.env.SMTP_HOST || '').trim();
const SMTP_PORT = Number((process.env.SMTP_PORT || '2525').trim());
const SMTP_USER = (process.env.SMTP_USER || '').trim();
const SMTP_PASS = (process.env.SMTP_PASS || '').trim();

// รองรับทั้ง MAIL_FROM และ FROM_EMAIL
const FROM_ADDR = (process.env.MAIL_FROM || process.env.FROM_EMAIL || '').trim();
const FROM_NAME = (process.env.MAIL_FROM_NAME || 'No-Reply').trim();

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // 465=true, อื่นๆ=false
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  // เปิด debug ชั่วคราวเวลาเทส
  // logger: true,
  // debug: true,
});

module.exports = async function sendEmail({ to, subject, html, text }) {
  const toAddr = String(to || '').trim();

  const mailOptions = {
    from: `${FROM_NAME} <${FROM_ADDR}>`,
    to: toAddr,
    subject,
    text: text || undefined,
    html,
    // บาง SMTP เช็ค envelope เคร่ง -> กำหนดให้ชัด
    envelope: { from: FROM_ADDR, to: toAddr },
  };

  return transporter.sendMail(mailOptions);
};
