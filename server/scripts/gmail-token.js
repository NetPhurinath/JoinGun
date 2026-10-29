// One-time helper: gets the Gmail API refresh token for GMAIL_REFRESH_TOKEN (scope gmail.send only). Run on your own
// computer: npm run gmail-token
// Before: in Google Cloud, enable the Gmail API, set up the OAuth consent screen and create an OAuth client of type
// "Desktop app", then put GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env. Sign in as the GMAIL_USER account.
// The token is printed here only; put it on the host (Render → Environment) and never commit it.
import http from 'node:http';
import { randomBytes } from 'node:crypto';

try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const clientId = (process.env.GMAIL_CLIENT_ID || '').trim();
const clientSecret = (process.env.GMAIL_CLIENT_SECRET || '').trim();
if (!clientId || !clientSecret) { console.error('Put GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env first.'); process.exit(1); }

const state = randomBytes(16).toString('hex');
let redirectUri;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, redirectUri);
  if (url.pathname !== '/') { res.writeHead(404).end(); return; }
  if (url.searchParams.get('state') !== state) { res.writeHead(400).end('State mismatch. Use the link printed in the terminal.'); return; }
  const code = url.searchParams.get('code');
  if (!code) {
    res.writeHead(400).end('Not allowed. See the terminal.');
    console.error(`Google returned: ${url.searchParams.get('error')}`);
    server.close();
    return;
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  });
  const body = await response.json().catch(() => ({}));
  if (body.refresh_token) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end('Done. Go back to the terminal.');
    console.log(`\nGMAIL_REFRESH_TOKEN=${body.refresh_token}\n\nAdd it with GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET on the host. Keep it secret.`);
  } else {
    res.writeHead(400).end('No refresh token. See the terminal.');
    console.error(`No refresh token: ${body.error || response.status} ${body.error_description || ''}`);
  }
  server.close();
});

server.listen(0, '127.0.0.1', () => {
  redirectUri = `http://127.0.0.1:${server.address().port}`;
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.send',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  console.log(`Open this link, sign in as the sending Gmail account and allow "Send email on your behalf":\n\n${auth}\n`);
});
