// Sends the sign-in code. Gmail (SMTP, or the Gmail API where SMTP is blocked) in normal use; a console mailer for
// local development only.

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

// Gmail API over HTTPS with an OAuth refresh token (scope gmail.send; get one with `npm run gmail-token`), for hosts
// that block SMTP ports such as Render's free web services. buildRaw turns a message into RFC 822 bytes (nodemailer's
// stream transport); buildRaw and fetch are passed in so tests need no network.
export function createGmailApiMailer({ user, clientId, clientSecret, refreshToken, fromName }, { buildRaw, fetch = globalThis.fetch }) {
  let token = null;
  async function accessToken() {
    if (token && token.expiresAt > Date.now() + 60_000) return token.value;
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.json().catch(() => ({}));
    // invalid_grant: the refresh token was revoked or expired (7 days while the OAuth app is still in "Testing").
    if (!response.ok || !body.access_token) throw Object.assign(new Error('token'), { code: `TOKEN ${body.error || response.status}` });
    token = { value: body.access_token, expiresAt: Date.now() + (body.expires_in || 3600) * 1000 };
    return token.value;
  }
  return {
    async send({ to, subject, html, text }) {
      try {
        const raw = await buildRaw({ from: { name: fromName, address: user }, to, subject, html, text });
        const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: { authorization: `Bearer ${await accessToken()}`, 'content-type': 'application/json' },
          body: JSON.stringify({ raw: Buffer.from(raw).toString('base64url') }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
          if (response.status === 401) token = null;
          throw Object.assign(new Error('send'), { code: 'API', responseCode: response.status });
        }
      } catch (error) {
        // Only the error code: response bodies can contain the recipient address.
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
