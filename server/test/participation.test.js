import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.js';

const activityBody = (capacity = 3) => ({
  type: 'activity', content: 'Badminton after class', locationConsent: true,
  activity: { title: 'Badminton', startsAt: new Date(Date.now() + 86_400_000).toISOString(), location: 'Sports hall', capacity },
});

async function setup(t, capacity) {
  const f = await fixture(t);
  const created = await (await f.post(activityBody(capacity))).json();
  const id = created.id;
  const call = (path, method = 'POST', body, cookie) => f.json(`/api/activities/${id}/${path}`, method, body, cookie);
  return { ...f, id, created, call };
}

test('the host is the first participant and joining needs a one-time participation consent', async t => {
  const { store, json, signUp, id, created, call } = await setup(t, 3);
  assert.equal(created.activity.joinedCount, 1);
  assert.equal(created.activity.viewerStatus, 'host');

  const member = await signUp('member@mfu.ac.th', 'member_1');
  const noConsent = await call('join', 'POST', {}, member);
  assert.equal(noConsent.status, 409);
  assert.equal((await noConsent.json()).code, 'consent-required');
  assert.equal(store.db.prepare("SELECT count(*) AS n FROM participants WHERE status = 'joined'").get().n, 1, 'nothing joined without consent');

  const joined = await call('join', 'POST', { participationConsent: true }, member);
  assert.equal(joined.status, 200);
  const after = await joined.json();
  assert.equal(after.activity.joinedCount, 2);
  assert.equal(after.activity.viewerStatus, 'joined');

  const consent = store.db.prepare('SELECT * FROM user_consents').get();
  assert.equal(consent.purpose, 'participation-history');
  assert.equal(consent.version, 'participation-v1');
  assert.equal(consent.ip_address, '127.0.0.1');
  const me = await (await json('/api/me', 'GET', undefined, member)).json();
  assert.equal(me.participationConsent, true);
  const log = store.db.prepare("SELECT * FROM audit_logs WHERE action = 'activity.join'").get();
  assert.equal(log.post_id, id); assert.equal(log.user_id, me.id); assert.equal(log.ip_address, '127.0.0.1');
  assert.match(log.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

  // Joining again changes nothing and writes no second log entry.
  assert.equal((await call('join', 'POST', {}, member)).status, 200);
  assert.equal(store.db.prepare("SELECT count(*) AS n FROM audit_logs WHERE action = 'activity.join'").get().n, 1);
});

test('capacity counts the host, and two people racing for the last place cannot both get it', async t => {
  const { signUp, call, store, id } = await setup(t, 2);
  const a = await signUp('a@mfu.ac.th', 'racer_a');
  const b = await signUp('b@mfu.ac.th', 'racer_b');
  const [first, second] = await Promise.all([
    call('join', 'POST', { participationConsent: true }, a),
    call('join', 'POST', { participationConsent: true }, b),
  ]);
  assert.deepEqual([first.status, second.status].sort(), [200, 409]);
  const loser = first.status === 409 ? first : second;
  assert.equal((await loser.json()).code, 'full');
  assert.equal(store.db.prepare("SELECT count(*) AS n FROM participants WHERE activity_id = ? AND status = 'joined'").get(id).n, 2);
});

test('members can leave and rejoin without being asked for consent again; the host cannot leave', async t => {
  const { signUp, call, cookie, store } = await setup(t, 3);
  const member = await signUp('leaver@mfu.ac.th', 'leaver_1');
  await call('join', 'POST', { participationConsent: true }, member);
  const left = await call('leave', 'POST', undefined, member);
  assert.equal(left.status, 200);
  const view = await left.json();
  assert.equal(view.activity.joinedCount, 1); assert.equal(view.activity.viewerStatus, null);
  assert.equal(store.db.prepare("SELECT count(*) AS n FROM audit_logs WHERE action = 'activity.leave'").get().n, 1);
  assert.equal((await call('leave', 'POST', undefined, member)).status, 409, 'cannot leave twice');

  assert.equal((await call('join', 'POST', {}, member)).status, 200, 'consent is remembered');
  const host = await call('leave', 'POST', undefined, cookie);
  assert.equal(host.status, 409); assert.equal((await host.json()).code, 'host');
});

test('participant names are visible only to the host and members', async t => {
  const { signUp, call, cookie } = await setup(t, 4);
  const member = await signUp('m@mfu.ac.th', 'member_m');
  const outsider = await signUp('o@mfu.ac.th', 'outsider');
  await call('join', 'POST', { participationConsent: true }, member);
  for (const viewer of [cookie, member]) {
    const list = await (await call('participants', 'GET', undefined, viewer)).json();
    assert.deepEqual(list.items.map(p => [p.role, p.username]), [['host', 'student_1'], ['member', 'member_m']]);
    assert.equal(JSON.stringify(list).includes('@mfu.ac.th'), false, 'no email addresses');
  }
  assert.equal((await call('participants', 'GET', undefined, outsider)).status, 403);
  assert.equal((await call('participants', 'GET')).status, 401);
});

test('started activities, text posts and unknown ids cannot be joined; signed-out users are refused', async t => {
  const { signUp, call, store, id, json, post } = await setup(t, 5);
  const member = await signUp('late@mfu.ac.th', 'late_1');
  assert.equal((await call('join', 'POST', { participationConsent: true })).status, 401);
  assert.equal((await call('join', 'POST', { participationConsent: true, extra: 1 }, member)).status, 400);
  await call('join', 'POST', { participationConsent: true }, member);
  store.db.prepare("UPDATE activities SET starts_at = '2000-01-01T00:00:00.000Z' WHERE post_id = ?").run(id);
  const leave = await call('leave', 'POST', undefined, member);
  assert.equal(leave.status, 409); assert.equal((await leave.json()).code, 'started');
  const other = await signUp('other@mfu.ac.th', 'other_1');
  assert.equal((await (await call('join', 'POST', { participationConsent: true }, other)).json()).code, 'started');

  const text = await (await post({ type: 'text', content: 'hello' })).json();
  assert.equal((await json(`/api/activities/${text.id}/join`, 'POST', {}, member)).status, 404);
  assert.equal((await json('/api/activities/nope/join', 'POST', {}, member)).status, 404);
});

test('the feed shows counts to everyone and the viewer status only to that viewer', async t => {
  const { url, signUp, call, cookie } = await setup(t, 3);
  const member = await signUp('feed@mfu.ac.th', 'feed_1');
  await call('join', 'POST', { participationConsent: true }, member);
  const statusFor = async headers => (await (await fetch(`${url}/api/posts`, { headers })).json()).items[0].activity;
  assert.deepEqual(await statusFor({}), { ...(await statusFor({})), joinedCount: 2, viewerStatus: null });
  assert.equal((await statusFor({ cookie })).viewerStatus, 'host');
  assert.equal((await statusFor({ cookie: member })).viewerStatus, 'joined');
});
