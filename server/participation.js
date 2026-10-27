// Joining and leaving activities (backlog 2.4, user journey steps 3–5).
// rule.md: separate opt-in consent before keeping participation history (LR1), and a log entry with user, time,
// IP and action for every join and leave. User-facing messages are Thai because the web UI shows them as they are.
import { randomUUID } from 'node:crypto';

export const PARTICIPATION_CONSENT = { purpose: 'participation-history', version: 'participation-v1' };

// The consent counts when the latest grant of the current version is newer than the latest withdrawal.
export function consentState(db, userId, { purpose, version }) {
  const { granted } = db.prepare('SELECT max(granted_at) AS granted FROM user_consents WHERE user_id = ? AND purpose = ? AND version = ?')
    .get(userId, purpose, version);
  const { withdrawn } = db.prepare('SELECT max(withdrawn_at) AS withdrawn FROM consent_withdrawals WHERE user_id = ? AND purpose = ?')
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
  // Cancelled (deleted) activities count as not found.
  const activity = id => db.prepare(`SELECT a.post_id, a.starts_at, a.capacity FROM activities a JOIN posts p ON p.id = a.post_id
    WHERE a.post_id = ? AND p.deleted_at IS NULL`).get(id);
  const membership = (id, userId) => db.prepare('SELECT * FROM participants WHERE activity_id = ? AND user_id = ?').get(id, userId);
  const joinedCount = id => db.prepare("SELECT count(*) AS n FROM participants WHERE activity_id = ? AND status = 'joined'").get(id).n;
  const log = (id, userId, action, time, ip) => db.prepare('INSERT INTO audit_logs VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), id, userId, action, time, ip);

  function transaction(work) {
    db.exec('BEGIN IMMEDIATE'); // takes the write lock first, so two joins for the last place cannot both pass the count
    try { const result = work(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }

  const participation = {
    hasConsent: userId => participationConsent(db, userId).active,

    join(activityId, userId, ip, { participationConsent = false } = {}) {
      transaction(() => {
        const found = activity(activityId);
        if (!found) throw new ActivityError(404, 'not-found', 'ไม่พบกิจกรรมนี้');
        const time = now();
        if (found.starts_at <= time) throw new ActivityError(409, 'started', 'กิจกรรมนี้เริ่มไปแล้ว เข้าร่วมไม่ได้');
        const current = membership(activityId, userId);
        if (current?.status === 'joined') return; // already in: nothing to record
        if (!participation.hasConsent(userId)) {
          if (participationConsent !== true) throw new ActivityError(409, 'consent-required', 'กรุณายินยอมให้เก็บประวัติการเข้าร่วมก่อน');
          db.prepare('INSERT INTO user_consents VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), userId, PARTICIPATION_CONSENT.purpose, PARTICIPATION_CONSENT.version, time, ip);
        }
        if (joinedCount(activityId) >= found.capacity) throw new ActivityError(409, 'full', 'กิจกรรมนี้เต็มแล้ว');
        if (current) db.prepare("UPDATE participants SET status = 'joined', joined_at = ?, left_at = NULL WHERE activity_id = ? AND user_id = ?").run(time, activityId, userId);
        else db.prepare("INSERT INTO participants (activity_id, user_id, role, status, joined_at) VALUES (?, ?, 'member', 'joined', ?)").run(activityId, userId, time);
        log(activityId, userId, 'activity.join', time, ip);
      });
      return store.get(activityId, userId);
    },

    leave(activityId, userId, ip) {
      transaction(() => {
        const found = activity(activityId);
        if (!found) throw new ActivityError(404, 'not-found', 'ไม่พบกิจกรรมนี้');
        const current = membership(activityId, userId);
        if (current?.role === 'host') throw new ActivityError(409, 'host', 'ผู้จัดออกจากกิจกรรมของตัวเองไม่ได้');
        if (current?.status !== 'joined') throw new ActivityError(409, 'not-joined', 'คุณไม่ได้อยู่ในกิจกรรมนี้');
        const time = now();
        if (found.starts_at <= time) throw new ActivityError(409, 'started', 'กิจกรรมเริ่มไปแล้ว ออกจากกิจกรรมไม่ได้');
        db.prepare("UPDATE participants SET status = 'left', left_at = ? WHERE activity_id = ? AND user_id = ?").run(time, activityId, userId);
        log(activityId, userId, 'activity.leave', time, ip);
      });
      return store.get(activityId, userId);
    },

    // Names are shown only to the host and to people who have joined (decision 2026-10-15; F5 privacy).
    participants(activityId, userId) {
      if (!activity(activityId)) throw new ActivityError(404, 'not-found', 'ไม่พบกิจกรรมนี้');
      if (membership(activityId, userId)?.status !== 'joined') throw new ActivityError(403, 'not-member', 'รายชื่อผู้เข้าร่วมเห็นได้เฉพาะผู้จัดและผู้ที่เข้าร่วมแล้ว');
      return db.prepare(`SELECT c.role, c.user_id, u.display_name, u.username FROM participants c LEFT JOIN users u ON u.id = c.user_id
        WHERE c.activity_id = ? AND c.status = 'joined' ORDER BY c.role = 'host' DESC, c.joined_at`).all(activityId)
        .map(row => ({ role: row.role, displayName: row.display_name ?? (row.user_id === 'demo-student' ? 'Demo Student' : 'บัญชีที่ถูกลบ'), username: row.username ?? null }));
    },
  };
  return participation;
}
