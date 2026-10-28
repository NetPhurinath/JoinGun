// Makes an existing account a moderator (or removes the role): npm run moderator -- <username> [--remove]
// Uses the same DATABASE_URL as the server (local PGlite database when it is not set).
// The change is written to action_logs with IP "cli".
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDatabaseFromEnv } from '../database.js';

try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const [username, flag] = process.argv.slice(2);
if (!username) { console.error('Usage: npm run moderator -- <username> [--remove]'); process.exit(1); }
const store = await openDatabaseFromEnv(process.env, fileURLToPath(new URL('../../data/pglite/', import.meta.url)));
const user = await store.db.prepare("SELECT id FROM users WHERE username = ? AND status = 'active'").get(username.replace(/^@/, '').toLowerCase());
if (!user) { console.error(`No active account @${username}.`); await store.close(); process.exit(1); }
const role = flag === '--remove' ? 'user' : 'moderator';
await store.db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user.id);
await store.db.prepare('INSERT INTO action_logs VALUES (?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), user.id, `role.${role}`, 'user', user.id, new Date().toISOString(), 'cli');
console.log(`@${username} is now ${role === 'moderator' ? 'a moderator' : 'a regular user'}. Sign out and in again if the menu does not update.`);
await store.close();
