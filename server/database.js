import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { HttpError } from './errors.js';

export function openDatabase(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS posts (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      author_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('text','activity')),
      content TEXT NOT NULL CHECK(length(content) BETWEEN 1 AND 5000),
      created_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS activities (
      post_id TEXT PRIMARY KEY REFERENCES posts(id),
      title TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      location TEXT NOT NULL,
      capacity INTEGER NOT NULL CHECK(capacity BETWEEN 2 AND 1000)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS consent_records (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES posts(id),
      user_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      terms_version TEXT NOT NULL,
      created_at TEXT NOT NULL,
      ip_address TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES posts(id),
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      created_at TEXT NOT NULL,
      ip_address TEXT NOT NULL
    ) STRICT;
    -- Accounts. The email lives only in user_emails: a keyed hash for lookup and an encrypted copy for account
    -- recovery, never next to posts or activity history (rule.md, PDPA).
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE CHECK(username IS NULL OR username GLOB '[a-z0-9_]*'),
      display_name TEXT,
      year TEXT CHECK(year IS NULL OR year IN ('1','2','3','4','other')),
      interests TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL CHECK(status IN ('pending','active','deleted')),
      terms_version TEXT,
      privacy_version TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS user_emails (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      email_hash TEXT NOT NULL UNIQUE,
      email_encrypted TEXT NOT NULL,
      verified_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS login_codes (
      email_hash TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      ip_address TEXT NOT NULL
    ) STRICT;
    -- Evidence of each "I agree" (rule.md, Computer Crime Act section). Rows are only ever inserted.
    CREATE TABLE IF NOT EXISTS terms_acceptances (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      terms_version TEXT NOT NULL,
      privacy_version TEXT NOT NULL,
      accepted_at TEXT NOT NULL,
      ip_address TEXT NOT NULL
    ) STRICT;
    -- Login, logout and code requests with user_id (when known), UTC time, source IP and outcome. Not pruned.
    CREATE TABLE IF NOT EXISTS auth_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      email_hash TEXT,
      action TEXT NOT NULL,
      auth_status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      source_ip TEXT NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
    -- Who takes part in an activity. The host is the first participant (capacity includes the host).
    -- Leaving keeps the row with status 'left' so the history stays consistent with the audit log.
    CREATE TABLE IF NOT EXISTS participants (
      activity_id TEXT NOT NULL REFERENCES activities(post_id),
      user_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('host','member')),
      status TEXT NOT NULL CHECK(status IN ('joined','left')),
      joined_at TEXT NOT NULL,
      left_at TEXT,
      PRIMARY KEY (activity_id, user_id)
    ) STRICT;
    -- Reports of other users (rule.md: keep reporter, reported user, reason and time for at least 90 days). Insert-only.
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL,
      reported_user_id TEXT NOT NULL,
      post_id TEXT,
      reason TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      ip_address TEXT NOT NULL
    ) STRICT;
    -- Blocks hide the blocked person's posts from the blocker. Unblocking sets removed_at; rows are kept.
    CREATE TABLE IF NOT EXISTS blocks (
      id TEXT PRIMARY KEY,
      blocker_id TEXT NOT NULL,
      blocked_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      removed_at TEXT,
      ip_address TEXT NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS blocks_active ON blocks(blocker_id, blocked_id) WHERE removed_at IS NULL;
    -- Withdrawals of a per-user consent. The consent counts only if granted after the latest withdrawal.
    CREATE TABLE IF NOT EXISTS consent_withdrawals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      withdrawn_at TEXT NOT NULL,
      ip_address TEXT NOT NULL
    ) STRICT;
    -- Deleted accounts: the email moves here (encrypted) and is purged 90 days later (rule.md: archive >= 90 days,
    -- then delete or make unidentifiable). The same address can sign up again as a new account meanwhile.
    CREATE TABLE IF NOT EXISTS deleted_accounts (
      user_id TEXT PRIMARY KEY,
      email_hash TEXT NOT NULL,
      email_encrypted TEXT NOT NULL,
      deleted_at TEXT NOT NULL,
      purge_after TEXT NOT NULL,
      ip_address TEXT NOT NULL
    ) STRICT;
    -- Per-user consents that are not tied to one post (e.g. keeping participation history, LR1). Insert-only.
    CREATE TABLE IF NOT EXISTS user_consents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      version TEXT NOT NULL,
      granted_at TEXT NOT NULL,
      ip_address TEXT NOT NULL
    ) STRICT;
    -- Actions that are not tied to one post (friend requests, moderator decisions, activity completion), with
    -- user, UTC time and IP (rule.md, Computer Crime Act section). Insert-only.
    CREATE TABLE IF NOT EXISTS action_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      created_at TEXT NOT NULL,
      ip_address TEXT NOT NULL
    ) STRICT;
    -- Friend connections (backlog 5.1, 5.2). Rows keep their history; ended connections are purged with the account.
    CREATE TABLE IF NOT EXISTS friendships (
      id TEXT PRIMARY KEY,
      requester_id TEXT NOT NULL,
      addressee_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending','accepted','declined','cancelled','removed')),
      created_at TEXT NOT NULL,
      responded_at TEXT,
      ended_at TEXT,
      ip_address TEXT NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS friendships_requester ON friendships(requester_id, status);
    CREATE INDEX IF NOT EXISTS friendships_addressee ON friendships(addressee_id, status);
    -- In-app notifications (F4, backlog 4.1). One reminder per person and activity.
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      actor_id TEXT,
      post_id TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      read_at TEXT
    ) STRICT;
    CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id, created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS notifications_reminder ON notifications(user_id, post_id) WHERE type = 'activity.reminder';
    -- Feedback on recommendations (rule.md: dismiss/override, and a route to human review).
    CREATE TABLE IF NOT EXISTS recommendation_feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      post_id TEXT,
      category TEXT,
      kind TEXT NOT NULL CHECK(kind IN ('dismiss','less-category','review-request')),
      details TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewed_by TEXT
    ) STRICT;
    -- Moderator decisions on reports. Reports themselves stay insert-only.
    CREATE TABLE IF NOT EXISTS report_reviews (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL REFERENCES reports(id),
      moderator_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('dismiss','remove-post','suspend-user')),
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      ip_address TEXT NOT NULL
    ) STRICT;
    -- Requests for human review of a suspension (rule.md, Ethical AI guidance).
    CREATE TABLE IF NOT EXISTS appeals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      resolved_by TEXT,
      outcome TEXT CHECK(outcome IS NULL OR outcome IN ('lifted','upheld')),
      note TEXT NOT NULL DEFAULT ''
    ) STRICT;
  `);
  // Additive migration: keep all posts created by the earlier MVP.
  const columns = new Set(db.prepare('PRAGMA table_info(activities)').all().map(column=>column.name));
  for (const [name, definition] of Object.entries({category:"TEXT NOT NULL DEFAULT 'sport'",meeting:"TEXT NOT NULL DEFAULT ''",lat:'REAL',lng:'REAL'})) {
    if (!columns.has(name)) db.exec(`ALTER TABLE activities ADD COLUMN ${name} ${definition}`);
  }
  for (const [table, name, definition] of [['posts', 'deleted_at', 'TEXT'], ['posts', 'updated_at', 'TEXT'], ['users', 'deleted_at', 'TEXT'],
    ['users', 'bio', "TEXT NOT NULL DEFAULT ''"],
    // Who may see the activities a person joined (F5): everyone, friends only, or only the person.
    ['users', 'history_visibility', "TEXT NOT NULL DEFAULT 'friends' CHECK(history_visibility IN ('public','friends','private'))"],
    ['users', 'role', "TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','moderator'))"],
    ['users', 'suspended_at', 'TEXT'], ['users', 'suspended_reason', "TEXT NOT NULL DEFAULT ''"],
    // Notification settings (backlog 4.2).
    // Encrypted optional profile fields (server/profile-crypto.js); the plain year/interests/bio columns stay empty.
    ['users', 'year_enc', 'TEXT'], ['users', 'interests_enc', 'TEXT'], ['users', 'bio_enc', 'TEXT'],
    ['users', 'notify_reminders', 'INTEGER NOT NULL DEFAULT 1'], ['users', 'notify_email', 'INTEGER NOT NULL DEFAULT 0'],
    ['users', 'reminder_minutes', 'INTEGER NOT NULL DEFAULT 60'],
    // Set by the maintenance job a few hours after the start time (Scope workflow 6: the system logs completion).
    ['activities', 'completed_at', 'TEXT']]) {
    if (!db.prepare(`PRAGMA table_info(${table})`).all().some(column => column.name === name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
  // Activities created before participants existed: their host becomes the first participant.
  db.exec(`INSERT OR IGNORE INTO participants (activity_id, user_id, role, status, joined_at)
    SELECT a.post_id, p.author_id, 'host', 'joined', p.created_at FROM activities a JOIN posts p ON p.id = a.post_id`);
  // The first placeholder is the viewer's user id (or null), so each post says whether the viewer takes part.
  const select = `SELECT p.*, a.title, a.starts_at, a.location, a.capacity, a.category, a.meeting, a.lat, a.lng, a.completed_at,
      u.display_name AS author_name, u.username AS author_username, u.status AS author_status,
      (SELECT count(*) FROM participants c WHERE c.activity_id = p.id AND c.status = 'joined') AS joined_count,
      vp.role AS viewer_role, vp.status AS viewer_status
    FROM posts p LEFT JOIN activities a ON a.post_id = p.id LEFT JOIN users u ON u.id = p.author_id
      LEFT JOIN participants vp ON vp.activity_id = p.id AND vp.user_id = ?`;
  const serialize = row => row && ({
    // Posts made before accounts existed belong to the shared demo actor.
    id: row.id,
    author: row.author_status === 'deleted'
      ? { id: row.author_id, name: 'บัญชีที่ถูกลบ', username: null, deleted: true }
      : { id: row.author_id, name: row.author_name ?? 'Demo Student', username: row.author_username ?? null },
    type: row.type,
    content: row.content, createdAt: row.created_at, updatedAt: row.updated_at ?? null,
    // Set when the author deleted the post (for an activity: cancelled). Only the host and members still see it.
    deletedAt: row.deleted_at ?? null,
    activity: row.type === 'activity' ? {title: row.title, startsAt: row.starts_at, location: row.location, capacity: row.capacity,category:row.category,meeting:row.meeting,lat:row.lat,lng:row.lng,
      joinedCount: row.joined_count, completedAt: row.completed_at ?? null,
      // 'host' | 'joined' | null for the person asking (null when signed out, never joined, or left).
      viewerStatus: row.viewer_status === 'joined' ? (row.viewer_role === 'host' ? 'host' : 'joined') : null} : null
  });
  return {
    db,
    get(id, viewerId = null) { return serialize(db.prepare(`${select} WHERE p.id = ?`).get(viewerId, id)); },
    // scope: 'all' | 'friends' (posts by the viewer's friends). authorId: one person's posts (profile page).
    // open: only activities that have not started and still have places.
    list({limit, before, category = 'all', date = '', q = '', viewerId = null, authorId = null, scope = 'all', open = false}) {
      // Filters run in SQL so the client loads one page at a time (NFR1).
      const where = [], params = [];
      if (authorId) { where.push('p.author_id = ?'); params.push(authorId); }
      if (scope === 'friends') {
        where.push(`p.author_id IN (SELECT CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END FROM friendships f
          WHERE f.status = 'accepted' AND (f.requester_id = ? OR f.addressee_id = ?))`);
        params.push(viewerId ?? '', viewerId ?? '', viewerId ?? '');
      }
      if (open) {
        where.push(`p.type = 'activity' AND a.starts_at > ? AND (SELECT count(*) FROM participants c WHERE c.activity_id = p.id AND c.status = 'joined') < a.capacity`);
        params.push(new Date().toISOString());
      }
      if (category === 'text') where.push("p.type = 'text'");
      else if (category !== 'all') { where.push('a.category = ?'); params.push(category); }
      if (date) {
        // A calendar day in the university's timezone (Asia/Bangkok, UTC+07:00); activities use their start time.
        const start = new Date(`${date}T00:00:00+07:00`);
        where.push('julianday(COALESCE(a.starts_at, p.created_at)) >= julianday(?) AND julianday(COALESCE(a.starts_at, p.created_at)) < julianday(?)');
        params.push(start.toISOString(), new Date(start.getTime() + 86400000).toISOString());
      }
      if (q) {
        const pattern = `%${q.replace(/[\\%_]/g, char => `\\${char}`)}%`;
        where.push("(p.content LIKE ? ESCAPE '\\' OR a.title LIKE ? ESCAPE '\\' OR a.location LIKE ? ESCAPE '\\' OR a.meeting LIKE ? ESCAPE '\\')");
        params.push(pattern, pattern, pattern, pattern);
      }
      // Hidden from the feed: deleted posts, posts of deleted accounts, and authors the viewer has blocked.
      where.unshift("p.deleted_at IS NULL", "(u.status IS NULL OR u.status != 'deleted')",
        'NOT EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = ? AND b.blocked_id = p.author_id AND b.removed_at IS NULL)');
      params.unshift(viewerId ?? '');
      const filter = `AND ${where.join(' AND ')}`;
      const rows = db.prepare(`${select} WHERE p.sequence < ? ${filter} ORDER BY p.sequence DESC LIMIT ?`).all(viewerId, before, ...params, limit + 1);
      const {total} = db.prepare(`SELECT count(*) AS total FROM posts p LEFT JOIN activities a ON a.post_id = p.id LEFT JOIN users u ON u.id = p.author_id WHERE 1 ${filter}`).get(...params);
      const page = rows.slice(0, limit);
      return {items: page.map(serialize), nextCursor: rows.length > limit ? String(page.at(-1).sequence) : null, total};
    },
    create(post, { userId, ip }) {
      const id = randomUUID(), now = new Date().toISOString();
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('INSERT INTO posts (id, author_id, type, content, created_at) VALUES (?, ?, ?, ?, ?)').run(id, userId, post.type, post.content, now);
        if (post.activity) {
          const a = post.activity;
          db.prepare('INSERT INTO consent_records VALUES (?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), id, userId, 'publish-meeting-location', 'location-v1', now, ip);
          db.prepare('INSERT INTO activities (post_id,title,starts_at,location,capacity,category,meeting,lat,lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, a.title, a.startsAt, a.location, a.capacity,a.category || 'sport',a.meeting || '',a.lat ?? null,a.lng ?? null);
          db.prepare("INSERT INTO participants (activity_id, user_id, role, status, joined_at) VALUES (?, ?, 'host', 'joined', ?)").run(id, userId, now);
        }
        db.prepare('INSERT INTO audit_logs VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), id, userId, 'post.create', now, ip);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return this.get(id, userId);
    },

    // The author edits a post. An activity keeps its type, cannot start in the past, cannot shrink below the people
    // already in it, and cannot be edited once it has started. The meeting place needs the location consent again.
    update(id, post, { userId, ip }) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const row = db.prepare('SELECT p.*, a.starts_at FROM posts p LEFT JOIN activities a ON a.post_id = p.id WHERE p.id = ?').get(id);
        if (!row || row.deleted_at) throw new HttpError(404, 'not-found', 'ไม่พบโพสต์นี้');
        if (row.author_id !== userId) throw new HttpError(403, 'not-owner', 'แก้ไขได้เฉพาะโพสต์ของตัวเอง');
        if (row.type !== post.type) throw new HttpError(400, 'type-change', 'เปลี่ยนประเภทโพสต์ไม่ได้');
        const time = new Date().toISOString();
        if (post.activity) {
          if (row.starts_at <= time) throw new HttpError(409, 'started', 'กิจกรรมเริ่มไปแล้ว แก้ไขไม่ได้');
          const joined = db.prepare("SELECT count(*) AS n FROM participants WHERE activity_id = ? AND status = 'joined'").get(id).n;
          if (post.activity.capacity < joined) throw new HttpError(409, 'capacity-below-joined', `มีผู้เข้าร่วมแล้ว ${joined} คน ตั้งจำนวนต่ำกว่านี้ไม่ได้`);
          const a = post.activity;
          db.prepare('UPDATE activities SET title = ?, starts_at = ?, location = ?, capacity = ?, category = ?, meeting = ?, lat = ?, lng = ? WHERE post_id = ?')
            .run(a.title, a.startsAt, a.location, a.capacity, a.category || 'sport', a.meeting || '', a.lat ?? null, a.lng ?? null, id);
          db.prepare('INSERT INTO consent_records VALUES (?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), id, userId, 'publish-meeting-location', 'location-v1', time, ip);
        }
        db.prepare('UPDATE posts SET content = ?, updated_at = ? WHERE id = ?').run(post.content, time, id);
        db.prepare('INSERT INTO audit_logs VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), id, userId, 'post.update', time, ip);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return this.get(id, userId);
    },

    // The author deletes a post; for an activity this cancels it. Participant rows stay for the history.
    remove(id, { userId, ip }) {
      const row = db.prepare('SELECT author_id, deleted_at FROM posts WHERE id = ?').get(id);
      if (!row || row.deleted_at) throw new HttpError(404, 'not-found', 'ไม่พบโพสต์นี้');
      if (row.author_id !== userId) throw new HttpError(403, 'not-owner', 'ลบได้เฉพาะโพสต์ของตัวเอง');
      const time = new Date().toISOString();
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('UPDATE posts SET deleted_at = ? WHERE id = ?').run(time, id);
        db.prepare('INSERT INTO audit_logs VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), id, userId, 'post.delete', time, ip);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    close() { db.close(); }
  };
}
