// server/utils/sendEmail.js
const nodemailer = require('nodemailer');

const SMTP_HOST = (process.env.SMTP_HOST || '').trim();
const SMTP_PORT = Number((process.env.SMTP_PORT || '587').trim());
const SMTP_USER = (process.env.SMTP_USER || '').trim();
const SMTP_PASS = (process.env.SMTP_PASS || '').trim();

const FROM_ADDR = (process.env.MAIL_FROM || 'noreply@kmitl-rbs.online').trim();
const FROM_NAME = (process.env.MAIL_FROM_NAME || 'KMITL-RBS-ADMIN').trim();

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.error('❌ Missing SMTP environment variables');
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false,          // Mailtrap Live ใช้ STARTTLS (ไม่ใช่ SSL)
  requireTLS: true,       // บังคับ TLS
  auth: {
    user: SMTP_USER,      // ต้องเป็น 'api'
    pass: SMTP_PASS,      // คือ Mailtrap API Token
  },
  tls: {
    rejectUnauthorized: false, // ป้องกัน error บาง region ของ Render
  },
});

// ✅ ฟังก์ชันส่งอีเมล (รองรับทั้ง object และ parameter)
module.exports = async function sendEmail(arg1, arg2, arg3, arg4) {
  const opts = (typeof arg1 === 'object' && arg1 !== null)
    ? arg1
    : { to: arg1, subject: arg2, html: arg3, text: arg4 };

  const to = String(opts.to || '').trim();
  if (!to) throw new Error('❌ No recipients defined');

  const mailOptions = {
    from: `${FROM_NAME} <${FROM_ADDR}>`,
    to,
    subject: opts.subject,
    text: opts.text || undefined,
    html: opts.html,
  };

  try {
    await transporter.verify();
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.messageId);
    return info;
  } catch (err) {
    console.error('❌ Email send failed:', {
      code: err.code,
      command: err.command,
      message: err.message,
      response: err.response,
    });
    throw err;
  }
};
