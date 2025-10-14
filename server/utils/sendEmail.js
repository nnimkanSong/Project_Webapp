// server/utils/sendEmail.js
const nodemailer = require('nodemailer');

const SMTP_HOST = (process.env.SMTP_HOST || '').trim();
const SMTP_PORT = Number((process.env.SMTP_PORT || '2525').trim());
const SMTP_USER = (process.env.SMTP_USER || '').trim();
const SMTP_PASS = (process.env.SMTP_PASS || '').trim();

const FROM_ADDR = (process.env.MAIL_FROM || process.env.FROM_EMAIL || '').trim();
const FROM_NAME = (process.env.MAIL_FROM_NAME || 'KMITL-RBS-ADMIN').trim();

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  // logger: true,
  // debug: true,
});

// รองรับทั้งรูปแบบ { to, subject, html, text } และ (to, subject, html, text)
module.exports = async function sendEmail(arg1, arg2, arg3, arg4) {
  const opts = (typeof arg1 === 'object' && arg1 !== null)
    ? arg1
    : { to: arg1, subject: arg2, html: arg3, text: arg4 };

  const toAddr = String(opts.to || '').trim();
  if (!toAddr) throw new Error('No recipients defined');

  const mailOptions = {
    from: `${FROM_NAME} <${FROM_ADDR}>`,
    to: toAddr,
    subject: opts.subject,
    text: opts.text || undefined,
    html: opts.html,
    // envelope: { from: FROM_ADDR, to: toAddr },
  };

  return transporter.sendMail(mailOptions);
};
