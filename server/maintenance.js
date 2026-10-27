// Daily clean-up (also run once at start-up):
//   - deleted accounts whose 90-day archive has ended: the archived email is deleted, the email hash is removed from
//     sign-in logs, and the content of their posts is cleared, so the remaining rows no longer identify anyone
//   - expired sign-in codes and sessions are deleted
// Access/traffic logs themselves are kept; nothing here removes a log row (rule.md: at least 90 days).
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { reminderEmail } from './notifications.js';

export function runMaintenance(db, at = new Date()) {
  const time = at.toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    const due = db.prepare('SELECT user_id FROM deleted_accounts WHERE purge_after <= ?').all(time);
    for (const { user_id: userId } of due) {
      db.prepare('UPDATE auth_logs SET email_hash = NULL WHERE user_id = ?').run(userId);
      db.prepare("UPDATE posts SET content = '[ลบแล้ว]' WHERE author_id = ?").run(userId);
      db.prepare(`UPDATE activities SET title = '[ลบแล้ว]', location = '', meeting = '', lat = NULL, lng = NULL
        WHERE post_id IN (SELECT id FROM posts WHERE author_id = ?)`).run(userId);
      db.prepare("UPDATE reports SET details = '' WHERE reporter_id = ?").run(userId);
      db.prepare('DELETE FROM friendships WHERE requester_id = ? OR addressee_id = ?').run(userId, userId);
      db.prepare("UPDATE appeals SET message = '[ลบแล้ว]' WHERE user_id = ?").run(userId);
      db.prepare("UPDATE recommendation_feedback SET details = '' WHERE user_id = ?").run(userId);
      db.prepare('DELETE FROM deleted_accounts WHERE user_id = ?').run(userId);
    }
    const codes = db.prepare('DELETE FROM login_codes WHERE expires_at <= ?').run(time).changes;
    const sessions = db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(time).changes;
    // Notifications are messages, not logs: kept 180 days (decision recorded in DECISIONS.md).
    const notifications = db.prepare('DELETE FROM notifications WHERE created_at <= ?').run(new Date(at.getTime() - 180 * 86_400_000).toISOString()).changes;
    db.exec('COMMIT');
    return { purgedAccounts: due.length, codes, sessions, notifications };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

// Every minute: activity reminders (F4) and completion records (Scope workflow 6: an activity counts as completed
// three hours after its start; the host is the logged actor and the IP is "system").
export const COMPLETE_AFTER_HOURS = 3;
export async function runMinuteJobs(db, { notifier, mailer = null, security = null, at = new Date() } = {}) {
  const time = at.toISOString();
  const due = db.prepare(`SELECT a.post_id, p.author_id FROM activities a JOIN posts p ON p.id = a.post_id
    WHERE a.completed_at IS NULL AND p.deleted_at IS NULL AND julianday(a.starts_at) <= julianday(?) - ? / 24.0`).all(time, COMPLETE_AFTER_HOURS);
  for (const row of due) {
    db.prepare('UPDATE activities SET completed_at = ? WHERE post_id = ?').run(time, row.post_id);
    db.prepare('INSERT INTO action_logs VALUES (?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), row.author_id, 'activity.complete', 'activity', row.post_id, time, 'system');
  }
  const reminders = notifier ? notifier.dueReminders(at) : [];
  let emailed = 0;
  if (mailer && security) {
    for (const reminder of reminders.filter(r => r.email)) {
      const row = db.prepare('SELECT email_encrypted FROM user_emails WHERE user_id = ?').get(reminder.userId);
      if (!row) continue;
      try { await mailer.send({ to: security.decrypt(row.email_encrypted), ...reminderEmail(reminder.title, reminder.startsAt, reminder.minutes) }); emailed += 1; }
      catch (error) { console.error('Reminder email failed:', error.code || error.name); }
    }
  }
  return { completed: due.length, reminders: reminders.length, emailed };
}

// Daily copy of the database with VACUUM INTO (a consistent snapshot while the server runs). Keeps keepDays copies.
// Backups hold personal data: purged accounts disappear from backups once the oldest copy rolls off.
export function runBackup(db, dir, keepDays, at = new Date()) {
  if (!dir || !keepDays) return null;
  mkdirSync(dir, { recursive: true });
  const day = at.toISOString().slice(0, 10);
  const file = join(dir, `joingun-${day}.sqlite`);
  let created = false;
  if (!existsSync(file)) {
    db.prepare('VACUUM INTO ?').run(file);
    created = true;
  }
  const oldest = new Date(at.getTime() - (keepDays - 1) * 86_400_000).toISOString().slice(0, 10);
  const removed = [];
  for (const name of readdirSync(dir)) {
    const match = name.match(/^joingun-(\d{4}-\d{2}-\d{2})\.sqlite$/);
    if (match && match[1] < oldest) { rmSync(join(dir, name), { force: true }); removed.push(name); }
  }
  return { file, created, removed };
}

export function scheduleMaintenance(db, { log = console.log, notifier = null, mailer = null, security = null, backupDir = '', backupKeepDays = 0 } = {}) {
  const daily = () => {
    try {
      const result = runMaintenance(db);
      if (result.purgedAccounts) log(`Maintenance: purged ${result.purgedAccounts} deleted account(s) after the archive period.`);
    } catch (error) { console.error('Maintenance failed:', error.code || error.name); }
    try {
      const backup = runBackup(db, backupDir, backupKeepDays);
      if (backup?.created) log(`Backup: ${backup.file}`);
    } catch (error) { console.error('Backup failed:', error.code || error.name); }
  };
  let running = false;
  const minute = async () => {
    if (running) return;
    running = true;
    try { await runMinuteJobs(db, { notifier, mailer, security }); }
    catch (error) { console.error('Reminder job failed:', error.code || error.name); }
    finally { running = false; }
  };
  daily();
  minute();
  const timers = [setInterval(daily, 24 * 60 * 60 * 1000), setInterval(minute, 60 * 1000)];
  timers.forEach(timer => timer.unref());
  return () => timers.forEach(clearInterval);
}
