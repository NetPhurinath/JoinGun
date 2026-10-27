import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixture, TEST_CONFIG } from './helpers.js';
import { runMinuteJobs, runBackup, runMaintenance } from '../maintenance.js';
import { loadConfig } from '../config.js';

const future = (hours = 24) => new Date(Date.now() + hours * 3_600_000).toISOString();
const activity = (extra = {}, hours = 24) => ({
  type: 'activity', content: 'Come along', locationConsent: true,
  activity: { title: 'Badminton', startsAt: future(hours), location: 'Sports hall', capacity: 6, category: 'sport', ...extra },
});
const count = (store, sql, ...args) => store.db.prepare(sql).get(...args).n;
const body = async response => response.json();

test('friend requests: send, accept, list, remove; each step is logged and notified', async t => {
  const f = await fixture(t);
  const other = await f.signUp('b@mfu.ac.th', 'bbb_1');
  const target = await body(await f.json('/api/users/bbb_1', 'GET', undefined, f.cookie));
  assert.equal(target.relation, 'none');

  const sent = await f.json('/api/friends/requests', 'POST', { userId: target.id }, f.cookie);
  assert.equal(sent.status, 201);
  const { requestId } = await body(sent);
  assert.equal((await body(await f.json('/api/users/bbb_1', 'GET', undefined, f.cookie))).relation, 'outgoing');
  assert.equal((await body(await f.json('/api/notifications/unread-count', 'GET', undefined, other))).unread, 1);
  const incoming = await body(await f.json('/api/friends', 'GET', undefined, other));
  assert.equal(incoming.incoming.length, 1);

  assert.equal((await f.json(`/api/friends/requests/${requestId}/accept`, 'POST', {}, f.cookie)).status, 404, 'only the addressee accepts');
  assert.equal((await f.json(`/api/friends/requests/${requestId}/accept`, 'POST', {}, other)).status, 200);
  const mine = await body(await f.json('/api/friends', 'GET', undefined, f.cookie));
  assert.deepEqual(mine.items.map(u => u.username), ['bbb_1']);
  assert.equal(count(f.store, "SELECT count(*) AS n FROM action_logs WHERE action IN ('friend.request','friend.accept') AND ip_address != ''"), 2);
  const notes = await body(await f.json('/api/notifications', 'GET', undefined, f.cookie));
  assert.equal(notes.items[0].type, 'friend.accept');
  assert.equal(notes.items[0].actor.username, 'bbb_1');

  assert.equal((await f.json(`/api/friends/${target.id}`, 'DELETE', undefined, f.cookie)).status, 200);
  assert.equal((await body(await f.json('/api/friends', 'GET', undefined, other))).items.length, 0);
  assert.equal((await f.json('/api/friends/requests', 'POST', { userId: target.id, extra: 1 }, f.cookie)).status, 400);
});

test('a block ends the friendship and stops new requests from the blocked person', async t => {
  const f = await fixture(t);
  const other = await f.signUp('b@mfu.ac.th', 'bbb_1');
  const me = await body(await f.json('/api/me', 'GET', undefined, f.cookie));
  const them = await body(await f.json('/api/me', 'GET', undefined, other));
  const { requestId } = await body(await f.json('/api/friends/requests', 'POST', { userId: them.id }, f.cookie));
  await f.json(`/api/friends/requests/${requestId}/accept`, 'POST', {}, other);
  assert.equal((await f.json('/api/me/blocks', 'POST', { userId: them.id }, f.cookie)).status, 204);
  assert.equal((await body(await f.json('/api/friends', 'GET', undefined, f.cookie))).items.length, 0);
  const refused = await f.json('/api/friends/requests', 'POST', { userId: me.id }, other);
  assert.equal(refused.status, 409);
  assert.equal((await body(refused)).code, 'unavailable');
});

test('activity history follows the owner privacy setting (F5)', async t => {
  const f = await fixture(t);
  const created = await body(await f.post(activity()));
  const friend = await f.signUp('fr@mfu.ac.th', 'friend_1');
  const stranger = await f.signUp('st@mfu.ac.th', 'stranger_1');
  const friendId = (await body(await f.json('/api/me', 'GET', undefined, friend))).id;
  const { requestId } = await body(await f.json('/api/friends/requests', 'POST', { userId: friendId }, f.cookie));
  await f.json(`/api/friends/requests/${requestId}/accept`, 'POST', {}, friend);

  const history = cookie => f.json('/api/users/student_1/history', 'GET', undefined, cookie);
  assert.equal((await history(friend)).status, 403, 'default: only me');
  assert.equal((await history(stranger)).status, 403);
  assert.equal((await body(await history(f.cookie))).items[0].id, created.id);
  assert.equal((await f.json('/api/me/privacy', 'PUT', { historyVisibility: 'friends' }, f.cookie)).status, 200);
  assert.equal((await history(friend)).status, 200);
  assert.equal((await history(stranger)).status, 403);
  assert.equal((await f.json('/api/me/privacy', 'PUT', { historyVisibility: 'private' }, f.cookie)).status, 200);
  assert.equal((await history(friend)).status, 403);
  await f.json('/api/me/privacy', 'PUT', { historyVisibility: 'public' }, f.cookie);
  assert.equal((await history(stranger)).status, 200);
  assert.equal((await f.json('/api/me/privacy', 'PUT', { historyVisibility: 'everyone' }, f.cookie)).status, 400);
  assert.equal((await fetch(`${f.url}/api/users/student_1/history`)).status, 401, 'signed out never sees it');
});

test('friends feed and profile posts', async t => {
  const f = await fixture(t);
  const friend = await f.signUp('fr@mfu.ac.th', 'friend_1');
  await f.post({ type: 'text', content: 'from a stranger' }, await f.signUp('st@mfu.ac.th', 'stranger_1'));
  await f.post({ type: 'text', content: 'from a friend' }, friend);
  const friendId = (await body(await f.json('/api/me', 'GET', undefined, friend))).id;
  const { requestId } = await body(await f.json('/api/friends/requests', 'POST', { userId: friendId }, f.cookie));
  await f.json(`/api/friends/requests/${requestId}/accept`, 'POST', {}, friend);
  const feed = await body(await f.json('/api/posts?scope=friends', 'GET', undefined, f.cookie));
  assert.deepEqual(feed.items.map(p => p.content), ['from a friend']);
  assert.equal((await fetch(`${f.url}/api/posts?scope=friends`)).status, 401);
  const posts = await body(await fetch(`${f.url}/api/users/friend_1/posts`));
  assert.deepEqual(posts.items.map(p => p.content), ['from a friend']);
});

test('joining notifies the host; editing and cancelling notify members', async t => {
  const f = await fixture(t);
  const created = await body(await f.post(activity()));
  const member = await f.signUp('m@mfu.ac.th', 'member_1');
  await f.json(`/api/activities/${created.id}/join`, 'POST', { participationConsent: true }, member);
  let notes = await body(await f.json('/api/notifications', 'GET', undefined, f.cookie));
  assert.equal(notes.items[0].type, 'activity.join');
  assert.equal(notes.items[0].activityTitle, 'Badminton');
  await f.json(`/api/posts/${created.id}`, 'PUT', activity({ title: 'Badminton 2' }), f.cookie);
  await f.json(`/api/posts/${created.id}`, 'DELETE', undefined, f.cookie);
  notes = await body(await f.json('/api/notifications', 'GET', undefined, member));
  assert.deepEqual(notes.items.map(n => n.type), ['activity.cancelled', 'activity.updated']);
  assert.equal(notes.unread, 2);
  assert.equal((await body(await f.json('/api/notifications/read', 'POST', { all: true }, member))).unread, 0);
});

test('reminders follow each person settings, are sent once, and completed activities are logged', async t => {
  const f = await fixture(t);
  const soon = await body(await f.post(activity({}, 0.5))); // starts in 30 minutes
  const member = await f.signUp('m@mfu.ac.th', 'member_1');
  await f.json(`/api/activities/${soon.id}/join`, 'POST', { participationConsent: true }, member);
  assert.equal((await f.json('/api/me/notification-settings', 'PUT', { reminders: false }, member)).status, 200);
  assert.equal((await f.json('/api/me/notification-settings', 'PUT', { reminderMinutes: 7 }, member)).status, 400);

  const sent = [];
  const mailer = { async send(message) { sent.push(message); } };
  const notifier = (await import('../notifications.js')).createNotifier(f.store.db);
  const security = (await import('../security.js')).createSecurity(f.config.secret);
  await f.json('/api/me/notification-settings', 'PUT', { email: true }, f.cookie);
  let result = await runMinuteJobs(f.store.db, { notifier, mailer, security });
  assert.equal(result.reminders, 1, 'host only: the member turned reminders off');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'student@lamduan.mfu.ac.th');
  result = await runMinuteJobs(f.store.db, { notifier, mailer, security });
  assert.equal(result.reminders, 0, 'once per activity');

  f.store.db.prepare("UPDATE activities SET starts_at = '2000-01-01T00:00:00.000Z' WHERE post_id = ?").run(soon.id);
  result = await runMinuteJobs(f.store.db, { notifier });
  assert.equal(result.completed, 1);
  assert.equal(count(f.store, "SELECT count(*) AS n FROM action_logs WHERE action = 'activity.complete'"), 1);
  assert.ok((await body(await f.json(`/api/posts/${soon.id}`, 'GET', undefined, f.cookie))).activity.completedAt);
});

test('recommendations need their own consent, explain every factor, and accept feedback', async t => {
  const f = await fixture(t); // student_1 is interested in sport
  const host = await f.signUp('h@mfu.ac.th', 'host_1');
  const sport = await body(await f.post(activity({ title: 'Futsal' }), host));
  await f.post(activity({ title: 'Reading', category: 'study' }), host);

  assert.deepEqual(await body(await f.json('/api/recommendations', 'GET', undefined, f.cookie)), { consent: false, items: [] });
  assert.equal((await f.json('/api/me/consents/ai', 'POST', { accept: true }, f.cookie)).status, 400, 'limitations must be acknowledged');
  assert.equal((await f.json('/api/me/consents/ai', 'POST', { accept: true, acknowledgeLimitations: true }, f.cookie)).status, 200);
  assert.equal(count(f.store, "SELECT count(*) AS n FROM user_consents WHERE purpose = 'ai-recommendation' AND ip_address != ''"), 1);

  const recs = await body(await f.json('/api/recommendations', 'GET', undefined, f.cookie));
  assert.equal(recs.consent, true);
  assert.ok(recs.disclaimer);
  assert.deepEqual(recs.items.map(i => i.post.activity.title), ['Futsal'], 'only the category the person chose');
  assert.ok(recs.items[0].factors.some(f2 => f2.key === 'interest' && f2.label.includes('กีฬา')));

  assert.equal((await f.json('/api/recommendations/feedback', 'POST', { postId: sport.id, kind: 'dismiss' }, f.cookie)).status, 201);
  assert.equal((await body(await f.json('/api/recommendations', 'GET', undefined, f.cookie))).items.length, 0);
  assert.equal((await f.json('/api/recommendations/feedback', 'POST', { kind: 'review-request' }, f.cookie)).status, 400, 'needs details');
  assert.equal((await f.json('/api/recommendations/feedback', 'POST', { kind: 'review-request', details: 'Why always sport?' }, f.cookie)).status, 201);

  assert.equal((await f.json('/api/me/consents/ai/withdraw', 'POST', {}, f.cookie)).status, 200);
  assert.equal((await body(await f.json('/api/recommendations', 'GET', undefined, f.cookie))).consent, false);
});

test('moderators review reports, suspend with a reason, and lift a suspension on appeal', async t => {
  const config = loadConfig({ APP_SECRET: 't'.repeat(48), MODERATOR_EMAILS: 'mod@mfu.ac.th' });
  const f = await fixture(t, { config });
  const bad = await f.signUp('bad@mfu.ac.th', 'bad_1');
  const modCookie = await f.signUp('mod@mfu.ac.th', 'mod_1');
  const post = await body(await f.post({ type: 'text', content: 'spam spam' }, bad));
  await f.json('/api/reports', 'POST', { postId: post.id, reason: 'spam' }, f.cookie);

  assert.equal((await f.json('/api/mod/reports', 'GET', undefined, f.cookie)).status, 403, 'not a moderator');
  const { items } = await body(await f.json('/api/mod/reports', 'GET', undefined, modCookie));
  assert.equal(items.length, 1);
  assert.equal((await f.json(`/api/mod/reports/${items[0].id}/review`, 'POST', { action: 'suspend-user' }, modCookie)).status, 400, 'a reason is required');
  assert.equal((await f.json(`/api/mod/reports/${items[0].id}/review`, 'POST', { action: 'suspend-user', note: 'Repeated spam' }, modCookie)).status, 200);
  assert.equal((await body(await f.json('/api/mod/reports', 'GET', undefined, modCookie))).items.length, 0, 'no open reports left');

  const me = await body(await f.json('/api/me', 'GET', undefined, bad));
  assert.equal(me.suspended.reason, 'Repeated spam');
  assert.equal((await f.post({ type: 'text', content: 'more' }, bad)).status, 403);
  assert.equal((await f.json('/api/me/appeal', 'POST', { message: 'It was a mistake' }, bad)).status, 201);
  const appeals = await body(await f.json('/api/mod/appeals', 'GET', undefined, modCookie));
  assert.equal((await f.json(`/api/mod/appeals/${appeals.items[0].id}/resolve`, 'POST', { outcome: 'lifted', note: 'OK' }, modCookie)).status, 200);
  assert.equal((await f.post({ type: 'text', content: 'back' }, bad)).status, 201);
  assert.ok(count(f.store, "SELECT count(*) AS n FROM action_logs WHERE action IN ('report.suspend-user','user.suspend','appeal.lifted')") >= 3);
  const reporterNotes = await body(await f.json('/api/notifications', 'GET', undefined, f.cookie));
  assert.equal(reporterNotes.items[0].type, 'report.reviewed');
});

test('account deletion ends friendships, and the purge removes them', async t => {
  const f = await fixture(t);
  const other = await f.signUp('b@mfu.ac.th', 'bbb_1');
  const otherId = (await body(await f.json('/api/me', 'GET', undefined, other))).id;
  const { requestId } = await body(await f.json('/api/friends/requests', 'POST', { userId: otherId }, f.cookie));
  await f.json(`/api/friends/requests/${requestId}/accept`, 'POST', {}, other);
  await f.json('/api/me/delete', 'POST', { confirmUsername: 'bbb_1' }, other);
  assert.equal((await body(await f.json('/api/friends', 'GET', undefined, f.cookie))).items.length, 0);
  runMaintenance(f.store.db, new Date(Date.now() + 91 * 86_400_000));
  assert.equal(count(f.store, 'SELECT count(*) AS n FROM friendships'), 0);
});

test('security headers are set and backups rotate', async t => {
  const f = await fixture(t);
  const response = await fetch(`${f.url}/`);
  for (const header of ['content-security-policy', 'x-frame-options', 'permissions-policy', 'cross-origin-opener-policy']) assert.ok(response.headers.get(header), header);
  assert.equal(response.headers.get('strict-transport-security'), null, 'HSTS only in production');

  const dir = mkdtempSync(join(tmpdir(), 'joingun-backup-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const day = 86_400_000, start = Date.now();
  for (let i = 0; i < 4; i++) runBackup(f.store.db, dir, 2, new Date(start + i * day));
  assert.equal(readdirSync(dir).length, 2, 'keeps the last two days');
  assert.equal(runBackup(f.store.db, '', 7), null, 'off without a folder');
  assert.throws(() => loadConfig({ APP_SECRET: 't'.repeat(48), BACKUP_KEEP_DAYS: 'x' }));
  assert.ok(TEST_CONFIG().backupKeepDays === 7);
});

test('the Android app user agent gets a CSP that allows the inline native bridge; browsers keep the strict one', async t => {
  const f = await fixture(t);
  const browser = (await fetch(`${f.url}/`)).headers.get('content-security-policy');
  const app = (await fetch(`${f.url}/`, { headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 15) Chrome/130 JoinGunApp' } })).headers.get('content-security-policy');
  assert.match(browser, /script-src 'self' https:\/\/unpkg\.com;/);
  assert.match(app, /script-src 'self' 'unsafe-inline'/);
});
