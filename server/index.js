import { fileURLToPath } from 'node:url';
import { openDatabase } from './database.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT.');
const store = openDatabase(process.env.DATABASE_PATH || fileURLToPath(new URL('../data/joingun.sqlite', import.meta.url)));
// Local demo only: no public deployment or authentication is implied.
const server = createApp(store).listen(port, '127.0.0.1', () => console.log(`JoinGun posting MVP: http://127.0.0.1:${port}`));
server.on('error', error => { console.error(error.message); store.close(); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { store.close(); process.exit(0); }));
