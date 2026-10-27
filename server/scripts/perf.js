// Load check for NFR1 (feed within 2 s) and NFR4 (API within 3 s with many users):
//   npm run perf -- --url http://127.0.0.1:3000 --users 200 --seconds 20
// Each virtual user loops: GET /api/posts (first page), then GET /api/posts/:id for one activity on it.
// Run it against the deployed host for real numbers; on a laptop the client and server share one machine.
// Note: GET requests are not rate limited, so the numbers measure the server, not the limiter.
const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map(part => part.trim().split(/\s+/)));
const url = (args.url || 'http://127.0.0.1:3000').replace(/\/$/, '');
const users = Number(args.users || 100);
const seconds = Number(args.seconds || 15);
if (!Number.isInteger(users) || users < 1 || users > 5000 || !(seconds > 0)) { console.error('Use --users 1..5000 and --seconds > 0'); process.exit(1); }

const samples = { feed: [], detail: [] };
let errors = 0, requests = 0;
const deadline = Date.now() + seconds * 1000;

async function timed(kind, path) {
  const start = performance.now();
  try {
    const response = await fetch(url + path);
    const body = await response.json();
    requests += 1;
    if (!response.ok) { errors += 1; return null; }
    samples[kind].push(performance.now() - start);
    return body;
  } catch { errors += 1; requests += 1; return null; }
}

async function user() {
  while (Date.now() < deadline) {
    const page = await timed('feed', '/api/posts?limit=20');
    const activity = page?.items?.find(post => post.activity);
    if (activity) await timed('detail', `/api/posts/${encodeURIComponent(activity.id)}`);
  }
}

const pct = (list, p) => {
  if (!list.length) return NaN;
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};
const ms = value => (Number.isNaN(value) ? '-' : `${Math.round(value)} ms`);

console.log(`JoinGun load check: ${users} users for ${seconds}s against ${url}`);
await Promise.all(Array.from({ length: users }, user));
const report = kind => ({ requests: samples[kind].length, p50: ms(pct(samples[kind], 50)), p95: ms(pct(samples[kind], 95)), max: ms(Math.max(...samples[kind])) });
console.table({ 'GET /api/posts (NFR1, target ≤ 2000 ms)': report('feed'), 'GET /api/posts/:id (NFR4, target ≤ 3000 ms)': report('detail') });
console.log(`Total ${requests} requests, ${errors} errors (${requests ? ((errors / requests) * 100).toFixed(2) : 0}%), ${(requests / seconds).toFixed(1)} req/s`);
const feedP95 = pct(samples.feed, 95), detailP95 = pct(samples.detail, 95);
console.log(`NFR1 feed p95 ${feedP95 <= 2000 ? 'PASS' : 'FAIL'} · NFR4 API p95 ${Math.max(feedP95, detailP95) <= 3000 ? 'PASS' : 'FAIL'} (server-side only; 4G network time is not included)`);
