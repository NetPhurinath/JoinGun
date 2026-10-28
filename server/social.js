// Profiles, people search and friends (backlog 1.3, 5.1, 5.2) and who may see a person's activity history (F5).
// rule.md: sending and accepting a friend request is logged with user, UTC time, IP and action (action_logs).
import { randomUUID } from 'node:crypto';
import { HttpError } from './errors.js';
import { openProfile } from './profile-crypto.js';

export const HISTORY_VISIBILITY = ['public', 'friends', 'private'];
const now = () => new Date().toISOString();

export function createSocial(db, notifier, security) {
  const log = (userId, action, targetId, ip) =>
    db.prepare('INSERT INTO action_logs VALUES (?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), userId, action, 'user', targetId, now(), ip);
  const activeUser = id => db.prepare("SELECT * FROM users WHERE id = ? AND status = 'active'").get(id);
  const byUsername = async username => typeof username === 'string' ? db.prepare("SELECT * FROM users WHERE username = ? AND status = 'active'").get(username.toLowerCase()) : null;
  const blocked = async (blocker, blockedId) => Boolean(await db.prepare('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ? AND removed_at IS NULL').get(blocker, blockedId));
  const openRequest = (a, b) => db.prepare(`SELECT * FROM friendships WHERE status IN ('pending','accepted')
    AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)) ORDER BY created_at DESC LIMIT 1`).get(a, b, b, a);
  const friendIds = async userId => (await db.prepare(`SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END AS id FROM friendships
    WHERE status = 'accepted' AND (requester_id = ? OR addressee_id = ?)`).all(userId, userId, userId)).map(row => row.id);

  // 'self' | 'friends' | 'outgoing' | 'incoming' | 'none' as seen by the viewer.
  async function relation(viewerId, otherId) {
    if (!viewerId) return 'none';
    if (viewerId === otherId) return 'self';
    const row = await openRequest(viewerId, otherId);
    if (!row) return 'none';
    if (row.status === 'accepted') return 'friends';
    return row.requester_id === viewerId ? 'outgoing' : 'incoming';
  }

  const profileOf = row => openProfile(security, row);
  const card = row => { const p = profileOf(row); return { id: row.id, displayName: row.display_name, username: row.username, year: p.year, interests: p.interests }; };

  const social = {
    relation,
    friendIds,
    interestsOf: async userId => profileOf(await db.prepare('SELECT * FROM users WHERE id = ?').get(userId)).interests,

    async profile(username, viewerId) {
      const user = await byUsername(username);
      if (!user) throw new HttpError(404, 'not-found', 'ไม่พบผู้ใช้นี้');
      const rel = await relation(viewerId, user.id);
      const count = async (sql, ...args) => (await db.prepare(sql).get(...args)).n;
      // Year and interests are shown only to signed-in students, not to anonymous visitors.
      const shown = viewerId ? card(user) : { ...card(user), year: null, interests: [] };
      return {
        ...shown, bio: profileOf(user).bio, createdAt: user.created_at, relation: rel,
        requestId: ['incoming', 'outgoing'].includes(rel) ? (await openRequest(viewerId, user.id)).id : null,
        blockedByMe: viewerId ? await blocked(viewerId, user.id) : false,
        historyVisibility: rel === 'self' ? user.history_visibility : undefined,
        historyVisible: await social.canSeeHistory(user, viewerId),
        stats: {
          friends: await count(`SELECT count(*) AS n FROM friendships WHERE status = 'accepted' AND (requester_id = ? OR addressee_id = ?)`, user.id, user.id),
          hosted: await count(`SELECT count(*) AS n FROM posts p JOIN activities a ON a.post_id = p.id WHERE p.author_id = ? AND p.deleted_at IS NULL`, user.id),
          joined: await count(`SELECT count(*) AS n FROM participants c JOIN posts p ON p.id = c.activity_id WHERE c.user_id = ? AND c.role = 'member' AND c.status = 'joined' AND p.deleted_at IS NULL`, user.id),
        },
      };
    },

    async canSeeHistory(user, viewerId) {
      if (!viewerId) return false;
      if (viewerId === user.id) return true;
      if (user.history_visibility === 'public') return true;
      if (user.history_visibility === 'friends') return (await relation(viewerId, user.id)) === 'friends';
      return false;
    },

    // Activities the person joined (as host or member), newest first, if the viewer may see them.
    async history(username, viewerId) {
      const user = await byUsername(username);
      if (!user) throw new HttpError(404, 'not-found', 'ไม่พบผู้ใช้นี้');
      if (!(await social.canSeeHistory(user, viewerId))) throw new HttpError(403, 'history-hidden', 'ผู้ใช้นี้ไม่ได้เปิดให้คุณเห็นประวัติการเข้าร่วม');
      return (await db.prepare(`SELECT c.activity_id AS id, c.role, a.title, a.category, a.starts_at, a.location, a.completed_at
        FROM participants c JOIN activities a ON a.post_id = c.activity_id JOIN posts p ON p.id = a.post_id
        WHERE c.user_id = ? AND c.status = 'joined' AND p.deleted_at IS NULL ORDER BY a.starts_at DESC LIMIT 100`).all(user.id))
        .map(row => ({ id: row.id, role: row.role, title: row.title, category: row.category, startsAt: row.starts_at, location: row.location, completedAt: row.completed_at }));
    },

    async setHistoryVisibility(userId, value) {
      if (!HISTORY_VISIBILITY.includes(value)) throw new HttpError(400, 'visibility', 'ตัวเลือกความเป็นส่วนตัวไม่ถูกต้อง');
      await db.prepare('UPDATE users SET history_visibility = ?, updated_at = ? WHERE id = ?').run(value, now(), userId);
      return { historyVisibility: value };
    },

    // People search by username or display name (for adding friends). Active accounts only; no email is searchable.
    async search(q, viewerId) {
      const term = typeof q === 'string' ? q.trim().toLowerCase().replace(/^@/, '') : '';
      if (term.length < 1 || term.length > 50) return [];
      const pattern = `%${term.replace(/[\\%_]/g, char => `\\${char}`)}%`;
      const rows = await db.prepare(`SELECT * FROM users WHERE status = 'active' AND username IS NOT NULL AND id != ?
          AND (username LIKE ? ESCAPE '\\' OR lower(display_name) LIKE ? ESCAPE '\\') ORDER BY username = ? DESC, username LIMIT 20`)
        .all(viewerId ?? '', pattern, pattern, term);
      const items = [];
      for (const row of rows) items.push({ ...card(row), relation: await relation(viewerId, row.id) });
      return items;
    },

    async friends(userId) {
      return (await db.prepare(`SELECT u.*, f.responded_at FROM friendships f JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
        WHERE f.status = 'accepted' AND (f.requester_id = ? OR f.addressee_id = ?) AND u.status = 'active' ORDER BY u.display_name`)
        .all(userId, userId, userId)).map(row => ({ ...card(row), since: row.responded_at }));
    },

    async requests(userId) {
      const list = async sql => (await db.prepare(sql).all(userId)).map(row => ({ id: row.request_id, createdAt: row.created_at, user: card(row) }));
      return {
        incoming: await list(`SELECT u.*, f.id AS request_id, f.created_at FROM friendships f JOIN users u ON u.id = f.requester_id
          WHERE f.addressee_id = ? AND f.status = 'pending' AND u.status = 'active' ORDER BY f.created_at DESC`),
        outgoing: await list(`SELECT u.*, f.id AS request_id, f.created_at FROM friendships f JOIN users u ON u.id = f.addressee_id
          WHERE f.requester_id = ? AND f.status = 'pending' AND u.status = 'active' ORDER BY f.created_at DESC`),
      };
    },

    async request(fromId, toId, ip) {
      if (typeof toId !== 'string' || !(await activeUser(toId))) throw new HttpError(404, 'not-found', 'ไม่พบผู้ใช้นี้');
      if (toId === fromId) throw new HttpError(400, 'self', 'ส่งคำขอถึงตัวเองไม่ได้');
      if (await blocked(fromId, toId)) throw new HttpError(409, 'blocked', 'คุณบล็อกผู้ใช้นี้อยู่ เลิกบล็อกก่อนจึงจะส่งคำขอได้');
      // The other person blocked the sender: refuse without saying so.
      if (await blocked(toId, fromId)) throw new HttpError(409, 'unavailable', 'ส่งคำขอเป็นเพื่อนถึงผู้ใช้นี้ไม่ได้');
      const existing = await openRequest(fromId, toId);
      if (existing?.status === 'accepted') return { status: 'friends' };
      if (existing && existing.requester_id === fromId) return { status: 'outgoing', requestId: existing.id };
      // They already asked us: sending back counts as accepting.
      if (existing) return social.respond(fromId, existing.id, true, ip);
      const id = randomUUID();
      await db.prepare("INSERT INTO friendships (id, requester_id, addressee_id, status, created_at, ip_address) VALUES (?, ?, ?, 'pending', ?, ?)").run(id, fromId, toId, now(), ip);
      await log(fromId, 'friend.request', toId, ip);
      await notifier.notify({ userId: toId, type: 'friend.request', actorId: fromId });
      return { status: 'outgoing', requestId: id };
    },

    async respond(userId, requestId, accept, ip) {
      const row = await db.prepare("SELECT * FROM friendships WHERE id = ? AND addressee_id = ? AND status = 'pending'").get(requestId, userId);
      if (!row) throw new HttpError(404, 'not-found', 'ไม่พบคำขอเป็นเพื่อนนี้');
      await db.prepare('UPDATE friendships SET status = ?, responded_at = ? WHERE id = ?').run(accept ? 'accepted' : 'declined', now(), requestId);
      await log(userId, accept ? 'friend.accept' : 'friend.decline', row.requester_id, ip);
      if (accept) await notifier.notify({ userId: row.requester_id, type: 'friend.accept', actorId: userId });
      return { status: accept ? 'friends' : 'none' };
    },

    async cancel(userId, requestId, ip) {
      const row = await db.prepare("SELECT * FROM friendships WHERE id = ? AND requester_id = ? AND status = 'pending'").get(requestId, userId);
      if (!row) throw new HttpError(404, 'not-found', 'ไม่พบคำขอเป็นเพื่อนนี้');
      await db.prepare("UPDATE friendships SET status = 'cancelled', ended_at = ? WHERE id = ?").run(now(), requestId);
      await log(userId, 'friend.cancel', row.addressee_id, ip);
      return { status: 'none' };
    },

    async remove(userId, friendId, ip) {
      const row = await openRequest(userId, friendId);
      if (row?.status !== 'accepted') throw new HttpError(404, 'not-friends', 'คุณไม่ได้เป็นเพื่อนกับผู้ใช้นี้');
      await db.prepare("UPDATE friendships SET status = 'removed', ended_at = ? WHERE id = ?").run(now(), row.id);
      await log(userId, 'friend.remove', friendId, ip);
      return { status: 'none' };
    },

    // Blocking someone also ends a friendship or pending request between the two.
    async endAll(userId, otherId, ip) {
      const row = await openRequest(userId, otherId);
      if (!row) return;
      await db.prepare('UPDATE friendships SET status = ?, ended_at = ? WHERE id = ?').run(row.status === 'accepted' ? 'removed' : 'cancelled', now(), row.id);
      await log(userId, row.status === 'accepted' ? 'friend.remove' : 'friend.cancel', otherId, ip);
    },

    // "People you may know": friends of friends and people from the same activities, then shared interests.
    // Only existing connections and interests the person entered are used; no year, faculty or other trait.
    async suggestions(userId, limit = 5) {
      const me = await activeUser(userId);
      if (!me) return [];
      const ids = async (sql, ...args) => (await db.prepare(sql).all(...args)).map(r => r.id);
      const excluded = new Set([userId,
        ...await ids(`SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END AS id FROM friendships
          WHERE status IN ('pending','accepted') AND (requester_id = ? OR addressee_id = ?)`, userId, userId, userId),
        ...await ids('SELECT blocked_id AS id FROM blocks WHERE blocker_id = ? AND removed_at IS NULL', userId),
        ...await ids('SELECT blocker_id AS id FROM blocks WHERE blocked_id = ? AND removed_at IS NULL', userId)]);
      const scores = new Map();
      const add = (id, points, reason) => {
        if (excluded.has(id)) return;
        const entry = scores.get(id) || { points: 0, reasons: new Set() };
        entry.points += points; entry.reasons.add(reason); scores.set(id, entry);
      };
      const mine = await friendIds(userId);
      for (const friend of mine) for (const id of await friendIds(friend)) add(id, 3, 'mutual');
      for (const { user_id: id } of await db.prepare(`SELECT DISTINCT o.user_id FROM participants c JOIN participants o ON o.activity_id = c.activity_id
        WHERE c.user_id = ? AND c.status = 'joined' AND o.status = 'joined' AND o.user_id != ?`).all(userId, userId)) add(id, 2, 'activity');
      const interests = profileOf(me).interests;
      if (interests.length) {
        for (const row of await db.prepare("SELECT * FROM users WHERE status = 'active' AND username IS NOT NULL AND id != ? ORDER BY created_at DESC LIMIT 200").all(userId)) {
          if (profileOf(row).interests.some(item => interests.includes(item))) add(row.id, 1, 'interest');
        }
      }
      const ranked = [...scores.entries()].sort((a, b) => b[1].points - a[1].points);
      const result = [];
      for (const [id, entry] of ranked) {
        const row = await activeUser(id);
        if (row?.username) result.push({ ...card(row), reasons: [...entry.reasons] });
        if (result.length >= limit) break;
      }
      return result;
    },
  };
  return social;
}
