import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { HttpError } from './errors.js';

// Everything stored in the database goes through the small async API below, whichever engine runs underneath:
//   - PostgreSQL (Railway) through `pg`, when the target is a postgres:// URL (production);
//   - PGlite (PostgreSQL compiled to WebAssembly) for development and tests, when the target is a folder or ':memory:'.
// SQL is written with "?" placeholders; they are turned into $1, $2, … here. Inside db.transaction() use only the
// `tx` object the callback receives: a query on the outer `db` runs on another connection and cannot see the changes.

// "?" → "$n", leaving question marks inside quoted strings alone.
export function toPositional(sql) {
  let n = 0, quoted = false, out = '';
  for (const char of sql) {
    if (char === "'") quoted = !quoted;
    out += char === '?' && !quoted ? `$${++n}` : char;
  }
  return out;
}

const clean = params => params.map(value => value === undefined ? null : value);

// backend: { query(sql, params) -> { rows, count }, exec(sql), transaction(work(backend)), close() }
function wrap(backend) {
  const run = (sql, params) => backend.query(toPositional(sql), clean(params));
  return {
    prepare: sql => ({
      get: async (...params) => (await run(sql, params)).rows[0],
      all: async (...params) => (await run(sql, params)).rows,
      run: async (...params) => ({ changes: (await run(sql, params)).count }),
    }),
    exec: sql => backend.exec(sql),
    transaction: work => backend.transaction(inner => work(wrap(inner))),
    close: () => backend.close(),
  };
}

// Railway's private network (…railway.internal) and local servers need no TLS; Railway's public proxy does.
function sslFor(url, override) {
  if (override === 'false' || override === '0') return false;
  if (override === 'true' || override === '1') return { rejectUnauthorized: false };
  const host = new URL(url).hostname;
  return /(^localhost$|^127\.|^\[?::1\]?$|\.railway\.internal$)/.test(host) ? false : { rejectUnauthorized: false };
}

async function openPostgres(url, { ssl } = {}) {
  const { default: pg } = await import('pg');
  pg.types.setTypeParser(20, Number); // bigint (count(*), sequence) as a JS number
  const pool = new pg.Pool({ connectionString: url, ssl: sslFor(url, ssl), max: 10 });
  // An idle connection dropped by the database (for example while Railway restarts it) must not crash the server.
  pool.on('error', error => console.error('Database connection error:', error.code || error.name));
  const on = client => ({
    async query(sql, params) { const result = await client.query(sql, params); return { rows: result.rows, count: result.rowCount ?? 0 }; },
    exec: sql => client.query(sql),
  });
  return {
    ...on(pool),
    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await work(on(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch { /* connection already gone */ }
        throw error;
      } finally { client.release(); }
    },
    close: () => pool.end(),
  };
}

async function openPglite(target) {
  let PGlite;
  try { ({ PGlite } = await import('@electric-sql/pglite')); }
  catch { throw new Error('@electric-sql/pglite is not installed. Run "npm install", or set DATABASE_URL to a PostgreSQL database.'); }
  if (target !== ':memory:') mkdirSync(dirname(resolve(target)), { recursive: true });
  const pglite = new PGlite(target === ':memory:' ? undefined : target, { parsers: { 20: value => Number(value) } });
  await pglite.waitReady;
  const on = client => ({
    async query(sql, params) { const result = await client.query(sql, params); return { rows: result.rows, count: result.affectedRows ?? 0 }; },
    exec: async sql => { await client.exec(sql); },
  });
  return {
    ...on(pglite),
    transaction: work => pglite.transaction(tx => work(on(tx))),
    close: () => pglite.close(),
  };
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS posts (
    sequence BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id TEXT NOT NULL UNIQUE,
    author_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('text','activity')),
    content TEXT NOT NULL CHECK(length(content) BETWEEN 1 AND 5000),
    created_at TEXT NOT NULL,
    deleted_at TEXT,
    updated_at TEXT
  );
  CREATE TABLE IF NOT EXISTS activities (
    post_id TEXT PRIMARY KEY REFERENCES posts(id),
    title TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    location TEXT NOT NULL,
    capacity INTEGER NOT NULL CHECK(capacity BETWEEN 2 AND 1000),
    category TEXT NOT NULL DEFAULT 'sport',
    meeting TEXT NOT NULL DEFAULT '',
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    -- Set by the maintenance job a few hours after the start time (Scope workflow 6: the system logs completion).
    completed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS consent_records (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES posts(id),
    user_id TEXT NOT NULL,
    purpose TEXT NOT NULL,
    terms_version TEXT NOT NULL,
    created_at TEXT NOT NULL,
    ip_address TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES posts(id),
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at TEXT NOT NULL,
    ip_address TEXT NOT NULL
  );
  -- Accounts. The email lives only in user_emails: a keyed hash for lookup and an encrypted copy for account
  -- recovery, never next to posts or activity history (rule.md, PDPA).
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE CHECK(username IS NULL OR username ~ '^[a-z0-9_]*'),
    display_name TEXT,
    year TEXT CHECK(year IS NULL OR year IN ('1','2','3','4','other')),
    interests TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL CHECK(status IN ('pending','active','deleted')),
    terms_version TEXT,
    privacy_version TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    bio TEXT NOT NULL DEFAULT '',
    -- Who may see the activities a person joined (F5): everyone, friends only, or only the person.
    history_visibility TEXT NOT NULL DEFAULT 'private' CHECK(history_visibility IN ('public','friends','private')),
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','moderator')),
    suspended_at TEXT,
    suspended_reason TEXT NOT NULL DEFAULT '',
    -- Encrypted optional profile fields (server/profile-crypto.js); the plain year/interests/bio columns stay empty.
    year_enc TEXT,
    interests_enc TEXT,
    bio_enc TEXT,
    -- Notification settings (backlog 4.2).
    notify_reminders INTEGER NOT NULL DEFAULT 1,
    notify_email INTEGER NOT NULL DEFAULT 0,
    reminder_minutes INTEGER NOT NULL DEFAULT 60
  );
  CREATE TABLE IF NOT EXISTS user_emails (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    email_hash TEXT NOT NULL UNIQUE,
    email_encrypted TEXT NOT NULL,
    verified_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS login_codes (
    email_hash TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    ip_address TEXT NOT NULL
  );
  -- Evidence of each "I agree" (rule.md, Computer Crime Act section). Rows are only ever inserted.
  CREATE TABLE IF NOT EXISTS terms_acceptances (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    terms_version TEXT NOT NULL,
    privacy_version TEXT NOT NULL,
    accepted_at TEXT NOT NULL,
    ip_address TEXT NOT NULL
  );
  -- Login, logout and code requests with user_id (when known), UTC time, source IP and outcome. Not pruned.
  CREATE TABLE IF NOT EXISTS auth_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    email_hash TEXT,
    action TEXT NOT NULL,
    auth_status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    source_ip TEXT NOT NULL
  );
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
  );
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
  );
  -- Blocks hide the blocked person's posts from the blocker. Unblocking sets removed_at; rows are kept.
  CREATE TABLE IF NOT EXISTS blocks (
    id TEXT PRIMARY KEY,
    blocker_id TEXT NOT NULL,
    blocked_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    removed_at TEXT,
    ip_address TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS blocks_active ON blocks(blocker_id, blocked_id) WHERE removed_at IS NULL;
  -- Withdrawals of a per-user consent. The consent counts only if granted after the latest withdrawal.
  CREATE TABLE IF NOT EXISTS consent_withdrawals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    purpose TEXT NOT NULL,
    withdrawn_at TEXT NOT NULL,
    ip_address TEXT NOT NULL
  );
  -- Deleted accounts: the email moves here (encrypted) and is purged 90 days later (rule.md: archive >= 90 days,
  -- then delete or make unidentifiable). The same address can sign up again as a new account meanwhile.
  CREATE TABLE IF NOT EXISTS deleted_accounts (
    user_id TEXT PRIMARY KEY,
    email_hash TEXT NOT NULL,
    email_encrypted TEXT NOT NULL,
    deleted_at TEXT NOT NULL,
    purge_after TEXT NOT NULL,
    ip_address TEXT NOT NULL
  );
  -- Per-user consents that are not tied to one post (e.g. keeping participation history, LR1). Insert-only.
  CREATE TABLE IF NOT EXISTS user_consents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    purpose TEXT NOT NULL,
    version TEXT NOT NULL,
    granted_at TEXT NOT NULL,
    ip_address TEXT NOT NULL
  );
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
  );
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
  );
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
  );
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
  );
  -- Moderator decisions on reports. Reports themselves stay insert-only.
  CREATE TABLE IF NOT EXISTS report_reviews (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES reports(id),
    moderator_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('dismiss','remove-post','suspend-user')),
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    ip_address TEXT NOT NULL
  );
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
  );
`;

// Command-line scripts: the database named by DATABASE_URL, else the local PGlite folder (same default as the server).
export const openDatabaseFromEnv = (env, localFolder) => openDatabase(env.DATABASE_URL?.trim() || localFolder, { ssl: env.DATABASE_SSL });

// target: a postgres:// URL (Railway), a folder for a local PGlite database, or ':memory:' (tests).
export async function openDatabase(target, options = {}) {
  const backend = /^postgres(ql)?:\/\//i.test(target) ? await openPostgres(target, options) : await openPglite(target);
  const db = wrap(backend);
  // options.reset (tests only, with a throw-away PostgreSQL database): start from an empty schema.
  if (options.reset) await db.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await db.exec(SCHEMA);
  // The first placeholder is the viewer's user id (or null), so each post says whether the viewer takes part.
  const select = `SELECT p.*, a.title, a.starts_at, a.location, a.capacity, a.category, a.meeting, a.lat, a.lng, a.completed_at,
      u.display_name AS author_name, u.username AS author_username, u.status AS author_status,
      (SELECT count(*) FROM participants c WHERE c.activity_id = p.id AND c.status = 'joined') AS joined_count,
      vp.role AS viewer_role, vp.status AS viewer_status
    FROM posts p LEFT JOIN activities a ON a.post_id = p.id LEFT JOIN users u ON u.id = p.author_id
      LEFT JOIN participants vp ON vp.activity_id = p.id AND vp.user_id = ?`;
  const serialize = row => row && ({
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
  const store = {
    db,
    async get(id, viewerId = null) { return serialize(await db.prepare(`${select} WHERE p.id = ?`).get(viewerId, id)); },
    // scope: 'all' | 'friends' (posts by the viewer's friends). authorId: one person's posts (profile page).
    // open: only activities that have not started and still have places.
    async list({limit, before, category = 'all', date = '', q = '', viewerId = null, authorId = null, scope = 'all', open = false}) {
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
        // Stored times are UTC ISO strings (…Z), which sort the same as the instants they name.
        const start = new Date(`${date}T00:00:00+07:00`);
        where.push('COALESCE(a.starts_at, p.created_at) >= ? AND COALESCE(a.starts_at, p.created_at) < ?');
        params.push(start.toISOString(), new Date(start.getTime() + 86400000).toISOString());
      }
      if (q) {
        const pattern = `%${q.replace(/[\\%_]/g, char => `\\${char}`)}%`;
        where.push("(p.content ILIKE ? ESCAPE '\\' OR a.title ILIKE ? ESCAPE '\\' OR a.location ILIKE ? ESCAPE '\\' OR a.meeting ILIKE ? ESCAPE '\\')");
        params.push(pattern, pattern, pattern, pattern);
      }
      // Hidden from the feed: deleted posts, posts of deleted accounts, and authors the viewer has blocked.
      where.unshift("p.deleted_at IS NULL", "(u.status IS NULL OR u.status != 'deleted')",
        'NOT EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = ? AND b.blocked_id = p.author_id AND b.removed_at IS NULL)');
      params.unshift(viewerId ?? '');
      const filter = `AND ${where.join(' AND ')}`;
      const rows = await db.prepare(`${select} WHERE p.sequence < ? ${filter} ORDER BY p.sequence DESC LIMIT ?`).all(viewerId, before, ...params, limit + 1);
      const {total} = await db.prepare(`SELECT count(*) AS total FROM posts p LEFT JOIN activities a ON a.post_id = p.id LEFT JOIN users u ON u.id = p.author_id WHERE TRUE ${filter}`).get(...params);
      const page = rows.slice(0, limit);
      return {items: page.map(serialize), nextCursor: rows.length > limit ? String(page.at(-1).sequence) : null, total};
    },
    async create(post, { userId, ip }) {
      const id = randomUUID(), now = new Date().toISOString();
      await db.transaction(async tx => {
        await tx.prepare('INSERT INTO posts (id, author_id, type, content, created_at) VALUES (?, ?, ?, ?, ?)').run(id, userId, post.type, post.content, now);
        if (post.activity) {
          const a = post.activity;
          await tx.prepare('INSERT INTO consent_records VALUES (?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), id, userId, 'publish-meeting-location', 'location-v1', now, ip);
          await tx.prepare('INSERT INTO activities (post_id,title,starts_at,location,capacity,category,meeting,lat,lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, a.title, a.startsAt, a.location, a.capacity,a.category || 'sport',a.meeting || '',a.lat ?? null,a.lng ?? null);
          await tx.prepare("INSERT INTO participants (activity_id, user_id, role, status, joined_at) VALUES (?, ?, 'host', 'joined', ?)").run(id, userId, now);
        }
        await tx.prepare('INSERT INTO audit_logs VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), id, userId, 'post.create', now, ip);
      });
      return store.get(id, userId);
    },

    // The author edits a post. An activity keeps its type, cannot start in the past, cannot shrink below the people
    // already in it, and cannot be edited once it has started. The meeting place needs the location consent again.
    async update(id, post, { userId, ip }) {
      await db.transaction(async tx => {
        const row = await tx.prepare('SELECT p.*, a.starts_at FROM posts p LEFT JOIN activities a ON a.post_id = p.id WHERE p.id = ? FOR UPDATE OF p').get(id);
        if (!row || row.deleted_at) throw new HttpError(404, 'not-found', 'ไม่พบโพสต์นี้');
        if (row.author_id !== userId) throw new HttpError(403, 'not-owner', 'แก้ไขได้เฉพาะโพสต์ของตัวเอง');
        if (row.type !== post.type) throw new HttpError(400, 'type-change', 'เปลี่ยนประเภทโพสต์ไม่ได้');
        const time = new Date().toISOString();
        if (post.activity) {
          if (row.starts_at <= time) throw new HttpError(409, 'started', 'กิจกรรมเริ่มไปแล้ว แก้ไขไม่ได้');
          const joined = (await tx.prepare("SELECT count(*) AS n FROM participants WHERE activity_id = ? AND status = 'joined'").get(id)).n;
          if (post.activity.capacity < joined) throw new HttpError(409, 'capacity-below-joined', `มีผู้เข้าร่วมแล้ว ${joined} คน ตั้งจำนวนต่ำกว่านี้ไม่ได้`);
          const a = post.activity;
          await tx.prepare('UPDATE activities SET title = ?, starts_at = ?, location = ?, capacity = ?, category = ?, meeting = ?, lat = ?, lng = ? WHERE post_id = ?')
            .run(a.title, a.startsAt, a.location, a.capacity, a.category || 'sport', a.meeting || '', a.lat ?? null, a.lng ?? null, id);
          await tx.prepare('INSERT INTO consent_records VALUES (?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), id, userId, 'publish-meeting-location', 'location-v1', time, ip);
        }
        await tx.prepare('UPDATE posts SET content = ?, updated_at = ? WHERE id = ?').run(post.content, time, id);
        await tx.prepare('INSERT INTO audit_logs VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), id, userId, 'post.update', time, ip);
      });
      return store.get(id, userId);
    },

    // The author deletes a post; for an activity this cancels it. Participant rows stay for the history.
    async remove(id, { userId, ip }) {
      const row = await db.prepare('SELECT author_id, deleted_at FROM posts WHERE id = ?').get(id);
      if (!row || row.deleted_at) throw new HttpError(404, 'not-found', 'ไม่พบโพสต์นี้');
      if (row.author_id !== userId) throw new HttpError(403, 'not-owner', 'ลบได้เฉพาะโพสต์ของตัวเอง');
      const time = new Date().toISOString();
      await db.transaction(async tx => {
        await tx.prepare('UPDATE posts SET deleted_at = ? WHERE id = ?').run(time, id);
        await tx.prepare('INSERT INTO audit_logs VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), id, userId, 'post.delete', time, ip);
      });
    },
    close() { return db.close(); }
  };
  return store;
}
