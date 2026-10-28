import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.js';
import { createSecurity } from '../security.js';
import { migrateProfileEncryption, openProfile } from '../profile-crypto.js';

const raw = (store, username) => store.db.prepare('SELECT * FROM users WHERE username = ?').get(username); // a promise
const plainText = row => JSON.stringify([row.year, row.interests, row.bio, row.year_enc, row.interests_enc, row.bio_enc]);

test('year, interests and bio are stored encrypted and still returned to the person and their profile viewers', async t => {
  const f = await fixture(t);
  const saved = await f.json('/api/me', 'PUT', { displayName: 'Student One', username: 'student_1', year: '3', interests: ['sport', 'cafe'], bio: 'ชอบตีแบดตอนเย็น' }, f.cookie);
  assert.equal(saved.status, 200);
  const row = await raw(f.store, 'student_1');
  assert.equal(row.year, null);
  assert.equal(row.interests, '[]');
  assert.equal(row.bio, '');
  assert.ok(row.year_enc && row.interests_enc && row.bio_enc);
  for (const secret of ['ชอบตีแบด', 'cafe', '"3"']) assert.ok(!plainText(row).includes(secret), secret);

  const me = await (await f.json('/api/me', 'GET', undefined, f.cookie)).json();
  assert.deepEqual([me.year, me.interests, me.bio], ['3', ['sport', 'cafe'], 'ชอบตีแบดตอนเย็น']);
  const other = await f.signUp('b@mfu.ac.th', 'bbb_1');
  const profile = await (await f.json('/api/users/student_1', 'GET', undefined, other)).json();
  assert.deepEqual([profile.year, profile.interests, profile.bio], ['3', ['sport', 'cafe'], 'ชอบตีแบดตอนเย็น']);
});

test('rows saved before encryption are migrated, and account deletion clears the encrypted fields', async t => {
  const f = await fixture(t);
  await f.store.db.prepare("UPDATE users SET year = '2', interests = '[\"study\"]', bio = 'old bio', year_enc = NULL, interests_enc = NULL, bio_enc = NULL WHERE username = 'student_1'").run();
  const security = createSecurity(f.config.secret);
  assert.equal(await migrateProfileEncryption(f.store.db, security), 1);
  const row = await raw(f.store, 'student_1');
  assert.deepEqual(openProfile(security, row), { year: '2', interests: ['study'], bio: 'old bio' });
  assert.ok(!plainText(row).includes('old bio'));
  assert.equal(await migrateProfileEncryption(f.store.db, security), 0, 'idempotent');

  const id = row.id;
  assert.equal((await f.json('/api/me/delete', 'POST', { confirmUsername: 'student_1' }, f.cookie)).status, 200);
  const deleted = await f.store.db.prepare('SELECT year_enc, interests_enc, bio_enc FROM users WHERE id = ?').get(id);
  assert.deepEqual({ ...deleted }, { year_enc: null, interests_enc: null, bio_enc: null });
});
