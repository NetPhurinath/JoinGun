// Bias check for recommendations (rule.md: evaluate model outputs for unfair treatment across user groups):
//   npm run bias-report
// For every account with the AI-recommendation consent, runs the same recommender the app uses and compares who
// gets recommended against what was available: share of recommended activities by host year and by category, and
// average number of recommendations by the viewer's year. Prints counts only, no names.
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../database.js';
import { createNotifier } from '../notifications.js';
import { createSocial } from '../social.js';
import { createRecommender, AI_CONSENT } from '../recommend.js';
import { consentState } from '../participation.js';
import { openProfile } from '../profile-crypto.js';
import { createSecurity } from '../security.js';
import { loadConfig } from '../config.js';

try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const config = loadConfig(process.env, { devSecretFile: fileURLToPath(new URL('../../data/dev-secret.txt', import.meta.url)) });
const security = createSecurity(config.secret);
const store = openDatabase(process.env.DATABASE_PATH || fileURLToPath(new URL('../../data/joingun.sqlite', import.meta.url)));
const { db } = store;
const social = createSocial(db, createNotifier(db), security);
const recommender = createRecommender(store, social);
// Year is stored encrypted (server/profile-crypto.js); decrypt it with the app's key.
const yearOf = id => openProfile(security, db.prepare('SELECT * FROM users WHERE id = ?').get(id)).year ?? 'not given';
const now = new Date().toISOString();
const available = db.prepare(`SELECT p.id, p.author_id, a.category FROM posts p JOIN activities a ON a.post_id = p.id
  JOIN users u ON u.id = p.author_id WHERE p.deleted_at IS NULL AND u.status = 'active' AND a.starts_at > ?`).all(now);
const viewers = db.prepare("SELECT id FROM users WHERE status = 'active' AND username IS NOT NULL").all()
  .filter(({ id }) => consentState(db, id, AI_CONSENT).active);

const tally = () => new Map();
const add = (map, key) => map.set(key, (map.get(key) || 0) + 1);
const availableByHostYear = tally(), availableByCategory = tally();
for (const post of available) { add(availableByHostYear, yearOf(post.author_id)); add(availableByCategory, post.category); }
const recByHostYear = tally(), recByCategory = tally(), perViewerYear = new Map();
let totalRecs = 0;
for (const { id } of viewers) {
  const { items } = recommender.recommend(id, 50);
  const year = yearOf(id);
  const entry = perViewerYear.get(year) || { viewers: 0, recommendations: 0 };
  entry.viewers += 1; entry.recommendations += items.length; perViewerYear.set(year, entry);
  for (const item of items) {
    totalRecs += 1;
    add(recByHostYear, yearOf(item.post.author.id));
    add(recByCategory, item.post.activity.category);
  }
}

const share = (map, key, total) => (total ? `${((100 * (map.get(key) || 0)) / total).toFixed(1)}%` : '-');
const compare = (availableMap, recMap) => Object.fromEntries([...new Set([...availableMap.keys(), ...recMap.keys()])].sort().map(key => [key, {
  available: availableMap.get(key) || 0, 'share available': share(availableMap, key, available.length),
  recommended: recMap.get(key) || 0, 'share recommended': share(recMap, key, totalRecs),
}]));

console.log(`Bias report ${now}: ${viewers.length} people with recommendations on, ${available.length} upcoming activities, ${totalRecs} recommendations.`);
if (!viewers.length) console.log('Nobody has turned recommendations on yet; nothing to compare.');
console.log('\nBy host year (large gaps between the two shares deserve a look):');
console.table(compare(availableByHostYear, recByHostYear));
console.log('By category:');
console.table(compare(availableByCategory, recByCategory));
console.log("Average recommendations per person, by the viewer's year:");
console.table(Object.fromEntries([...perViewerYear].map(([year, e]) => [year, { people: e.viewers, average: (e.recommendations / e.viewers).toFixed(1) }])));
console.log('The model does not use year, gender or faculty; differences come from interests, friends and past participation. Gender and faculty are not collected, so they cannot be checked.');
store.close();
