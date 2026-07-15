const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendVerificationEmail(toEmail, token) {
  const verificationUrl = `https://blackbeardtavern.me/pages/verify-email.html?token=${token}`;

  await resend.emails.send({
    from: 'Blackbeard\'s Tavern <noreply@blackbeardtavern.me>', 
    to: toEmail,
    subject: 'Confirm your email - Blackbeard\'s Tavern',
    html: `
      <h2>Welcome to Blackbeard Tavern! 🏴‍☠️</h2>
      <p>Click the link below to confirm your email and activate your account:</p>
      <a href="${verificationUrl}">${verificationUrl}</a>
      <p>This link expires in 24 hours.</p>
    `
  });
}

module.exports = { sendVerificationEmail };
