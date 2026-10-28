// Server for the Playwright tests only: an in-memory database, a mailer that records sign-in codes instead of sending
// them, and seed activities. It never opens data/ or DATABASE_URL. Started by playwright.config.js.
import http from 'node:http';
import { once } from 'node:events';
import { openDatabase } from '../../server/database.js';
import { createApp } from '../../server/app.js';
import { loadConfig } from '../../server/config.js';

export const APP_PORT = 3100;
export const CODE_PORT = 3101;

const config = loadConfig({ APP_SECRET: 'e2e'.repeat(16) });
const store = await openDatabase(':memory:');
const codes = new Map();
const mailer = { async send(message) { const code = message.subject.match(/(\d{6})$/)?.[1]; if (code) codes.set(message.to, code); } };
const app = createApp(store, { config, mailer });
const server = app.listen(APP_PORT, '127.0.0.1');
await once(server, 'listening');

// The tests read sign-in codes (and the terms versions) here; this helper exists only in the test server.
const codeServer = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/terms') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ termsVersion: config.termsVersion, privacyVersion: config.privacyVersion }));
    return;
  }
  const code = codes.get(url.searchParams.get('email'));
  res.writeHead(code ? 200 : 404, { 'Content-Type': 'text/plain' }).end(code ?? '');
});
codeServer.listen(CODE_PORT, '127.0.0.1');
await once(codeServer, 'listening');

const base = `http://127.0.0.1:${APP_PORT}`;
const call = (path, method, body, cookie) => fetch(base + path, {
  method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
});
async function signUp(email, username, displayName) {
  await call('/api/auth/request-code', 'POST', { email });
  const verified = await call('/api/auth/verify', 'POST', { email, code: codes.get(email) });
  const cookie = verified.headers.get('set-cookie').split(';')[0];
  await call('/api/auth/terms', 'POST', { termsVersion: config.termsVersion, privacyVersion: config.privacyVersion }, cookie);
  await call('/api/me', 'PUT', { displayName, username, interests: ['sport'] }, cookie);
  return cookie;
}
// Tomorrow at the given Bangkok hour, so every seed activity is in the future.
function tomorrowAt(hour) {
  const day = new Date(Date.now() + 7 * 3600_000 + 86_400_000).toISOString().slice(0, 10);
  return `${day}T${String(hour).padStart(2, '0')}:00:00+07:00`;
}
async function activity(cookie, { title, category, hour, location, capacity }) {
  const res = await call('/api/posts', 'POST', {
    type: 'activity', content: `${title} — seed activity for the end-to-end tests.`,
    activity: { title, category, startsAt: tomorrowAt(hour), location, capacity }, locationConsent: true,
  }, cookie);
  if (res.status !== 201) throw new Error(`Seeding "${title}" failed: ${res.status} ${await res.text()}`);
  return res.json();
}

const host = await signUp('host@lamduan.mfu.ac.th', 'host_e2e', 'Host E2E');
const member = await signUp('member@lamduan.mfu.ac.th', 'member_e2e', 'Member E2E');
await activity(host, { title: 'E2E Badminton open', category: 'sport', hour: 18, location: 'Sports hall entrance', capacity: 6 });
const full = await activity(host, { title: 'E2E Badminton full', category: 'sport', hour: 19, location: 'Sports hall court 2', capacity: 2 });
await call(`/api/activities/${full.id}/join`, 'POST', { participationConsent: true }, member);
await activity(host, { title: 'E2E Study group', category: 'study', hour: 13, location: 'Library entrance', capacity: 4 });

console.log(`JoinGun e2e server: ${base} (codes on port ${CODE_PORT})`);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { server.close(); codeServer.close(); await store.close(); process.exit(0); });
