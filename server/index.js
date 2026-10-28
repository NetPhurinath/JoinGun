import { fileURLToPath } from 'node:url';
import { openDatabase } from './database.js';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createGmailMailer, createConsoleMailer } from './mailer.js';
import { scheduleMaintenance } from './maintenance.js';

// Optional .env in the working directory (Node's built-in loader; no dotenv package).
try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT.');
const dataDir = new URL('../data/', import.meta.url);
const config = loadConfig(process.env, { devSecretFile: fileURLToPath(new URL('dev-secret.txt', dataDir)) });
const useGmail = Boolean(config.gmailUser && config.gmailAppPassword);
let mailer = createConsoleMailer();
if (useGmail) {
  let nodemailer;
  try { nodemailer = await import('nodemailer'); }
  catch { throw new Error('nodemailer is not installed. Run "npm install" in the project folder, then start again.'); }
  mailer = createGmailMailer({ user: config.gmailUser, appPassword: config.gmailAppPassword, fromName: config.mailFromName }, nodemailer.createTransport);
}
// PostgreSQL when DATABASE_URL is set (Render); otherwise a local PGlite database in data/ for development.
const databaseTarget = config.databaseUrl || fileURLToPath(new URL('pglite/', dataDir));
const store = await openDatabase(databaseTarget, { ssl: config.databaseSsl });
const app = createApp(store, { config, mailer });

scheduleMaintenance(store.db, { notifier: app.locals.notifier, mailer: useGmail ? mailer : null, security: app.locals.security });

const server = app.listen(port, config.host, () => {
  console.log(`JoinGun: http://${config.host === '0.0.0.0' ? '127.0.0.1' : config.host}:${port}  (email: ${useGmail ? `Gmail ${config.gmailUser}` : 'console, development only'}; database: ${config.databaseUrl ? 'PostgreSQL' : 'local PGlite, development only'})`);
});
server.on('error', async error => { console.error(error.message); await store.close(); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await store.close(); process.exit(0); }));
