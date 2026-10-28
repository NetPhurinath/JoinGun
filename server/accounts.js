// Account storage: sign-in codes, users, sessions, terms acceptance and auth logs. All SQL for accounts lives here.
import { randomUUID } from 'node:crypto';
import { participationConsent } from './participation.js';
import { openProfile, writeProfile } from './profile-crypto.js';

const now = () => new Date().toISOString();
const addMinutes = (minutes, from = Date.now()) => new Date(from + minutes * 60_000).toISOString();

export function createAccounts(db, security, config) {
  const log = ({ userId = null, emailHash = null, action, status, ip }) =>
    db.prepare('INSERT INTO auth_logs VALUES (?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), userId, emailHash, action, status, now(), ip);

  const toPublicUser = async row => row && toPublic(row, openProfile(security, row), (await participationConsent(db, row.id)).active);
  const toPublic = (row, profile, participation) => ({
    id: row.id,
    displayName: row.display_name,
    username: row.username,
    year: profile.year,
    interests: profile.interests,
    bio: profile.bio,
    role: row.role ?? 'user',
    historyVisibility: row.history_visibility ?? 'private',
    // A moderator's suspension: the person can still read, change settings, download data and ask for review.
    suspended: row.suspended_at ? { at: row.suspended_at, reason: row.suspended_reason } : null,
    // Whether the separate consent to keep participation history (LR1) has been given, so the join sheet asks once.
    participationConsent: participation,
    // What the user still has to do before the account is usable.
    needs: row.terms_version !== config.termsVersion || row.privacy_version !== config.privacyVersion ? 'terms' : (row.username ? null : 'profile'),
  });

  return {
    log,
    toPublicUser,

    // One active code per email; a new request replaces the old one.
    async issueCode(emailHash) {
      const code = security.newCode();
      await db.prepare(`INSERT INTO login_codes (email_hash, code_hash, attempts, expires_at, created_at) VALUES (?, ?, 0, ?, ?)
        ON CONFLICT(email_hash) DO UPDATE SET code_hash = excluded.code_hash, attempts = 0, expires_at = excluded.expires_at, created_at = excluded.created_at`)
        .run(emailHash, security.codeHash(emailHash, code), addMinutes(config.codeMinutes), now());
      return code;
    },

    // Returns 'ok', 'wrong' or 'expired'. A code is single-use and locked after too many wrong attempts.
    async checkCode(emailHash, code) {
      const row = await db.prepare('SELECT * FROM login_codes WHERE email_hash = ?').get(emailHash);
      if (!row || row.expires_at <= now() || row.attempts >= config.codeMaxAttempts) return 'expired';
      if (!security.sameHash(row.code_hash, security.codeHash(emailHash, code))) {
        await db.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE email_hash = ?').run(emailHash);
        return 'wrong';
      }
      await db.prepare('DELETE FROM login_codes WHERE email_hash = ?').run(emailHash);
      return 'ok';
    },

    // Finds the account for a verified email, creating a pending one on first sign-in.
    async findOrCreateUser(email, emailHash) {
      const existing = await db.prepare('SELECT u.* FROM user_emails e JOIN users u ON u.id = e.user_id WHERE e.email_hash = ?').get(emailHash);
      if (existing) return { user: existing, created: false };
      const id = randomUUID(), time = now();
      await db.transaction(async tx => {
        await tx.prepare("INSERT INTO users (id, status, created_at, updated_at, history_visibility) VALUES (?, 'pending', ?, ?, 'private')").run(id, time, time);
        await tx.prepare('INSERT INTO user_emails VALUES (?, ?, ?, ?)').run(id, emailHash, security.encrypt(email), time);
      });
      return { user: await this.getUser(id), created: true };
    },

    getUser: id => db.prepare('SELECT * FROM users WHERE id = ?').get(id),

    async createSession(userId, ip) {
      const token = security.newToken();
      await db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?)').run(security.tokenHash(token), userId, now(), addMinutes(config.sessionDays * 24 * 60), ip);
      return token;
    },

    async userForSession(token) {
      if (!token) return null;
      const row = await db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ? AND u.status != 'deleted'`).get(security.tokenHash(token), now());
      return row || null;
    },

    async endSession(token) {
      await db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(security.tokenHash(token));
    },

    async acceptTerms(userId, ip) {
      const time = now();
      await db.transaction(async tx => {
        await tx.prepare('INSERT INTO terms_acceptances VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), userId, config.termsVersion, config.privacyVersion, time, ip);
        await tx.prepare('UPDATE users SET terms_version = ?, privacy_version = ?, updated_at = ? WHERE id = ?').run(config.termsVersion, config.privacyVersion, time, userId);
        await tx.prepare('INSERT INTO auth_logs VALUES (?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), userId, null, 'terms.accept', 'success', now(), ip);
      });
    },

    // Accounts whose email is listed in MODERATOR_EMAILS become moderators when they sign in.
    async makeModerator(userId) { await db.prepare("UPDATE users SET role = 'moderator' WHERE id = ? AND role != 'moderator'").run(userId); },

    usernameTaken: async (username, userId) => Boolean(await db.prepare('SELECT 1 FROM users WHERE username = ? AND id != ?').get(username, userId)),

    async saveProfile(userId, profile, ip) {
      const before = await this.getUser(userId);
      await db.prepare("UPDATE users SET display_name = ?, username = ?, status = 'active', updated_at = ? WHERE id = ?")
        .run(profile.displayName, profile.username, now(), userId);
      await writeProfile(db, security, userId, { year: profile.year, interests: profile.interests, bio: profile.bio ?? openProfile(security, before).bio });
      await log({ userId, action: before.username ? 'profile.update' : 'profile.create', status: 'success', ip });
      return this.getUser(userId);
    },
  };
}
