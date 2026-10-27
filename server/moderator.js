// Moderator review of reports, suspensions and appeals (rule.md: human review of flagging and suspension decisions;
// keep report records). Every decision is logged in action_logs (or audit_logs for a removed post) with the
// moderator, UTC time and IP. Moderators are named by MODERATOR_EMAILS or `npm run moderator -- <username>`.
import { randomUUID } from 'node:crypto';
import { HttpError } from './errors.js';

export const REVIEW_ACTIONS = ['dismiss', 'remove-post', 'suspend-user'];
const STATUSES = ['open', 'reviewed', 'resolved', 'all'];

export function createModeratorTools(db, notifier) {
  const now = () => new Date().toISOString();
  const log = (userId, action, targetType, targetId, ip) =>
    db.prepare('INSERT INTO action_logs VALUES (?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), userId, action, targetType, targetId, now(), ip);
  const name = row => row ? { id: row.id, displayName: row.display_name ?? 'บัญชีที่ถูกลบ', username: row.username } : null;
  const user = id => db.prepare('SELECT id, display_name, username, role, status, suspended_at, suspended_reason FROM users WHERE id = ?').get(id);
  const note = value => {
    if (value === undefined) return '';
    if (typeof value !== 'string' || value.trim().length > 1000) throw new HttpError(400, 'note', 'บันทึกต้องไม่เกิน 1,000 ตัวอักษร');
    return value.trim();
  };
  const status = value => STATUSES.includes(value) ? value : 'open';

  return {
    summary() {
      const n = sql => db.prepare(sql).get().n;
      return {
        openReports: n('SELECT count(*) AS n FROM reports r WHERE NOT EXISTS (SELECT 1 FROM report_reviews v WHERE v.report_id = r.id)'),
        openAppeals: n('SELECT count(*) AS n FROM appeals WHERE resolved_at IS NULL'),
        openRecommendationReviews: n("SELECT count(*) AS n FROM recommendation_feedback WHERE kind = 'review-request' AND reviewed_at IS NULL"),
      };
    },

    reports(filter) {
      const s = status(filter);
      const rows = db.prepare(`SELECT r.*, p.content, p.deleted_at, p.type, a.title FROM reports r
          LEFT JOIN posts p ON p.id = r.post_id LEFT JOIN activities a ON a.post_id = r.post_id
        WHERE (? = 'all') OR (? = 'open' AND NOT EXISTS (SELECT 1 FROM report_reviews v WHERE v.report_id = r.id))
          OR (? IN ('reviewed','resolved') AND EXISTS (SELECT 1 FROM report_reviews v WHERE v.report_id = r.id))
        ORDER BY r.created_at DESC LIMIT 200`).all(s, s, s);
      const reviews = db.prepare('SELECT * FROM report_reviews WHERE report_id = ? ORDER BY created_at');
      return rows.map(row => {
        const reported = user(row.reported_user_id);
        return {
          id: row.id, reason: row.reason, details: row.details, createdAt: row.created_at,
          reporter: name(user(row.reporter_id)),
          reportedUser: reported ? { ...name(reported), suspended: Boolean(reported.suspended_at), deleted: reported.status === 'deleted', role: reported.role } : null,
          post: row.post_id ? { id: row.post_id, type: row.type, title: row.title, content: row.content, removed: Boolean(row.deleted_at) } : null,
          reviews: reviews.all(row.id).map(v => ({ action: v.action, note: v.note, createdAt: v.created_at, moderator: name(user(v.moderator_id)) })),
        };
      });
    },

    review(moderatorId, reportId, body, ip) {
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['action', 'note'].includes(k))) throw new HttpError(400, 'bad-request', 'ข้อมูลที่ส่งมาไม่ถูกต้อง');
      if (!REVIEW_ACTIONS.includes(body.action)) throw new HttpError(400, 'action', 'เลือกการดำเนินการ');
      const text = note(body.note);
      const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
      if (!report) throw new HttpError(404, 'not-found', 'ไม่พบรายงานนี้');
      const target = user(report.reported_user_id);
      if (body.action === 'suspend-user') {
        if (!target || target.status !== 'active') throw new HttpError(409, 'no-user', 'บัญชีนี้ถูกลบหรือไม่มีอยู่แล้ว');
        if (target.role === 'moderator' || target.id === moderatorId) throw new HttpError(409, 'moderator', 'ระงับบัญชีผู้ดูแลไม่ได้');
        if (!text) throw new HttpError(400, 'note', 'กรุณาเขียนเหตุผลที่ระงับบัญชี ผู้ใช้จะเห็นเหตุผลนี้');
      }
      const time = now();
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('INSERT INTO report_reviews VALUES (?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), reportId, moderatorId, body.action, text, time, ip);
        log(moderatorId, `report.${body.action}`, 'report', reportId, ip);
        if (body.action === 'remove-post' && report.post_id) {
          const post = db.prepare('SELECT id, type, author_id, deleted_at FROM posts WHERE id = ?').get(report.post_id);
          if (post && !post.deleted_at) {
            db.prepare('UPDATE posts SET deleted_at = ? WHERE id = ?').run(time, post.id);
            db.prepare('INSERT INTO audit_logs VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), post.id, moderatorId, 'post.moderator-remove', time, ip);
            notifier.notify({ userId: post.author_id, type: 'post.removed', postId: post.id, data: { reason: text } });
            if (post.type === 'activity') notifier.notifyMembers(post.id, post.author_id, 'activity.cancelled', { byModerator: true });
          }
        }
        if (body.action === 'suspend-user' && !target.suspended_at) {
          db.prepare('UPDATE users SET suspended_at = ?, suspended_reason = ?, updated_at = ? WHERE id = ?').run(time, text, time, target.id);
          log(moderatorId, 'user.suspend', 'user', target.id, ip);
          notifier.notify({ userId: target.id, type: 'account.suspended', data: { reason: text } });
        }
        notifier.notify({ userId: report.reporter_id, type: 'report.reviewed', data: { outcome: body.action } });
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return { ok: true };
    },

    appeal(userId, body) {
      const me = user(userId);
      if (!me?.suspended_at) throw new HttpError(409, 'not-suspended', 'บัญชีของคุณไม่ได้ถูกระงับ');
      const message = body?.message;
      if (typeof message !== 'string' || !message.trim() || message.trim().length > 2000) throw new HttpError(400, 'message', 'กรุณาเขียนคำอธิบาย 1 ถึง 2,000 ตัวอักษร');
      if (db.prepare('SELECT 1 FROM appeals WHERE user_id = ? AND resolved_at IS NULL').get(userId)) throw new HttpError(409, 'open-appeal', 'คุณส่งคำขอทบทวนไว้แล้ว ทีมผู้ดูแลกำลังตรวจสอบ');
      db.prepare('INSERT INTO appeals (id, user_id, message, created_at) VALUES (?, ?, ?, ?)').run(randomUUID(), userId, message.trim(), now());
      return { ok: true };
    },

    openAppeal: userId => Boolean(db.prepare('SELECT 1 FROM appeals WHERE user_id = ? AND resolved_at IS NULL').get(userId)),

    appeals(filter) {
      const s = status(filter);
      return db.prepare(`SELECT * FROM appeals WHERE (? = 'all') OR (? = 'open' AND resolved_at IS NULL) OR (? IN ('resolved','reviewed') AND resolved_at IS NOT NULL)
        ORDER BY created_at DESC LIMIT 200`).all(s, s, s).map(row => {
        const u = user(row.user_id);
        return { id: row.id, message: row.message, createdAt: row.created_at, resolvedAt: row.resolved_at, outcome: row.outcome, note: row.note,
          user: u ? { ...name(u), suspendedReason: u.suspended_reason, suspended: Boolean(u.suspended_at) } : null };
      });
    },

    resolveAppeal(moderatorId, appealId, body, ip) {
      if (!body || !['lifted', 'upheld'].includes(body.outcome)) throw new HttpError(400, 'outcome', 'เลือกผลการทบทวน');
      const text = note(body.note);
      const row = db.prepare('SELECT * FROM appeals WHERE id = ? AND resolved_at IS NULL').get(appealId);
      if (!row) throw new HttpError(404, 'not-found', 'ไม่พบคำขอทบทวนที่ยังไม่ได้ตัดสิน');
      if (row.user_id === moderatorId) throw new HttpError(409, 'self', 'ตัดสินคำขอของตัวเองไม่ได้');
      const time = now();
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('UPDATE appeals SET resolved_at = ?, resolved_by = ?, outcome = ?, note = ? WHERE id = ?').run(time, moderatorId, body.outcome, text, appealId);
        log(moderatorId, `appeal.${body.outcome}`, 'user', row.user_id, ip);
        if (body.outcome === 'lifted') {
          db.prepare("UPDATE users SET suspended_at = NULL, suspended_reason = '', updated_at = ? WHERE id = ?").run(time, row.user_id);
          notifier.notify({ userId: row.user_id, type: 'account.restored', data: { note: text } });
        } else notifier.notify({ userId: row.user_id, type: 'account.appeal-upheld', data: { note: text } });
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return { ok: true };
    },

    recommendationReviews(filter) {
      const s = status(filter);
      return db.prepare(`SELECT f.*, a.title FROM recommendation_feedback f LEFT JOIN activities a ON a.post_id = f.post_id
        WHERE f.kind = 'review-request' AND ((? = 'all') OR (? = 'open' AND f.reviewed_at IS NULL) OR (? IN ('resolved','reviewed') AND f.reviewed_at IS NOT NULL))
        ORDER BY f.created_at DESC LIMIT 200`).all(s, s, s)
        .map(row => ({ id: row.id, details: row.details, createdAt: row.created_at, reviewedAt: row.reviewed_at, postId: row.post_id, title: row.title, user: name(user(row.user_id)) }));
    },

    closeRecommendationReview(moderatorId, id, ip) {
      const result = db.prepare("UPDATE recommendation_feedback SET reviewed_at = ?, reviewed_by = ? WHERE id = ? AND kind = 'review-request' AND reviewed_at IS NULL").run(now(), moderatorId, id);
      if (!result.changes) throw new HttpError(404, 'not-found', 'ไม่พบคำขอนี้');
      log(moderatorId, 'recommendation.review', 'feedback', id, ip);
      return { ok: true };
    },
  };
}
