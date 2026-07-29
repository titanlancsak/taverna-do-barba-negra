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
      <h2>Blackbeard Tavern へようこそ！</h2>
      <p>下のリンクをクリックしてメールを認証し、アカウントを有効化してください：</p>
      <a href="${verificationUrl}">${verificationUrl}</a>
      <p>このリンクは24時間で期限切れになります。</p>
    `
  });
}

async function sendPasswordResetEmail(toEmail, token) {
  const resetUrl = `https://blackbeardtavern.me/pages/reset-password.html?token=${token}`;

  await resend.emails.send({
    from: 'Blackbeard Tavern <noreply@blackbeardtavern.me>',
    to: toEmail,
    subject: 'パスワードの再設定 - Blackbeard Tavern',
    html: `
      <h2>パスワードの再設定</h2>
      <p>下のリンクをクリックして、新しいパスワードを設定してください：</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>このリンクは1時間で期限切れになります。</p>
      <p>心当たりがない場合は、このメールを無視してください。</p>
    `
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
