// Joining and leaving activities (backlog 2.4, user journey steps 3–5).
// rule.md: separate opt-in consent before keeping participation history (LR1), and a log entry with user, time,
// IP and action for every join and leave. User-facing messages are Thai because the web UI shows them as they are.
import { randomUUID } from 'node:crypto';

export const PARTICIPATION_CONSENT = { purpose: 'participation-history', version: 'participation-v1' };

// The consent counts when the latest grant of the current version is newer than the latest withdrawal.
export async function consentState(db, userId, { purpose, version }) {
  const { granted } = await db.prepare('SELECT max(granted_at) AS granted FROM user_consents WHERE user_id = ? AND purpose = ? AND version = ?')
    .get(userId, purpose, version);
  const { withdrawn } = await db.prepare('SELECT max(withdrawn_at) AS withdrawn FROM consent_withdrawals WHERE user_id = ? AND purpose = ?')
    .get(userId, purpose);
  return { active: Boolean(granted && (!withdrawn || granted > withdrawn)), grantedAt: granted ?? null, withdrawnAt: withdrawn ?? null };
}
export const participationConsent = (db, userId) => consentState(db, userId, PARTICIPATION_CONSENT);

export class ActivityError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

const now = () => new Date().toISOString();

export function createParticipation(store) {
  const { db } = store;
  // Cancelled (deleted) activities count as not found. `lock` makes the read take a row lock inside a transaction,
  // so two joins for the last place are handled one after the other.
  const activity = (conn, id, lock = false) => conn.prepare(`SELECT a.post_id, a.starts_at, a.capacity FROM activities a JOIN posts p ON p.id = a.post_id
    WHERE a.post_id = ? AND p.deleted_at IS NULL${lock ? ' FOR UPDATE OF a' : ''}`).get(id);
  const membership = (conn, id, userId) => conn.prepare('SELECT * FROM participants WHERE activity_id = ? AND user_id = ?').get(id, userId);
  const joinedCount = async (conn, id) => (await conn.prepare("SELECT count(*) AS n FROM participants WHERE activity_id = ? AND status = 'joined'").get(id)).n;
  const log = (conn, id, userId, action, time, ip) => conn.prepare('INSERT INTO audit_logs VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), id, userId, action, time, ip);

  const participation = {
    async hasConsent(userId) { return (await participationConsent(db, userId)).active; },

    async join(activityId, userId, ip, { participationConsent: consented = false } = {}) {
      await db.transaction(async tx => {
        const found = await activity(tx, activityId, true);
        if (!found) throw new ActivityError(404, 'not-found', 'ไม่พบกิจกรรมนี้');
        const time = now();
        if (found.starts_at <= time) throw new ActivityError(409, 'started', 'กิจกรรมนี้เริ่มไปแล้ว เข้าร่วมไม่ได้');
        const current = await membership(tx, activityId, userId);
        if (current?.status === 'joined') return; // already in: nothing to record
        if (!(await participationConsent(tx, userId)).active) {
          if (consented !== true) throw new ActivityError(409, 'consent-required', 'กรุณายินยอมให้เก็บประวัติการเข้าร่วมก่อน');
          await tx.prepare('INSERT INTO user_consents VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), userId, PARTICIPATION_CONSENT.purpose, PARTICIPATION_CONSENT.version, time, ip);
        }
        if (await joinedCount(tx, activityId) >= found.capacity) throw new ActivityError(409, 'full', 'กิจกรรมนี้เต็มแล้ว');
        if (current) await tx.prepare("UPDATE participants SET status = 'joined', joined_at = ?, left_at = NULL WHERE activity_id = ? AND user_id = ?").run(time, activityId, userId);
        else await tx.prepare("INSERT INTO participants (activity_id, user_id, role, status, joined_at) VALUES (?, ?, 'member', 'joined', ?)").run(activityId, userId, time);
        await log(tx, activityId, userId, 'activity.join', time, ip);
      });
      return store.get(activityId, userId);
    },

    async leave(activityId, userId, ip) {
      await db.transaction(async tx => {
        const found = await activity(tx, activityId, true);
        if (!found) throw new ActivityError(404, 'not-found', 'ไม่พบกิจกรรมนี้');
        const current = await membership(tx, activityId, userId);
        if (current?.role === 'host') throw new ActivityError(409, 'host', 'ผู้จัดออกจากกิจกรรมของตัวเองไม่ได้');
        if (current?.status !== 'joined') throw new ActivityError(409, 'not-joined', 'คุณไม่ได้อยู่ในกิจกรรมนี้');
        const time = now();
        if (found.starts_at <= time) throw new ActivityError(409, 'started', 'กิจกรรมเริ่มไปแล้ว ออกจากกิจกรรมไม่ได้');
        await tx.prepare("UPDATE participants SET status = 'left', left_at = ? WHERE activity_id = ? AND user_id = ?").run(time, activityId, userId);
        await log(tx, activityId, userId, 'activity.leave', time, ip);
      });
      return store.get(activityId, userId);
    },

    // Names are shown only to the host and to people who have joined (decision 2026-10-15; F5 privacy).
    async participants(activityId, userId) {
      if (!(await activity(db, activityId))) throw new ActivityError(404, 'not-found', 'ไม่พบกิจกรรมนี้');
      if ((await membership(db, activityId, userId))?.status !== 'joined') throw new ActivityError(403, 'not-member', 'รายชื่อผู้เข้าร่วมเห็นได้เฉพาะผู้จัดและผู้ที่เข้าร่วมแล้ว');
      return (await db.prepare(`SELECT c.role, c.user_id, u.display_name, u.username FROM participants c LEFT JOIN users u ON u.id = c.user_id
        WHERE c.activity_id = ? AND c.status = 'joined' ORDER BY c.role = 'host' DESC, c.joined_at`).all(activityId))
        .map(row => ({ role: row.role, displayName: row.display_name ?? (row.user_id === 'demo-student' ? 'Demo Student' : 'บัญชีที่ถูกลบ'), username: row.username ?? null }));
    },
  };
  return participation;
}
