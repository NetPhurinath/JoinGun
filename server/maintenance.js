// Daily clean-up (also run once at start-up):
//   - deleted accounts whose 90-day archive has ended: the archived email is deleted, the email hash is removed from
//     sign-in logs, and the content of their posts is cleared, so the remaining rows no longer identify anyone
//   - expired sign-in codes and sessions are deleted
// Access/traffic logs themselves are kept; nothing here removes a log row (rule.md: at least 90 days).
// Database backups are not made here: the PostgreSQL service (Railway) keeps them.
import { randomUUID } from 'node:crypto';
import { reminderEmail } from './notifications.js';

export async function runMaintenance(db, at = new Date()) {
  const time = at.toISOString();
  return db.transaction(async tx => {
    const due = await tx.prepare('SELECT user_id FROM deleted_accounts WHERE purge_after <= ?').all(time);
    for (const { user_id: userId } of due) {
      await tx.prepare('UPDATE auth_logs SET email_hash = NULL WHERE user_id = ?').run(userId);
      await tx.prepare("UPDATE posts SET content = '[ลบแล้ว]' WHERE author_id = ?").run(userId);
      await tx.prepare(`UPDATE activities SET title = '[ลบแล้ว]', location = '', meeting = '', lat = NULL, lng = NULL
        WHERE post_id IN (SELECT id FROM posts WHERE author_id = ?)`).run(userId);
      await tx.prepare("UPDATE reports SET details = '' WHERE reporter_id = ?").run(userId);
      await tx.prepare('DELETE FROM friendships WHERE requester_id = ? OR addressee_id = ?').run(userId, userId);
      await tx.prepare("UPDATE appeals SET message = '[ลบแล้ว]' WHERE user_id = ?").run(userId);
      await tx.prepare("UPDATE recommendation_feedback SET details = '' WHERE user_id = ?").run(userId);
      await tx.prepare('DELETE FROM deleted_accounts WHERE user_id = ?').run(userId);
    }
    const codes = (await tx.prepare('DELETE FROM login_codes WHERE expires_at <= ?').run(time)).changes;
    const sessions = (await tx.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(time)).changes;
    // Notifications are messages, not logs: kept 180 days (decision recorded in DECISIONS.md).
    const notifications = (await tx.prepare('DELETE FROM notifications WHERE created_at <= ?').run(new Date(at.getTime() - 180 * 86_400_000).toISOString())).changes;
    return { purgedAccounts: due.length, codes, sessions, notifications };
  });
}

// Every minute: activity reminders (F4) and completion records (Scope workflow 6: an activity counts as completed
// three hours after its start; the host is the logged actor and the IP is "system").
export const COMPLETE_AFTER_HOURS = 3;
export async function runMinuteJobs(db, { notifier, mailer = null, security = null, at = new Date() } = {}) {
  const time = at.toISOString();
  // Stored times are UTC ISO strings, so a plain comparison orders them by instant.
  const startedBefore = new Date(at.getTime() - COMPLETE_AFTER_HOURS * 3_600_000).toISOString();
  const due = await db.prepare(`SELECT a.post_id, p.author_id FROM activities a JOIN posts p ON p.id = a.post_id
    WHERE a.completed_at IS NULL AND p.deleted_at IS NULL AND a.starts_at <= ?`).all(startedBefore);
  for (const row of due) {
    await db.transaction(async tx => {
      const done = await tx.prepare('UPDATE activities SET completed_at = ? WHERE post_id = ? AND completed_at IS NULL').run(time, row.post_id);
      if (done.changes) await tx.prepare('INSERT INTO action_logs VALUES (?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), row.author_id, 'activity.complete', 'activity', row.post_id, time, 'system');
    });
  }
  const reminders = notifier ? await notifier.dueReminders(at) : [];
  let emailed = 0;
  if (mailer && security) {
    for (const reminder of reminders.filter(r => r.email)) {
      const row = await db.prepare('SELECT email_encrypted FROM user_emails WHERE user_id = ?').get(reminder.userId);
      if (!row) continue;
      try { await mailer.send({ to: security.decrypt(row.email_encrypted), ...reminderEmail(reminder.title, reminder.startsAt, reminder.minutes) }); emailed += 1; }
      catch (error) { console.error('Reminder email failed:', error.code || error.name); }
    }
  }
  return { completed: due.length, reminders: reminders.length, emailed };
}

export function scheduleMaintenance(db, { log = console.log, notifier = null, mailer = null, security = null } = {}) {
  const daily = async () => {
    try {
      const result = await runMaintenance(db);
      if (result.purgedAccounts) log(`Maintenance: purged ${result.purgedAccounts} deleted account(s) after the archive period.`);
    } catch (error) { console.error('Maintenance failed:', error.code || error.name); }
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
