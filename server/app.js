import express from 'express';
import { fileURLToPath } from 'node:url';
import { validatePost, ValidationError } from './validation.js';

export function createApp(store) {
  const app = express();
  app.disable('x-powered-by');
  // No proxy trust, user identity from a fixed demo actor, never from the request.
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https://unpkg.com https://*.tile.openstreetmap.de https://*.tile.openstreetmap.fr; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '32kb', strict: true }));
  app.get('/api/health', (req, res) => { store.db.prepare('SELECT 1').get(); res.json({ status: 'ok', mode: 'local-demo' }); });
  app.get('/api/posts', (req, res) => {
    const { limit = '20', before = String(Number.MAX_SAFE_INTEGER) } = req.query;
    if (typeof limit !== 'string' || !/^\d+$/.test(limit) || +limit < 1 || +limit > 100 || typeof before !== 'string' || !/^\d+$/.test(before) || !Number.isSafeInteger(+before) || +before < 1) {
      throw new ValidationError('limit must be 1–100; before must be a positive integer cursor.');
    }
    res.json(store.list({limit: +limit, before: +before}));
  });
  app.get('/api/posts/:id', (req, res) => {
    const post = store.get(req.params.id);
    if (!post) return res.status(404).json({error: 'Post not found.'});
    res.json(post);
  });
  app.post('/api/posts', (req, res) => {
    if (!req.is('application/json')) return res.status(415).json({error: 'Content-Type must be application/json.'});
    const post = store.create(validatePost(req.body), {userId: 'demo-student', ip: req.ip});
    res.location(`/api/posts/${post.id}`).status(201).json(post);
  });
  const rootIndex = fileURLToPath(new URL('../index.html', import.meta.url));
  const prototype = fileURLToPath(new URL('../.docs/02-design/prototype/', import.meta.url));
  app.get(['/', '/index.html'], (req,res)=>res.sendFile(rootIndex));
  // Allow only the original UI assets, never arbitrary files under .docs or the repo.
  for (const name of ['index.html','styles.css','app.js']) {
    app.get(`/.docs/02-design/prototype/${name}`, (req,res)=>res.sendFile(name,{root:prototype}));
  }
  app.use((req, res) => res.status(404).json({error: 'Not found.'}));
  app.use((error, req, res, next) => {
    if (error instanceof ValidationError) return res.status(400).json({error: error.message});
    if (error.type === 'entity.parse.failed') return res.status(400).json({error: 'Invalid JSON.'});
    if (error.type === 'entity.too.large') return res.status(413).json({error: 'Request body exceeds 32kb.'});
    console.error('Request failed:', error.code || error.name);
    res.status(500).json({error: 'Unable to complete the request.'});
  });
  return app;
}
