import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, TEST_CONFIG } from './helpers.js';
import { runMaintenance } from '../maintenance.js';

const future = (days = 1) => new Date(Date.now() + days * 86_400_000).toISOString();
const activityBody = (capacity = 4, extra = {}) => ({
  type: 'activity', content: 'Badminton after class', locationConsent: true,
  activity: { title: 'Badminton', startsAt: future(), location: 'Sports hall', capacity, ...extra },
});
const count = (store, sql, ...args) => store.db.prepare(sql).get(...args).n;
let hasZip = true;
try { await import('@zip.js/zip.js'); } catch { hasZip = false; }

test('authors can edit their posts; the edit is logged and the meeting-place consent is asked again', async t => {
  const f = await fixture(t);
  const created = await (await f.post(activityBody(3))).json();
  const edit = body => f.json(`/api/posts/${created.id}`, 'PUT', body, f.cookie);

  const updated = await edit(activityBody(5, { title: 'Badminton (court 2)' }));
  assert.equal(updated.status, 200);
  const saved = await updated.json();
  assert.equal(saved.activity.title, 'Badminton (court 2)');
  assert.equal(saved.activity.capacity, 5);
  assert.ok(saved.updatedAt);
  assert.equal(count(f.store, "SELECT count(*) AS n FROM audit_logs WHERE action = 'post.update'"), 1);
  assert.equal(count(f.store, 'SELECT count(*) AS n FROM consent_records WHERE post_id = ?', created.id), 2);

  assert.equal((await edit({ type: 'text', content: 'now text' })).status, 400, 'type cannot change');
  assert.equal((await edit({ ...activityBody(3), locationConsent: false })).status, 400, 'location consent needed again');

  f.store.db.prepare("UPDATE activities SET starts_at = '2000-01-01T00:00:00.000Z' WHERE post_id = ?").run(created.id);
  const late = await edit(activityBody(4));
  assert.equal(late.status, 409);
  assert.equal((await late.json()).code, 'started');
});

test('editing: other people cannot edit, and capacity cannot go below the people already in', async t => {
  const f = await fixture(t);
  const created = await (await f.post(activityBody(4))).json();
  const a = await f.signUp('a@mfu.ac.th', 'aaa_1');
  const b = await f.signUp('b@mfu.ac.th', 'bbb_1');
  for (const c of [a, b]) await f.json(`/api/activities/${created.id}/join`, 'POST', { participationConsent: true }, c);
  assert.equal((await f.json(`/api/posts/${created.id}`, 'PUT', activityBody(4), a)).status, 403);
  const shrink = await f.json(`/api/posts/${created.id}`, 'PUT', activityBody(2), f.cookie);
  assert.equal(shrink.status, 409); assert.equal((await shrink.json()).code, 'capacity-below-joined');
});

test('deleting a post hides it; a cancelled activity stays visible to its members but cannot be joined', async t => {
  const f = await fixture(t);
  const created = await (await f.post(activityBody(4))).json();
  const member = await f.signUp('mem@mfu.ac.th', 'mem_1');
  const outsider = await f.signUp('out@mfu.ac.th', 'out_1');
  await f.json(`/api/activities/${created.id}/join`, 'POST', { participationConsent: true }, member);
  assert.equal((await f.json(`/api/posts/${created.id}`, 'DELETE', undefined, member)).status, 403, 'only the author');
  assert.equal((await f.json(`/api/posts/${created.id}`, 'DELETE', undefined, f.cookie)).status, 204);
  assert.equal(count(f.store, "SELECT count(*) AS n FROM audit_logs WHERE action = 'post.delete'"), 1);
  assert.equal((await (await fetch(`${f.url}/api/posts`)).json()).total, 0);
  assert.equal((await f.json(`/api/posts/${created.id}`, 'GET', undefined, outsider)).status, 404);
  const seen = await (await f.json(`/api/posts/${created.id}`, 'GET', undefined, member)).json();
  assert.ok(seen.deletedAt, 'members see it as cancelled');
  assert.equal((await f.json(`/api/activities/${created.id}/join`, 'POST', { participationConsent: true }, outsider)).status, 404);
  assert.equal((await f.json(`/api/posts/${created.id}`, 'DELETE', undefined, f.cookie)).status, 404, 'already deleted');
});

test('reports are stored with reporter, reported user, reason and time; bad reports are refused', async t => {
  const f = await fixture(t);
  const created = await (await f.post({ type: 'text', content: 'spam spam' })).json();
  const reporter = await f.signUp('rep@mfu.ac.th', 'reporter_1');
  const send = (body, cookie = reporter) => f.json('/api/reports', 'POST', body, cookie);
  assert.equal((await send({ postId: created.id, reason: 'spam', details: '  ขายของ  ' })).status, 201);
  const row = f.store.db.prepare('SELECT * FROM reports').get();
  const author = f.store.db.prepare("SELECT id FROM users WHERE username = 'student_1'").get().id;
  assert.equal(row.reported_user_id, author); assert.equal(row.post_id, created.id); assert.equal(row.reason, 'spam');
  assert.equal(row.details, 'ขายของ'); assert.equal(row.ip_address, '127.0.0.1'); assert.match(row.created_at, /Z$/);
  for (const bad of [{ postId: created.id, reason: 'boring' }, { postId: created.id, reason: 'other', details: 'x'.repeat(1001) }, { postId: 'nope', reason: 'spam' }, { postId: created.id, reason: 'spam', userId: 'x' }]) {
    assert.notEqual((await send(bad)).status, 201, JSON.stringify(bad).slice(0, 60));
  }
  assert.equal((await send({ postId: created.id, reason: 'spam' }, f.cookie)).status, 400, 'cannot report yourself');
  assert.equal((await send({ postId: created.id, reason: 'spam' }, '')).status, 401);
});

test('blocking hides the blocked author from the blocker only, and unblocking keeps the record', async t => {
  const f = await fixture(t);
  const loud = await f.signUp('loud@mfu.ac.th', 'loud_1');
  await f.post({ type: 'text', content: 'from loud' }, loud);
  const loudId = (await (await f.json('/api/me', 'GET', undefined, loud)).json()).id;
  const viewer = await f.signUp('quiet@mfu.ac.th', 'quiet_1');
  const feedFor = async cookie => (await (await f.json('/api/posts', 'GET', undefined, cookie)).json()).items.map(p => p.content);
  assert.deepEqual(await feedFor(viewer), ['from loud']);
  assert.equal((await f.json('/api/me/blocks', 'POST', { userId: loudId }, viewer)).status, 204);
  assert.deepEqual(await feedFor(viewer), []);
  assert.deepEqual(await feedFor(f.cookie), ['from loud'], 'others still see it');
  assert.deepEqual((await (await f.json('/api/me/blocks', 'GET', undefined, viewer)).json()).items.map(b => b.username), ['loud_1']);
  assert.equal((await f.json('/api/me/blocks', 'POST', { userId: (await (await f.json('/api/me', 'GET', undefined, viewer)).json()).id }, viewer)).status, 400, 'not yourself');
  assert.equal((await f.json('/api/me/blocks', 'POST', { userId: 'demo-student' }, viewer)).status, 404);
  assert.equal((await f.json(`/api/me/blocks/${loudId}`, 'DELETE', undefined, viewer)).status, 204);
  assert.deepEqual(await feedFor(viewer), ['from loud']);
  assert.equal(count(f.store, 'SELECT count(*) AS n FROM blocks WHERE removed_at IS NOT NULL'), 1, 'the block record is kept');
});

test('withdrawing the participation consent stops future joins only', async t => {
  const f = await fixture(t);
  const first = await (await f.post(activityBody(4))).json();
  const second = await (await f.post(activityBody(4))).json();
  const member = await f.signUp('w@mfu.ac.th', 'withdraw_1');
  await f.json(`/api/activities/${first.id}/join`, 'POST', { participationConsent: true }, member);
  const withdrawn = await f.json('/api/me/consents/participation/withdraw', 'POST', {}, member);
  assert.equal(withdrawn.status, 200); assert.equal((await withdrawn.json()).active, false);
  assert.equal((await (await f.json('/api/me', 'GET', undefined, member)).json()).participationConsent, false);
  assert.equal((await (await f.json(`/api/posts/${first.id}`, 'GET', undefined, member)).json()).activity.viewerStatus, 'joined', 'current joins stay');
  const blocked = await f.json(`/api/activities/${second.id}/join`, 'POST', {}, member);
  assert.equal((await blocked.json()).code, 'consent-required');
  assert.equal((await f.json('/api/me/consents/participation/withdraw', 'POST', {}, member)).status, 409);
  assert.equal((await f.json(`/api/activities/${second.id}/join`, 'POST', { participationConsent: true }, member)).status, 200, 'consent given again');
  assert.equal(count(f.store, "SELECT count(*) AS n FROM auth_logs WHERE action = 'consent.withdraw'"), 1);
});

test('data download is an AES-encrypted ZIP that opens only with the chosen password', { skip: !hasZip && 'run npm install to add @zip.js/zip.js' }, async t => {
  const zip = await import('@zip.js/zip.js');
  zip.configure({ useWebWorkers: false });
  const f = await fixture(t);
  await f.post(activityBody(4));
  const short = await f.json('/api/me/export', 'POST', { password: 'short' }, f.cookie);
  assert.equal(short.status, 400);
  const response = await f.json('/api/me/export', 'POST', { password: 'correct horse' }, f.cookie);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/zip');
  assert.match(response.headers.get('content-disposition'), /attachment; filename="joingun-my-data-\d{4}-\d{2}-\d{2}\.zip"/);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(Buffer.from(bytes).includes('student@lamduan.mfu.ac.th'), false, 'nothing readable without the password');
  const [entry] = await new zip.ZipReader(new zip.Uint8ArrayReader(bytes)).getEntries();
  assert.equal(entry.encrypted, true);
  await assert.rejects(entry.getData(new zip.TextWriter(), { password: 'wrong password' }));
  const data = JSON.parse(await entry.getData(new zip.TextWriter(), { password: 'correct horse' }));
  assert.equal(data.profile.email, 'student@lamduan.mfu.ac.th');
  assert.equal(data.profile.username, 'student_1');
  assert.equal(data.posts.length, 1);
  assert.equal(data.participation[0].role, 'host');
  assert.equal(data.consents.termsAcceptances.length, 1);
  assert.ok(data.signInLog.some(row => row.action === 'signup'));
  assert.equal(count(f.store, "SELECT count(*) AS n FROM auth_logs WHERE action = 'data.export'"), 1);
});

test('deleting an account hides it at once, archives the email for 90 days, then purges it', async t => {
  const f = await fixture(t, { config: { ...TEST_CONFIG(), resendSeconds: 0 } });
  const leaver = await f.signUp('bye@mfu.ac.th', 'bye_1');
  const hosted = await (await f.post(activityBody(4), leaver)).json();
  const other = await (await f.post(activityBody(4))).json();
  await f.json(`/api/activities/${other.id}/join`, 'POST', { participationConsent: true }, leaver);
  const leaverId = (await (await f.json('/api/me', 'GET', undefined, leaver)).json()).id;

  assert.equal((await f.json('/api/me/delete', 'POST', { confirmUsername: 'wrong' }, leaver)).status, 400);
  const deleted = await f.json('/api/me/delete', 'POST', { confirmUsername: 'BYE_1' }, leaver);
  assert.equal(deleted.status, 200);
  assert.match(deleted.headers.get('set-cookie'), /jg_session=;/);
  assert.equal((await f.json('/api/me', 'GET', undefined, leaver)).status, 401, 'session ended');

  const user = f.store.db.prepare('SELECT * FROM users WHERE id = ?').get(leaverId);
  assert.equal(user.status, 'deleted'); assert.equal(user.display_name, null); assert.equal(user.username, null);
  assert.equal(count(f.store, 'SELECT count(*) AS n FROM user_emails WHERE user_id = ?', leaverId), 0);
  assert.equal(count(f.store, 'SELECT count(*) AS n FROM deleted_accounts WHERE user_id = ?', leaverId), 1, 'archived');
  assert.equal((await f.json(`/api/posts/${hosted.id}`, 'GET', undefined, f.cookie)).status, 404, 'hosted activity cancelled');
  const otherNow = await (await f.json(`/api/posts/${other.id}`, 'GET', undefined, f.cookie)).json();
  assert.equal(otherNow.activity.joinedCount, 1, 'left the activity they joined');
  assert.ok(count(f.store, "SELECT count(*) AS n FROM auth_logs WHERE user_id = ? AND action = 'account.delete'", leaverId) === 1);

  // The same address can start a new account while the old one is archived.
  const again = await f.signUp('bye@mfu.ac.th', 'bye_again');
  assert.notEqual((await (await f.json('/api/me', 'GET', undefined, again)).json()).id, leaverId);

  // 89 days: still archived. 91 days: purged, logs kept but no longer linked to an email.
  runMaintenance(f.store.db, new Date(Date.now() + 89 * 86_400_000));
  assert.equal(count(f.store, 'SELECT count(*) AS n FROM deleted_accounts'), 1);
  const result = runMaintenance(f.store.db, new Date(Date.now() + 91 * 86_400_000));
  assert.equal(result.purgedAccounts, 1);
  assert.equal(count(f.store, 'SELECT count(*) AS n FROM deleted_accounts'), 0);
  assert.equal(count(f.store, 'SELECT count(*) AS n FROM auth_logs WHERE user_id = ? AND email_hash IS NOT NULL', leaverId), 0);
  assert.ok(count(f.store, 'SELECT count(*) AS n FROM auth_logs WHERE user_id = ?', leaverId) > 0, 'log rows themselves are kept');
  assert.equal(f.store.db.prepare('SELECT content FROM posts WHERE id = ?').get(hosted.id).content, '[ลบแล้ว]');
});

test('maintenance removes expired codes and sessions', async t => {
  const f = await fixture(t);
  const result = runMaintenance(f.store.db, new Date(Date.now() + 40 * 86_400_000));
  assert.ok(result.sessions >= 1);
  assert.equal((await f.json('/api/me', 'GET', undefined, f.cookie)).status, 401);
});
