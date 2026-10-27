import assert from 'node:assert/strict';
import { once } from 'node:events';
import { openDatabase } from '../database.js';
import { createApp } from '../app.js';
import { loadConfig } from '../config.js';

export const TEST_CONFIG = () => loadConfig({ APP_SECRET: 't'.repeat(48) });

// Starts the app on a random port with an in-memory database and a mailer that records codes instead of sending.
export async function fixture(t, { config = TEST_CONFIG() } = {}) {
  const store = openDatabase(':memory:');
  const sent = [];
  const mailer = { async send(message) { sent.push({ ...message, code: message.subject.match(/(\d{6})$/)[1] }); } };
  const server = createApp(store, { config, mailer }).listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));store.close();});
  const url = `http://127.0.0.1:${server.address().port}`;
  const json = (path, method, body, cookie) => fetch(url + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  // Full sign-up: code by email, verify, accept terms, set profile. Returns the session cookie.
  async function signUp(email = 'student@lamduan.mfu.ac.th', username = 'student_1') {
    assert.equal((await json('/api/auth/request-code', 'POST', { email })).status, 202);
    const code = sent.at(-1).code;
    const verified = await json('/api/auth/verify', 'POST', { email, code });
    assert.equal(verified.status, 200);
    const cookie = verified.headers.get('set-cookie').split(';')[0];
    assert.equal((await json('/api/auth/terms', 'POST', { termsVersion: config.termsVersion, privacyVersion: config.privacyVersion }, cookie)).status, 204);
    assert.equal((await json('/api/me', 'PUT', { displayName: 'Student One', username, interests: ['sport'] }, cookie)).status, 200);
    return cookie;
  }
  const cookie = await signUp();
  const post = (body, asCookie = cookie) => json('/api/posts', 'POST', body, asCookie);
  return {store,url,post,json,sent,signUp,cookie,config};
}
