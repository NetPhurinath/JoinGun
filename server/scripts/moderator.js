// Makes an existing account a moderator (or removes the role): npm run moderator -- <username> [--remove]
// Uses the same DATABASE_PATH as the server. The change is written to action_logs with IP "cli".
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../database.js';

try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const [username, flag] = process.argv.slice(2);
if (!username) { console.error('Usage: npm run moderator -- <username> [--remove]'); process.exit(1); }
const store = openDatabase(process.env.DATABASE_PATH || fileURLToPath(new URL('../../data/joingun.sqlite', import.meta.url)));
const user = store.db.prepare("SELECT id FROM users WHERE username = ? AND status = 'active'").get(username.replace(/^@/, '').toLowerCase());
if (!user) { console.error(`No active account @${username}.`); store.close(); process.exit(1); }
const role = flag === '--remove' ? 'user' : 'moderator';
store.db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user.id);
store.db.prepare('INSERT INTO action_logs VALUES (?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), user.id, `role.${role}`, 'user', user.id, new Date().toISOString(), 'cli');
console.log(`@${username} is now ${role === 'moderator' ? 'a moderator' : 'a regular user'}. Sign out and in again if the menu does not update.`);
store.close();
