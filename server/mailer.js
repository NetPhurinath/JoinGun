// Sends the sign-in code. Gmail SMTP in normal use; a console mailer for local development only.

export class MailError extends Error {}

export function codeEmail(code, minutes) {
  return {
    subject: `รหัสเข้าสู่ระบบ JoinGun: ${code}`,
    text: `รหัสเข้าสู่ระบบ JoinGun ของคุณคือ ${code}\nรหัสนี้ใช้ได้ ${minutes} นาที ถ้าคุณไม่ได้ขอรหัสนี้ ไม่ต้องทำอะไร`,
    html: `<p>รหัสเข้าสู่ระบบ JoinGun ของคุณคือ</p><p style="font-size:28px;font-weight:600;letter-spacing:6px">${code}</p><p>รหัสนี้ใช้ได้ ${minutes} นาที ถ้าคุณไม่ได้ขอรหัสนี้ ไม่ต้องทำอะไร</p>`,
  };
}

// Gmail SMTP with an App Password (needs 2-Step Verification on the Google account). Personal Gmail allows about
// 500 recipients per rolling 24 hours. createTransport is nodemailer's, passed in so tests need no network.
export function createGmailMailer({ user, appPassword, fromName }, createTransport) {
  const transport = createTransport({
    service: 'gmail',
    auth: { user, pass: appPassword },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
  });
  return {
    async send({ to, subject, html, text }) {
      try {
        await transport.sendMail({ from: { name: fromName, address: user }, to, subject, html, text });
      } catch (error) {
        // Only the error code: messages from SMTP servers can contain the recipient address.
        throw new MailError(`Gmail send failed: ${error.code || error.name}${error.responseCode ? ` ${error.responseCode}` : ''}`);
      }
    },
  };
}

// Development only: prints the code to the server console instead of sending email.
export function createConsoleMailer(log = console.log) {
  return {
    async send({ subject }) {
      log(`[dev mail] ${subject}  (no email sent; set GMAIL_USER and GMAIL_APP_PASSWORD to send real email)`);
    },
  };
}
