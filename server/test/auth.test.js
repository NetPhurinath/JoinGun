import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, openTestDatabase, TEST_CONFIG } from './helpers.js';
import { isAllowedEmail } from '../auth.js';
import { createSecurity } from '../security.js';

const count = async (store, sql, ...args) => (await store.db.prepare(sql).get(...args)).n;

test('sign-up stores no plaintext email, records terms acceptance and auth logs, and sessions work', async t => {
  const { store, json, cookie, config } = await fixture(t);
  const me = await (await json('/api/me', 'GET', undefined, cookie)).json();
  assert.deepEqual({ ...me, id: undefined }, { id: undefined, displayName: 'Student One', username: 'student_1', year: null, interests: ['sport'], participationConsent: false, needs: null, bio: '', role: 'user', historyVisibility: 'private', suspended: null });

  // The address appears nowhere in the database as plain text; the encrypted copy decrypts back to it.
  const tables = [];
  for (const table of ['users', 'user_emails', 'login_codes', 'sessions', 'terms_acceptances', 'auth_logs']) tables.push(await store.db.prepare(`SELECT * FROM ${table}`).all());
  const dump = JSON.stringify(tables);
  assert.equal(dump.includes('student@lamduan.mfu.ac.th'), false);
  const stored = (await store.db.prepare('SELECT email_encrypted FROM user_emails').get()).email_encrypted;
  assert.equal(createSecurity(config.secret).decrypt(stored), 'student@lamduan.mfu.ac.th');

  const terms = await store.db.prepare('SELECT * FROM terms_acceptances').get();
  assert.equal(terms.user_id, me.id);
  assert.equal(terms.terms_version, config.termsVersion);
  assert.equal(terms.privacy_version, config.privacyVersion);
  assert.equal(terms.ip_address, '127.0.0.1');
  assert.match(terms.accepted_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  const actions = await store.db.prepare('SELECT action, auth_status, user_id, source_ip FROM auth_logs ORDER BY ctid').all(); // insert order
  assert.deepEqual(actions.map(row => `${row.action}:${row.auth_status}`), ['code.request:sent', 'signup:success', 'terms.accept:success', 'profile.create:success']);
  assert.ok(actions.slice(1).every(row => row.user_id === me.id && row.source_ip === '127.0.0.1'));

  assert.equal((await json('/api/auth/logout', 'POST', undefined, cookie)).status, 204);
  assert.equal((await json('/api/me', 'GET', undefined, cookie)).status, 401);
  assert.equal(await count(store, "SELECT count(*) AS n FROM auth_logs WHERE action = 'logout' AND user_id = ?", me.id), 1);
});

test('session cookie is HttpOnly and SameSite=Lax, and Secure when configured', async t => {
  const config = { ...TEST_CONFIG(), cookieSecure: true };
  const { json, sent } = await fixture(t, { config });
  await json('/api/auth/request-code', 'POST', { email: 'cookie@mfu.ac.th' });
  const response = await json('/api/auth/verify', 'POST', { email: 'cookie@mfu.ac.th', code: sent.at(-1).code });
  const header = response.headers.get('set-cookie');
  assert.match(header, /^jg_session=[A-Za-z0-9_-]{43};/);
  assert.match(header, /HttpOnly/); assert.match(header, /SameSite=Lax/); assert.match(header, /Secure/);
});

test('only .ac.th addresses are accepted, case-insensitively', async t => {
  for (const ok of ['a@lamduan.mfu.ac.th', 'first.last@chula.ac.th', 'x+tag@sub.ku.ac.th']) assert.equal(isAllowedEmail(ok, 'ac.th'), true, ok);
  for (const bad of ['a@gmail.com', 'a@ac.th', 'a@mfu.ac.th.evil.com', 'a@mfuac.th', 'a@-bad.ac.th', '@mfu.ac.th', 'a b@mfu.ac.th']) assert.equal(isAllowedEmail(bad, 'ac.th'), false, bad);
  const { json, sent } = await fixture(t);
  const refused = await json('/api/auth/request-code', 'POST', { email: 'someone@gmail.com' });
  assert.equal(refused.status, 400); assert.equal((await refused.json()).field, 'email');
  const accepted = await json('/api/auth/request-code', 'POST', { email: '  Mixed.Case@KU.AC.TH ' });
  assert.equal(accepted.status, 202);
  assert.deepEqual(await accepted.json(), { resendAfter: 60, expiresInMinutes: 10 });
  assert.match(sent.at(-1).text, /ใช้ได้ 10 นาที/, 'the email states the same validity');
  assert.equal(sent.at(-1).to, 'mixed.case@ku.ac.th');
  assert.equal((await json('/api/auth/request-code', 'POST', { email: 'x@ku.ac.th', extra: 1 })).status, 400);
});

test('codes are single-use, expire, lock after five wrong attempts, and resends are rate-limited', async t => {
  const { store, json, sent } = await fixture(t);
  const email = 'codes@mfu.ac.th';
  await json('/api/auth/request-code', 'POST', { email });
  assert.equal((await json('/api/auth/request-code', 'POST', { email })).status, 429, 'resend within 60 seconds');
  const code = sent.at(-1).code;
  const wrong = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) assert.equal((await json('/api/auth/verify', 'POST', { email, code: wrong })).status, 400);
  const locked = await json('/api/auth/verify', 'POST', { email, code });
  assert.equal(locked.status, 400, 'correct code refused after five wrong attempts');
  assert.match((await locked.json()).error, /ขอรหัสใหม่/);
  assert.equal(await count(store, "SELECT count(*) AS n FROM auth_logs WHERE action = 'login' AND auth_status LIKE 'failure%'"), 6);

  // A fresh code works once, then cannot be reused.
  await store.db.prepare('DELETE FROM login_codes').run();
  const second = 'codes2@mfu.ac.th';
  await json('/api/auth/request-code', 'POST', { email: second });
  const fresh = sent.at(-1).code;
  assert.equal((await json('/api/auth/verify', 'POST', { email: second, code: fresh })).status, 200);
  assert.equal((await json('/api/auth/verify', 'POST', { email: second, code: fresh })).status, 400);

  // An expired code is refused.
  const third = 'codes3@mfu.ac.th';
  await json('/api/auth/request-code', 'POST', { email: third });
  await store.db.prepare("UPDATE login_codes SET expires_at = '2000-01-01T00:00:00.000Z'").run();
  assert.equal((await json('/api/auth/verify', 'POST', { email: third, code: sent.at(-1).code })).status, 400);
});

test('returning users sign straight in; new accounts must accept terms before a profile, and usernames are unique', async t => {
  const { json, sent, cookie } = await fixture(t, { config: { ...TEST_CONFIG(), resendSeconds: 0 } });
  const me = await (await json('/api/me', 'GET', undefined, cookie)).json();
  assert.equal((await json('/api/auth/request-code', 'POST', { email: 'STUDENT@lamduan.mfu.ac.th' })).status, 202);
  const back = await (await json('/api/auth/verify', 'POST', { email: 'student@lamduan.mfu.ac.th', code: sent.at(-1).code })).json();
  assert.equal(back.status, 'signed-in'); assert.equal(back.user.id, me.id); assert.equal(back.user.username, 'student_1');

  await json('/api/auth/request-code', 'POST', { email: 'new@mfu.ac.th' });
  const verified = await json('/api/auth/verify', 'POST', { email: 'new@mfu.ac.th', code: sent.at(-1).code });
  assert.deepEqual(await verified.json(), { status: 'needs-terms' });
  const newCookie = verified.headers.get('set-cookie').split(';')[0];
  const early = await json('/api/me', 'PUT', { displayName: 'New', username: 'new_one' }, newCookie);
  assert.equal(early.status, 403, 'profile before terms');
  assert.equal((await json('/api/posts', 'POST', { type: 'text', content: 'hi' }, newCookie)).status, 403, 'unfinished account cannot post');
  assert.equal((await json('/api/auth/terms', 'POST', { termsVersion: 'old', privacyVersion: 'old' }, newCookie)).status, 409);
  assert.equal((await json('/api/auth/terms', 'POST', { termsVersion: 'terms-draft-1', privacyVersion: 'privacy-draft-1' }, newCookie)).status, 204);
  assert.equal((await (await json('/api/me', 'GET', undefined, newCookie)).json()).needs, 'profile');
  const taken = await json('/api/me', 'PUT', { displayName: 'New', username: 'student_1' }, newCookie);
  assert.equal(taken.status, 409); assert.equal((await taken.json()).field, 'username');
  for (const bad of [{ displayName: '', username: 'ok_name' }, { displayName: 'A', username: 'no' }, { displayName: 'A', username: 'Bad-Name' }, { displayName: 'A', username: 'ok_name', year: '9' }, { displayName: 'A', username: 'ok_name', interests: ['music'] }, { displayName: 'A', username: 'ok_name', nationalId: '1' }]) {
    assert.equal((await json('/api/me', 'PUT', bad, newCookie)).status, 400, JSON.stringify(bad));
  }
  const saved = await json('/api/me', 'PUT', { displayName: 'New', username: 'New_One' }, newCookie);
  assert.equal(saved.status, 200); assert.equal((await saved.json()).username, 'new_one');
});

test('posting requires a signed-in account; foreign origins and mail failures are refused', async t => {
  const { url, json, store } = await fixture(t);
  assert.equal((await json('/api/posts', 'POST', { type: 'text', content: 'anonymous' })).status, 401);
  const crossSite = await fetch(`${url}/api/auth/request-code`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: JSON.stringify({ email: 'x@mfu.ac.th' }) });
  assert.equal(crossSite.status, 403);
  const form = await fetch(`${url}/api/auth/logout`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'a=1' });
  assert.equal(form.status, 415);
  assert.equal(await count(store, 'SELECT count(*) AS n FROM posts'), 0);
});

test('a failed email send returns 503 and is logged without the address', async t => {
  const { createApp } = await import('../app.js');
  const { once } = await import('node:events');
  const store = await openTestDatabase();
  const server = createApp(store, { config: TEST_CONFIG(), mailer: { async send() { const { MailError } = await import('../mailer.js'); throw new MailError('down'); } } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await store.close(); });
  const original = console.error; console.error = () => {}; t.after(() => { console.error = original; });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/request-code`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'fail@mfu.ac.th' }) });
  assert.equal(response.status, 503);
  const row = await store.db.prepare('SELECT * FROM auth_logs').get();
  assert.equal(row.auth_status, 'mail-failed'); assert.equal(JSON.stringify(row).includes('fail@mfu.ac.th'), false);
});

test('the Gmail mailer uses the app password and reports failures without details', async () => {
  const { createGmailMailer, MailError } = await import('../mailer.js');
  const made = [], sent = [];
  const fakeCreateTransport = options => { made.push(options); return { async sendMail(message) { sent.push(message); } }; };
  const mailer = createGmailMailer({ user: 'joingun.app@gmail.com', appPassword: 'abcdefghijklmnop', fromName: 'JoinGun' }, fakeCreateTransport);
  await mailer.send({ to: 'a@mfu.ac.th', subject: 'S', html: '<p>H</p>', text: 'T' });
  assert.equal(made[0].service, 'gmail');
  assert.deepEqual(made[0].auth, { user: 'joingun.app@gmail.com', pass: 'abcdefghijklmnop' });
  assert.deepEqual(sent[0], { from: { name: 'JoinGun', address: 'joingun.app@gmail.com' }, to: 'a@mfu.ac.th', subject: 'S', html: '<p>H</p>', text: 'T' });
  const failing = createGmailMailer({ user: 'u@gmail.com', appPassword: 'p', fromName: 'J' }, () => ({ async sendMail() { throw Object.assign(new Error('Invalid login for a@mfu.ac.th'), { code: 'EAUTH', responseCode: 535 }); } }));
  await assert.rejects(failing.send({ to: 'a@mfu.ac.th', subject: 'S', html: 'H', text: 'T' }), error => error instanceof MailError && error.message === 'Gmail send failed: EAUTH 535');
});

test('Gmail settings: spaces are removed from the app password and production requires both values', async () => {
  const { loadConfig } = await import('../config.js');
  const config = loadConfig({ APP_SECRET: 's'.repeat(40), GMAIL_USER: ' joingun.app@gmail.com ', GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop' });
  assert.equal(config.gmailUser, 'joingun.app@gmail.com');
  assert.equal(config.gmailAppPassword, 'abcdefghijklmnop');
  assert.throws(() => loadConfig({ NODE_ENV: 'production', APP_SECRET: 's'.repeat(40), GMAIL_USER: 'x@gmail.com' }), /GMAIL_USER and GMAIL_APP_PASSWORD/);
  // The three Gmail API values replace the App Password; two of them are not enough.
  const api = { GMAIL_CLIENT_ID: ' id ', GMAIL_CLIENT_SECRET: 'secret', GMAIL_REFRESH_TOKEN: 'refresh' };
  const production = { NODE_ENV: 'production', APP_SECRET: 's'.repeat(40), GMAIL_USER: 'x@gmail.com', DATABASE_URL: 'postgres://u@db/x' };
  assert.deepEqual(loadConfig({ ...production, ...api }).gmailApi, { clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' });
  assert.throws(() => loadConfig({ ...production, ...api, GMAIL_REFRESH_TOKEN: '' }), /GMAIL_USER and GMAIL_APP_PASSWORD/);
  assert.equal(config.gmailApi, null);
});

test('the Gmail API mailer refreshes the token once, sends the raw message and reports failures without details', async () => {
  const { createGmailApiMailer, MailError } = await import('../mailer.js');
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('oauth2')) return new Response(JSON.stringify({ access_token: 'at', expires_in: 3600 }), { status: 200 });
    return new Response('{}', { status: 200 });
  };
  const built = [];
  const buildRaw = async message => { built.push(message); return Buffer.from('raw message'); };
  const mailer = createGmailApiMailer({ user: 'joingun.app@gmail.com', clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh', fromName: 'JoinGun' }, { buildRaw, fetch: fakeFetch });
  await mailer.send({ to: 'a@mfu.ac.th', subject: 'S', html: '<p>H</p>', text: 'T' });
  await mailer.send({ to: 'b@mfu.ac.th', subject: 'S', html: '<p>H</p>', text: 'T' });
  assert.deepEqual(built[0], { from: { name: 'JoinGun', address: 'joingun.app@gmail.com' }, to: 'a@mfu.ac.th', subject: 'S', html: '<p>H</p>', text: 'T' });
  assert.equal(calls.filter(call => call.url.includes('oauth2')).length, 1, 'the access token is reused');
  assert.equal(String(calls[0].options.body), 'client_id=id&client_secret=secret&refresh_token=refresh&grant_type=refresh_token');
  const send = calls[1];
  assert.equal(send.url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
  assert.equal(send.options.headers.authorization, 'Bearer at');
  assert.deepEqual(JSON.parse(send.options.body), { raw: Buffer.from('raw message').toString('base64url') });

  const revoked = createGmailApiMailer({ user: 'u@gmail.com', clientId: 'i', clientSecret: 's', refreshToken: 'r', fromName: 'J' },
    { buildRaw, fetch: async () => new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'for a@mfu.ac.th' }), { status: 400 }) });
  await assert.rejects(revoked.send({ to: 'a@mfu.ac.th', subject: 'S', html: 'H', text: 'T' }), error => error instanceof MailError && error.message === 'Gmail send failed: TOKEN invalid_grant');
  const refused = createGmailApiMailer({ user: 'u@gmail.com', clientId: 'i', clientSecret: 's', refreshToken: 'r', fromName: 'J' },
    { buildRaw, fetch: async url => url.includes('oauth2') ? new Response(JSON.stringify({ access_token: 'at' })) : new Response('{"error":{"message":"a@mfu.ac.th"}}', { status: 403 }) });
  await assert.rejects(refused.send({ to: 'a@mfu.ac.th', subject: 'S', html: 'H', text: 'T' }), error => error instanceof MailError && error.message === 'Gmail send failed: API 403');
});
