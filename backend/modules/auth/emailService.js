const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendVerificationEmail(toEmail, token) {
  const verificationUrl = `https://blackbeardtavern.me/pages/verify-email.html?token=${token}`;

  await resend.emails.send({
    from: 'Blackbeard Tavern <noreply@blackbeardtavern.me>', 
    to: toEmail,
    subject: 'メールを認証してください - Blackbeard Tavern',
    html: `
      <h2>Blackbeard Tavern へようこそ！🏴‍☠️</h2>
      <p>下のリンクをクリックしてメールを認証し、アカウントを有効化してください：</p>
      <a href="${verificationUrl}">${verificationUrl}</a>
      <p>このリンクは24時間で期限切れになります。</p>
    `
  });
}

module.exports = { sendVerificationEmail };
