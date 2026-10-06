import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

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
  `);
  // Additive migration: keep all posts created by the earlier MVP.
  const columns = new Set(db.prepare('PRAGMA table_info(activities)').all().map(column=>column.name));
  for (const [name, definition] of Object.entries({category:"TEXT NOT NULL DEFAULT 'sport'",meeting:"TEXT NOT NULL DEFAULT ''",lat:'REAL',lng:'REAL'})) {
    if (!columns.has(name)) db.exec(`ALTER TABLE activities ADD COLUMN ${name} ${definition}`);
  }
  const select = `SELECT p.*, a.title, a.starts_at, a.location, a.capacity, a.category, a.meeting, a.lat, a.lng
    FROM posts p LEFT JOIN activities a ON a.post_id = p.id`;
  const serialize = row => row && ({
    id: row.id, author: { id: row.author_id, name: 'Demo Student' }, type: row.type,
    content: row.content, createdAt: row.created_at,
    activity: row.type === 'activity' ? {title: row.title, startsAt: row.starts_at, location: row.location, capacity: row.capacity,category:row.category,meeting:row.meeting,lat:row.lat,lng:row.lng} : null
  });
  return {
    db,
    get(id) { return serialize(db.prepare(`${select} WHERE p.id = ?`).get(id)); },
    list({limit, before}) {
      const rows = db.prepare(`${select} WHERE p.sequence < ? ORDER BY p.sequence DESC LIMIT ?`).all(before, limit + 1);
      const page = rows.slice(0, limit);
      return {items: page.map(serialize), nextCursor: rows.length > limit ? String(page.at(-1).sequence) : null};
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
        }
        db.prepare('INSERT INTO audit_logs VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), id, userId, 'post.create', now, ip);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return this.get(id);
    },
    close() { db.close(); }
  };
}
