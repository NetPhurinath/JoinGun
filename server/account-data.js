// "My account" data rights (rule.md PDPA section; backlog 7.3, 8.2):
//   - withdraw the participation-history consent (decision 2026-10-15: stops future joins only; current ones stay)
//   - download my data as a password-protected ZIP (AES-256, WinZip AE-2) holding one JSON file
//   - delete my account (decision 2026-10-15: hidden at once, email archived 90 days, then purged; see maintenance.js)
import { randomUUID } from 'node:crypto';
import { HttpError } from './errors.js';
import { PARTICIPATION_CONSENT, participationConsent, consentState } from './participation.js';
import { AI_CONSENT } from './recommend.js';
import { clearProfile, openProfile } from './profile-crypto.js';

export const ARCHIVE_DAYS = 90;
const now = () => new Date().toISOString();

export function createAccountData(db, security) {
  const authLog = (userId, action, status, ip) =>
    db.prepare('INSERT INTO auth_logs VALUES (?, ?, NULL, ?, ?, ?, ?)').run(randomUUID(), userId, action, status, now(), ip);

  return {
    consents(userId) {
      const terms = db.prepare('SELECT terms_version, privacy_version, accepted_at FROM terms_acceptances WHERE user_id = ? ORDER BY accepted_at DESC LIMIT 1').get(userId);
      return {
        participation: participationConsent(db, userId),
        ai: consentState(db, userId, AI_CONSENT),
        terms: terms ? { termsVersion: terms.terms_version, privacyVersion: terms.privacy_version, acceptedAt: terms.accepted_at } : null,
      };
    },

    withdrawParticipation(userId, ip) {
      if (!participationConsent(db, userId).active) throw new HttpError(409, 'not-granted', 'คุณยังไม่ได้ให้ความยินยอมนี้');
      db.prepare('INSERT INTO consent_withdrawals VALUES (?, ?, ?, ?, ?)').run(randomUUID(), userId, PARTICIPATION_CONSENT.purpose, now(), ip);
      authLog(userId, 'consent.withdraw', PARTICIPATION_CONSENT.purpose, ip);
      return participationConsent(db, userId);
    },

    // Everything stored about the user, readable without JoinGun.
    collect(userId) {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      const email = db.prepare('SELECT email_encrypted FROM user_emails WHERE user_id = ?').get(userId);
      const extra = openProfile(security, user);
      const all = (sql, ...args) => db.prepare(sql).all(...args);
      return {
        exportedAt: now(),
        about: 'ข้อมูลทั้งหมดที่ JoinGun เก็บเกี่ยวกับบัญชีของคุณ ณ เวลาที่ดาวน์โหลด (Data JoinGun stores about your account at export time.)',
        profile: {
          id: user.id, email: email ? security.decrypt(email.email_encrypted) : null, displayName: user.display_name, username: user.username,
          year: extra.year, interests: extra.interests, bio: extra.bio, createdAt: user.created_at,
          historyVisibility: user.history_visibility, role: user.role,
          suspended: user.suspended_at ? { at: user.suspended_at, reason: user.suspended_reason } : null,
          notificationSettings: { reminders: Boolean(user.notify_reminders), email: Boolean(user.notify_email), reminderMinutes: user.reminder_minutes },
        },
        consents: {
          termsAcceptances: all('SELECT terms_version, privacy_version, accepted_at, ip_address FROM terms_acceptances WHERE user_id = ? ORDER BY accepted_at', userId),
          participationGrants: all("SELECT version, granted_at, ip_address FROM user_consents WHERE user_id = ? AND purpose = 'participation-history' ORDER BY granted_at", userId),
          otherConsentGrants: all("SELECT purpose, version, granted_at, ip_address FROM user_consents WHERE user_id = ? AND purpose != 'participation-history' ORDER BY granted_at", userId),
          withdrawals: all('SELECT purpose, withdrawn_at, ip_address FROM consent_withdrawals WHERE user_id = ? ORDER BY withdrawn_at', userId),
          meetingLocationConsents: all('SELECT post_id, terms_version, created_at, ip_address FROM consent_records WHERE user_id = ? ORDER BY created_at', userId),
        },
        posts: all(`SELECT p.id, p.type, p.content, p.created_at, p.updated_at, p.deleted_at, a.title, a.starts_at, a.location, a.meeting, a.capacity, a.category, a.lat, a.lng
          FROM posts p LEFT JOIN activities a ON a.post_id = p.id WHERE p.author_id = ? ORDER BY p.sequence`, userId),
        participation: all(`SELECT c.activity_id, a.title, a.starts_at, c.role, c.status, c.joined_at, c.left_at
          FROM participants c JOIN activities a ON a.post_id = c.activity_id WHERE c.user_id = ? ORDER BY c.joined_at`, userId),
        reportsMade: all('SELECT post_id, reason, details, created_at FROM reports WHERE reporter_id = ? ORDER BY created_at', userId),
        blocks: all(`SELECT u.username AS blocked_username, b.created_at, b.removed_at FROM blocks b LEFT JOIN users u ON u.id = b.blocked_id
          WHERE b.blocker_id = ? ORDER BY b.created_at`, userId),
        friends: all(`SELECT f.status, f.created_at, f.responded_at, f.ended_at, CASE WHEN f.requester_id = ? THEN 'sent' ELSE 'received' END AS direction,
            u.username AS other_username FROM friendships f LEFT JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
          WHERE f.requester_id = ? OR f.addressee_id = ? ORDER BY f.created_at`, userId, userId, userId, userId),
        notifications: all('SELECT type, post_id, data, created_at, read_at FROM notifications WHERE user_id = ? ORDER BY created_at', userId),
        recommendationFeedback: all('SELECT kind, post_id, category, details, created_at FROM recommendation_feedback WHERE user_id = ? ORDER BY created_at', userId),
        appeals: all('SELECT message, created_at, resolved_at, outcome, note FROM appeals WHERE user_id = ? ORDER BY created_at', userId),
        otherActionLog: all('SELECT action, target_type, created_at, ip_address FROM action_logs WHERE user_id = ? ORDER BY created_at', userId),
        activityLog: all('SELECT action, post_id, created_at, ip_address FROM audit_logs WHERE user_id = ? ORDER BY created_at', userId),
        signInLog: all('SELECT action, auth_status, created_at, source_ip FROM auth_logs WHERE user_id = ? ORDER BY created_at', userId),
      };
    },

    async exportZip(userId, password, ip) {
      if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
        throw new HttpError(400, 'password', 'รหัสผ่านของไฟล์ต้องมี 8 ถึง 128 ตัวอักษร');
      }
      let zip;
      try { zip = await import('@zip.js/zip.js'); }
      catch { throw new HttpError(503, 'zip-missing', 'เซิร์ฟเวอร์ยังไม่ได้ติดตั้งส่วนสร้างไฟล์ กรุณาแจ้งผู้ดูแลให้รัน npm install'); }
      zip.configure({ useWebWorkers: false });
      const writer = new zip.ZipWriter(new zip.Uint8ArrayWriter(), { password, encryptionStrength: 3 });
      await writer.add('joingun-my-data.json', new zip.TextReader(JSON.stringify(this.collect(userId), null, 2)));
      const bytes = await writer.close();
      authLog(userId, 'data.export', 'success', ip);
      return Buffer.from(bytes);
    },

    deleteAccount(userId, confirmUsername, ip) {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (!user || user.status === 'deleted') throw new HttpError(404, 'not-found', 'ไม่พบบัญชี');
      if (typeof confirmUsername !== 'string' || confirmUsername.trim().toLowerCase() !== user.username) {
        throw new HttpError(400, 'confirm', 'พิมพ์ชื่อผู้ใช้ของคุณให้ตรงเพื่อยืนยันการลบบัญชี');
      }
      const time = now(), purgeAfter = new Date(Date.now() + ARCHIVE_DAYS * 86_400_000).toISOString();
      db.exec('BEGIN IMMEDIATE');
      try {
        const email = db.prepare('SELECT * FROM user_emails WHERE user_id = ?').get(userId);
        if (email) {
          db.prepare('INSERT INTO deleted_accounts VALUES (?, ?, ?, ?, ?, ?)').run(userId, email.email_hash, email.email_encrypted, time, purgeAfter, ip);
          db.prepare('DELETE FROM user_emails WHERE user_id = ?').run(userId);
        }
        // Profile data goes now; the random user id stays so logs keep their 90-day link to the archived record.
        db.prepare("UPDATE users SET status = 'deleted', deleted_at = ?, display_name = NULL, username = NULL, year = NULL, interests = '[]', updated_at = ? WHERE id = ?").run(time, time, userId);
        clearProfile(db, userId);
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
        db.prepare('UPDATE blocks SET removed_at = ? WHERE blocker_id = ? AND removed_at IS NULL').run(time, userId);
        // Friend connections end now (rows are removed at the purge); personal notifications and feedback go now.
        db.prepare(`UPDATE friendships SET status = CASE status WHEN 'accepted' THEN 'removed' ELSE 'cancelled' END, ended_at = ?
          WHERE status IN ('pending','accepted') AND (requester_id = ? OR addressee_id = ?)`).run(time, userId, userId);
        db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);
        db.prepare("DELETE FROM recommendation_feedback WHERE user_id = ? AND kind != 'review-request'").run(userId);
        db.prepare("UPDATE users SET bio = '', suspended_reason = '' WHERE id = ?").run(userId);
        // Upcoming activities: hosted ones are cancelled, joined ones are left (logged like a normal leave).
        const hosted = db.prepare(`SELECT p.id FROM posts p JOIN activities a ON a.post_id = p.id WHERE p.author_id = ? AND p.deleted_at IS NULL AND a.starts_at > ?`).all(userId, time);
        for (const { id } of hosted) {
          db.prepare('UPDATE posts SET deleted_at = ? WHERE id = ?').run(time, id);
          db.prepare('INSERT INTO audit_logs VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), id, userId, 'post.delete', time, ip);
        }
        const joined = db.prepare(`SELECT c.activity_id FROM participants c JOIN activities a ON a.post_id = c.activity_id
          WHERE c.user_id = ? AND c.status = 'joined' AND c.role = 'member' AND a.starts_at > ?`).all(userId, time);
        for (const { activity_id: id } of joined) {
          db.prepare("UPDATE participants SET status = 'left', left_at = ? WHERE activity_id = ? AND user_id = ?").run(time, id, userId);
          db.prepare('INSERT INTO audit_logs VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), id, userId, 'activity.leave', time, ip);
        }
        authLog(userId, 'account.delete', 'success', ip);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return { purgeAfter };
    },
  };
}
