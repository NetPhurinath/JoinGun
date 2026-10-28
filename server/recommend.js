// Activity recommendations (F6; backlog 6.1–6.3; LR4, LR5; rule.md Ethical AI guidance).
//   - Needs its own opt-in consent (purpose 'ai-recommendation'), separate from participation history and location.
//   - A transparent points model, not a trained or language model: every point comes from a factor shown to the user.
//   - Uses only the person's own interests, own participation history, friends and the start time. No year,
//     faculty, gender or other personal trait is used, and nothing is sent to an external API.
//   - People can dismiss an item, ask for less of a category, or ask for a human to review a recommendation.
import { randomUUID } from 'node:crypto';
import { HttpError } from './errors.js';
import { consentState } from './participation.js';

export const AI_CONSENT = { purpose: 'ai-recommendation', version: 'ai-v1' };
const LABELS = { sport: 'กีฬา', study: 'อ่านหนังสือ', cafe: 'คาเฟ่' };
const now = () => new Date().toISOString();

export function createRecommender(store, social) {
  const { db } = store;

  const recommender = {
    consent: userId => consentState(db, userId, AI_CONSENT),

    async grant(userId, body, ip) {
      if (!body || body.accept !== true || body.acknowledgeLimitations !== true || Object.keys(body).some(k => !['accept', 'acknowledgeLimitations'].includes(k))) {
        throw new HttpError(400, 'consent', 'กรุณายินยอมและรับทราบข้อจำกัดของระบบแนะนำก่อน');
      }
      if (!(await recommender.consent(userId)).active) {
        await db.prepare('INSERT INTO user_consents VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), userId, AI_CONSENT.purpose, AI_CONSENT.version, now(), ip);
      }
      return recommender.consent(userId);
    },

    async withdraw(userId, ip) {
      if (!(await recommender.consent(userId)).active) throw new HttpError(409, 'not-granted', 'คุณยังไม่ได้เปิดใช้ระบบแนะนำ');
      await db.prepare('INSERT INTO consent_withdrawals VALUES (?, ?, ?, ?, ?)').run(randomUUID(), userId, AI_CONSENT.purpose, now(), ip);
      return recommender.consent(userId);
    },

    async recommend(userId, limit = 10) {
      if (!(await recommender.consent(userId)).active) return { consent: false, items: [] };
      const interests = await social.interestsOf(userId);
      const since = new Date(Date.now() - 180 * 86_400_000).toISOString();
      const history = Object.fromEntries((await db.prepare(`SELECT a.category, count(*) AS n FROM participants c JOIN activities a ON a.post_id = c.activity_id
        WHERE c.user_id = ? AND c.status = 'joined' AND a.starts_at >= ? GROUP BY a.category`).all(userId, since)).map(r => [r.category, r.n]));
      const less = Object.fromEntries((await db.prepare(`SELECT category, count(*) AS n FROM recommendation_feedback WHERE user_id = ? AND kind = 'less-category' GROUP BY category`)
        .all(userId)).map(r => [r.category, r.n]));
      const friends = new Set(await social.friendIds(userId));
      const time = now();
      const candidates = await db.prepare(`SELECT p.id, p.author_id, a.category, a.starts_at, a.capacity,
          (SELECT count(*) FROM participants c WHERE c.activity_id = p.id AND c.status = 'joined') AS joined
        FROM posts p JOIN activities a ON a.post_id = p.id JOIN users u ON u.id = p.author_id
        WHERE p.deleted_at IS NULL AND u.status = 'active' AND a.starts_at > ?
          AND NOT EXISTS (SELECT 1 FROM participants v WHERE v.activity_id = p.id AND v.user_id = ? AND v.status = 'joined')
          AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = ? AND b.blocked_id = p.author_id AND b.removed_at IS NULL)
          AND NOT EXISTS (SELECT 1 FROM recommendation_feedback f WHERE f.user_id = ? AND f.post_id = p.id AND f.kind = 'dismiss')
        ORDER BY a.starts_at LIMIT 300`).all(time, userId, userId, userId);
      const members = db.prepare("SELECT user_id FROM participants WHERE activity_id = ? AND status = 'joined'");

      const scored = [];
      for (const c of candidates) {
        if (c.joined >= c.capacity) continue;
        const factors = [];
        const label = LABELS[c.category] || c.category;
        if (interests.includes(c.category)) factors.push({ key: 'interest', points: 40, label: `ตรงกับความสนใจที่คุณเลือกไว้: ${label}` });
        if (history[c.category]) factors.push({ key: 'history', points: Math.min(30, history[c.category] * 10), label: `คุณเคยเข้าร่วมกิจกรรมหมวด${label} ${history[c.category]} ครั้งใน 6 เดือนที่ผ่านมา` });
        const friendCount = (await members.all(c.id)).filter(m => friends.has(m.user_id) && m.user_id !== c.author_id).length;
        if (friendCount) factors.push({ key: 'friends', points: Math.min(30, friendCount * 15), label: `เพื่อนของคุณ ${friendCount} คนเข้าร่วมแล้ว` });
        if (friends.has(c.author_id)) factors.push({ key: 'host-friend', points: 15, label: 'จัดโดยเพื่อนของคุณ' });
        if (new Date(c.starts_at).getTime() - Date.now() <= 48 * 3_600_000) factors.push({ key: 'soon', points: 10, label: 'เริ่มภายใน 2 วัน' });
        if (less[c.category]) factors.push({ key: 'less', points: -25 * less[c.category], label: `คุณขอให้แนะนำหมวด${label}น้อยลง` });
        const score = factors.reduce((sum, f) => sum + f.points, 0);
        // At least one personal reason (not only "starts soon").
        if (score < 15 || !factors.some(f => f.points > 0 && f.key !== 'soon')) continue;
        scored.push({ id: c.id, score: Math.min(100, score), factors, startsAt: c.starts_at });
      }
      scored.sort((a, b) => b.score - a.score || a.startsAt.localeCompare(b.startsAt));
      const items = [];
      for (const item of scored.slice(0, limit)) items.push({ post: await store.get(item.id, userId), score: item.score, factors: item.factors });
      return {
        consent: true,
        method: 'points',
        disclaimer: 'คำแนะนำนี้สร้างโดยระบบอัตโนมัติจากความสนใจ ประวัติการเข้าร่วม และเพื่อนของคุณ อาจไม่ตรงใจเสมอไป และไม่ได้รับประกันความปลอดภัยหรือตัวตนของผู้จัด',
        items,
      };
    },

    async feedback(userId, body) {
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['postId', 'kind', 'details'].includes(k))) {
        throw new HttpError(400, 'bad-request', 'ข้อมูลที่ส่งมาไม่ถูกต้อง');
      }
      if (!['dismiss', 'less-category', 'review-request'].includes(body.kind)) throw new HttpError(400, 'kind', 'ประเภทความคิดเห็นไม่ถูกต้อง');
      const details = body.details ?? '';
      if (typeof details !== 'string' || details.trim().length > 1000) throw new HttpError(400, 'details', 'รายละเอียดต้องไม่เกิน 1,000 ตัวอักษร');
      if (body.kind === 'review-request' && !details.trim()) throw new HttpError(400, 'details', 'กรุณาอธิบายสิ่งที่อยากให้ทีมตรวจสอบ');
      let category = null, postId = null;
      if (body.postId !== undefined) {
        const row = typeof body.postId === 'string' ? await db.prepare('SELECT post_id, category FROM activities WHERE post_id = ?').get(body.postId) : null;
        if (!row) throw new HttpError(404, 'not-found', 'ไม่พบกิจกรรมนี้');
        postId = row.post_id; category = row.category;
      } else if (body.kind !== 'review-request') throw new HttpError(400, 'post', 'ต้องระบุกิจกรรม');
      await db.prepare('INSERT INTO recommendation_feedback (id, user_id, post_id, category, kind, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(randomUUID(), userId, postId, category, body.kind, details.trim(), now());
      return { ok: true };
    },

    // Lets someone undo "less of this category".
    async resetFeedback(userId) {
      await db.prepare("DELETE FROM recommendation_feedback WHERE user_id = ? AND kind IN ('dismiss','less-category')").run(userId);
    },
  };
  return recommender;
}
