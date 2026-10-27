// Reports and blocks (backlog 5.3). rule.md: keep each report (reporter, reported user, reason, time) for at least
// 90 days. Decision 2026-10-15: a block only hides the blocked person's posts from the blocker.
import { randomUUID } from 'node:crypto';
import { HttpError } from './errors.js';

export const REPORT_REASONS = ['spam', 'harassment', 'unsafe', 'fake', 'inappropriate', 'other'];

export function createModeration(db) {
  const realUser = id => db.prepare("SELECT id FROM users WHERE id = ? AND status = 'active'").get(id);
  const now = () => new Date().toISOString();

  return {
    report(reporterId, body, ip) {
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['postId', 'reason', 'details'].includes(k))) {
        throw new HttpError(400, 'bad-request', 'ข้อมูลที่ส่งมาไม่ถูกต้อง');
      }
      if (!REPORT_REASONS.includes(body.reason)) throw new HttpError(400, 'reason', 'กรุณาเลือกเหตุผลที่รายงาน');
      const details = body.details === undefined ? '' : body.details;
      if (typeof details !== 'string' || details.trim().length > 1000) throw new HttpError(400, 'details', 'รายละเอียดต้องไม่เกิน 1,000 ตัวอักษร');
      const post = typeof body.postId === 'string' ? db.prepare('SELECT id, author_id FROM posts WHERE id = ?').get(body.postId) : null;
      if (!post) throw new HttpError(404, 'not-found', 'ไม่พบโพสต์ที่รายงาน');
      if (post.author_id === reporterId) throw new HttpError(400, 'self', 'รายงานโพสต์ของตัวเองไม่ได้');
      const id = randomUUID();
      db.prepare('INSERT INTO reports VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, reporterId, post.author_id, post.id, body.reason, details.trim(), now(), ip);
      return { id };
    },

    block(blockerId, blockedId, ip) {
      if (typeof blockedId !== 'string' || !realUser(blockedId)) throw new HttpError(404, 'not-found', 'ไม่พบผู้ใช้นี้');
      if (blockedId === blockerId) throw new HttpError(400, 'self', 'บล็อกตัวเองไม่ได้');
      const active = db.prepare('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ? AND removed_at IS NULL').get(blockerId, blockedId);
      if (!active) db.prepare('INSERT INTO blocks VALUES (?, ?, ?, ?, NULL, ?)').run(randomUUID(), blockerId, blockedId, now(), ip);
    },

    unblock(blockerId, blockedId) {
      const result = db.prepare('UPDATE blocks SET removed_at = ? WHERE blocker_id = ? AND blocked_id = ? AND removed_at IS NULL').run(now(), blockerId, blockedId);
      if (!result.changes) throw new HttpError(404, 'not-blocked', 'คุณไม่ได้บล็อกผู้ใช้นี้');
    },

    blocked(blockerId) {
      return db.prepare(`SELECT b.blocked_id AS id, u.display_name, u.username, b.created_at FROM blocks b JOIN users u ON u.id = b.blocked_id
        WHERE b.blocker_id = ? AND b.removed_at IS NULL ORDER BY b.created_at DESC`).all(blockerId)
        .map(row => ({ id: row.id, displayName: row.display_name ?? 'บัญชีที่ถูกลบ', username: row.username, blockedAt: row.created_at }));
    },
  };
}
