// In-app notifications (F4, backlog 4.1–4.2) and activity reminders.
// Types: friend.request, friend.accept, activity.join, activity.leave (to the host), activity.updated,
// activity.cancelled (to members), activity.reminder, report.reviewed (to the reporter), account.suspended,
// account.restored. Notifications hold ids only; names and titles are read when listed, so a deleted account's
// name never reappears.
import { randomUUID } from 'node:crypto';
import { HttpError } from './errors.js';

export const REMINDER_CHOICES = [15, 30, 60, 120, 1440];
const now = () => new Date().toISOString();

export function reminderEmail(title, startsAt, minutes) {
  const time = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(startsAt));
  const lead = minutes >= 1440 ? 'พรุ่งนี้' : `อีกประมาณ ${minutes} นาที`;
  return {
    subject: `JoinGun: “${title}” จะเริ่ม${lead}`,
    text: `กิจกรรม “${title}” ที่คุณเข้าร่วมจะเริ่ม${lead} (${time} น.)\nนัดพบในพื้นที่สาธารณะ และตรวจสอบรายละเอียดในแอปก่อนไป\nปิดการแจ้งเตือนทางอีเมลได้ที่หน้าตั้งค่าใน JoinGun`,
    html: `<p>กิจกรรม <strong>${escape(title)}</strong> ที่คุณเข้าร่วมจะเริ่ม${lead} (${time} น.)</p><p>นัดพบในพื้นที่สาธารณะ และตรวจสอบรายละเอียดในแอปก่อนไป</p><p style="color:#475569">ปิดการแจ้งเตือนทางอีเมลได้ที่หน้าตั้งค่าใน JoinGun</p>`,
  };
}
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createNotifier(db) {
  // `conn` is the database or, inside a transaction, the transaction object (default: the database).
  const insert = (conn, ...values) => conn.prepare('INSERT INTO notifications (id, user_id, type, actor_id, post_id, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING').run(...values);
  const active = (conn, id) => conn.prepare("SELECT 1 FROM users WHERE id = ? AND status = 'active'").get(id);

  const notifier = {
    async notify({ userId, type, actorId = null, postId = null, data = {} }, conn = db) {
      if (!userId || userId === actorId || !(await active(conn, userId))) return;
      await insert(conn, randomUUID(), userId, type, actorId, postId, JSON.stringify(data), now());
    },

    // Everyone currently in an activity except the actor (usually the host).
    async notifyMembers(postId, actorId, type, data = {}, conn = db) {
      const members = await conn.prepare("SELECT user_id FROM participants WHERE activity_id = ? AND status = 'joined'").all(postId);
      for (const { user_id: userId } of members) await notifier.notify({ userId, type, actorId, postId, data }, conn);
    },

    async list(userId, { before = null, limit = 30 } = {}) {
      const rows = await db.prepare(`SELECT n.*, u.display_name AS actor_name, u.username AS actor_username, u.status AS actor_status,
          a.title AS activity_title, a.starts_at, p.deleted_at
        FROM notifications n LEFT JOIN users u ON u.id = n.actor_id LEFT JOIN activities a ON a.post_id = n.post_id LEFT JOIN posts p ON p.id = n.post_id
        WHERE n.user_id = ? AND (?::text IS NULL OR n.created_at < ?::text) ORDER BY n.created_at DESC LIMIT ?`).all(userId, before, before, limit + 1);
      const page = rows.slice(0, limit);
      return {
        items: page.map(row => ({
          id: row.id, type: row.type, createdAt: row.created_at, read: Boolean(row.read_at),
          actor: row.actor_id ? (row.actor_status === 'active' ? { id: row.actor_id, name: row.actor_name, username: row.actor_username } : { id: row.actor_id, name: 'ผู้ใช้ JoinGun', username: null }) : null,
          postId: row.post_id, activityTitle: row.activity_title ?? null, startsAt: row.starts_at ?? null, cancelled: Boolean(row.deleted_at),
          data: JSON.parse(row.data),
        })),
        nextCursor: rows.length > limit ? page.at(-1).created_at : null,
      };
    },

    unreadCount: async userId => (await db.prepare('SELECT count(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').get(userId)).n,

    async markRead(userId, ids) {
      if (ids === 'all') return (await db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(now(), userId)).changes;
      if (!Array.isArray(ids) || ids.length > 100 || ids.some(id => typeof id !== 'string')) throw new HttpError(400, 'bad-request', 'ข้อมูลที่ส่งมาไม่ถูกต้อง');
      const update = db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND id = ? AND read_at IS NULL');
      let sum = 0;
      for (const id of ids) sum += (await update.run(now(), userId, id)).changes;
      return sum;
    },

    async preferences(userId) {
      const row = await db.prepare('SELECT notify_reminders, notify_email, reminder_minutes FROM users WHERE id = ?').get(userId);
      return { reminders: Boolean(row.notify_reminders), email: Boolean(row.notify_email), reminderMinutes: row.reminder_minutes };
    },

    async savePreferences(userId, body) {
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['reminders', 'email', 'reminderMinutes'].includes(k))) {
        throw new HttpError(400, 'bad-request', 'ข้อมูลที่ส่งมาไม่ถูกต้อง');
      }
      const current = await notifier.preferences(userId);
      const next = { ...current, ...body };
      if (typeof next.reminders !== 'boolean' || typeof next.email !== 'boolean') throw new HttpError(400, 'bad-request', 'ค่าการแจ้งเตือนไม่ถูกต้อง');
      if (!REMINDER_CHOICES.includes(next.reminderMinutes)) throw new HttpError(400, 'reminder-minutes', 'เลือกเวลาแจ้งเตือนจากตัวเลือกที่มี');
      await db.prepare('UPDATE users SET notify_reminders = ?, notify_email = ?, reminder_minutes = ?, updated_at = ? WHERE id = ?')
        .run(next.reminders ? 1 : 0, next.email ? 1 : 0, next.reminderMinutes, now(), userId);
      return notifier.preferences(userId);
    },

    // Reminders for people in activities that start within their chosen lead time. Returns the new reminders so the
    // caller can also send email to those who turned it on.
    async dueReminders(at = new Date()) {
      const time = at.toISOString();
      const rows = await db.prepare(`SELECT c.user_id, a.post_id, a.title, a.starts_at, u.notify_email, u.reminder_minutes
        FROM participants c JOIN activities a ON a.post_id = c.activity_id JOIN posts p ON p.id = a.post_id JOIN users u ON u.id = c.user_id
        WHERE c.status = 'joined' AND p.deleted_at IS NULL AND u.status = 'active' AND u.notify_reminders = 1
          AND a.starts_at > ? AND a.starts_at::timestamptz <= ?::timestamptz + u.reminder_minutes * interval '1 minute'
          AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = c.user_id AND n.post_id = a.post_id AND n.type = 'activity.reminder')`).all(time, time);
      for (const row of rows) await insert(db, randomUUID(), row.user_id, 'activity.reminder', null, row.post_id, JSON.stringify({ minutes: row.reminder_minutes }), time);
      return rows.map(row => ({ userId: row.user_id, postId: row.post_id, title: row.title, startsAt: row.starts_at, email: Boolean(row.notify_email), minutes: row.reminder_minutes }));
    },
  };
  return notifier;
}
