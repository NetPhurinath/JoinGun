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
const store = openDatabase(process.env.DATABASE_PATH || fileURLToPath(new URL('joingun.sqlite', dataDir)));
const app = createApp(store, { config, mailer });

scheduleMaintenance(store.db, {
  notifier: app.locals.notifier, mailer: useGmail ? mailer : null, security: app.locals.security,
  backupDir: config.backupDir || fileURLToPath(new URL('backups/', dataDir)), backupKeepDays: config.backupKeepDays,
});

const server = app.listen(port, config.host, () => {
  console.log(`JoinGun: http://${config.host === '0.0.0.0' ? '127.0.0.1' : config.host}:${port}  (email: ${useGmail ? `Gmail ${config.gmailUser}` : 'console, development only'}; backups: ${config.backupKeepDays ? `${config.backupKeepDays} days` : 'off'})`);
});
server.on('error', error => { console.error(error.message); store.close(); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { store.close(); process.exit(0); }));
