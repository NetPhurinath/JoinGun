import express from 'express';
import { fileURLToPath } from 'node:url';
import { validatePost, validateFeedQuery, ValidationError } from './validation.js';
import { createAuth, AuthHttpError } from './auth.js';
import { createParticipation, ActivityError } from './participation.js';
import { createModeration } from './moderation.js';
import { createModeratorTools } from './moderator.js';
import { createAccountData } from './account-data.js';
import { createNotifier } from './notifications.js';
import { createSocial } from './social.js';
import { createRecommender } from './recommend.js';
import { HttpError } from './errors.js';

const CSP = [
  "default-src 'self'",
  "script-src 'self' https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://unpkg.com",
  "img-src 'self' data: https://unpkg.com https://*.tile.openstreetmap.de https://*.tile.openstreetmap.fr https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
  // Place search in the create form (backlog 3.2) asks OpenStreetMap Nominatim directly from the browser.
  "connect-src 'self' https://nominatim.openstreetmap.org",
  "font-src 'self'",
  "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'self'",
].join('; ');
const APP_CSP = CSP.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'");

// options.config: loadConfig() result; options.mailer: { send({to, subject, html, text}) }.
export function createApp(store, { config, mailer }) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1); // behind one reverse proxy (e.g. the hosting platform)
  const auth = createAuth(store, { config, mailer });
  const notifier = createNotifier(store.db);
  const participation = createParticipation(store);
  const moderation = createModeration(store.db);
  const moderator = createModeratorTools(store.db, notifier);
  const accountData = createAccountData(store.db, auth.security);
  const social = createSocial(store.db, notifier, auth.security);
  const recommender = createRecommender(store, social);
  app.locals.notifier = notifier;
  app.locals.security = auth.security;
  const limited = (key, limit, windowMs) => { if (!auth.limiter.allow(key, limit, windowMs)) throw new HttpError(429, 'rate-limited', 'ทำรายการบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่'); };
  const userLimit = (name, limit, windowMs) => (req, res, next) => { limited(`${name}:${req.user.id}`, limit, windowMs); next(); };
  const { requireAccount: account, requireActive: active, requireModerator: mod } = auth;

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    // The app never reads the device's location, camera or microphone.
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=(), usb=()');
    // The Android app (Capacitor, User-Agent ends with "JoinGunApp") may add its native bridge as an inline script to
    // pages it loads from this server. Only the viewer's own app sends that marker, so every other viewer keeps the
    // strict policy.
    res.setHeader('Content-Security-Policy', /JoinGunApp/.test(req.headers['user-agent'] || '') ? APP_CSP : CSP);
    if (config.production) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // Cross-site request protection for state-changing API calls: the session cookie is SameSite=Lax, bodies must be
  // JSON (a cross-site form cannot send that without a CORS preflight), and a foreign Origin is refused.
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.headers.origin;
    if (origin && origin !== 'null') {
      let host = null;
      try { host = new URL(origin).host; } catch { /* invalid origin */ }
      if (host !== req.headers.host) return res.status(403).json({ error: 'Cross-site request refused.' });
    }
    if (req.headers['content-length'] && req.headers['content-length'] !== '0' && !req.is('application/json')) {
      return res.status(415).json({ error: 'Content-Type must be application/json.' });
    }
    // Overall cap on writes per IP, on top of the per-action limits below (one server process; see README).
    if (!auth.limiter.allow(`write-ip:${req.ip}`, 300, 15 * 60_000)) return res.status(429).json({ error: 'ทำรายการบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่', code: 'rate-limited' });
    next();
  });
  app.use(express.json({ limit: '32kb', strict: true }));
  app.use(auth.session);

  app.get('/api/health', (req, res) => { store.db.prepare('SELECT 1').get(); res.json({ status: 'ok' }); });
  app.use('/api/auth', auth.router);
  app.use('/api/me', auth.me);

  // Posts carry the viewer's own participation status, so responses differ per user (API responses are no-store).
  const viewerId = req => req.user?.id ?? null;
  app.get('/api/posts', (req, res) => {
    const query = validateFeedQuery(req.query);
    if (query.scope === 'friends' && !req.user) throw new AuthHttpError(401, 'กรุณาเข้าสู่ระบบก่อน');
    res.json(store.list({ ...query, viewerId: viewerId(req) }));
  });
  app.get('/api/posts/:id', (req, res) => {
    const post = store.get(req.params.id, viewerId(req));
    // A cancelled activity, or a post by a deleted account, stays visible only to its host and members.
    const hidden = post && (post.deletedAt || post.author.deleted) && !post.activity?.viewerStatus;
    if (!post || hidden) return res.status(404).json({error: 'Post not found.'});
    res.json(post);
  });
  app.post('/api/posts', account, active, userLimit('post', 30, 3_600_000), (req, res) => {
    if (!req.is('application/json')) return res.status(415).json({error: 'Content-Type must be application/json.'});
    const post = store.create(validatePost(req.body), {userId: req.user.id, ip: req.ip});
    res.location(`/api/posts/${post.id}`).status(201).json(post);
  });
  app.put('/api/posts/:id', account, active, (req, res) => {
    const post = store.update(req.params.id, validatePost(req.body), { userId: req.user.id, ip: req.ip });
    if (post.activity) notifier.notifyMembers(post.id, req.user.id, 'activity.updated');
    res.json(post);
  });
  app.delete('/api/posts/:id', account, (req, res) => {
    store.remove(req.params.id, { userId: req.user.id, ip: req.ip });
    notifier.notifyMembers(req.params.id, req.user.id, 'activity.cancelled');
    res.status(204).end();
  });

  // Reports and blocks (backlog 5.3). Blocking also ends a friendship between the two.
  app.post('/api/reports', account, (req, res) => {
    limited(`report:${req.user.id}`, 10, 3_600_000);
    res.status(201).json(moderation.report(req.user.id, req.body, req.ip));
  });
  app.get('/api/me/blocks', account, (req, res) => res.json({ items: moderation.blocked(req.user.id) }));
  app.post('/api/me/blocks', account, (req, res) => {
    moderation.block(req.user.id, req.body?.userId, req.ip);
    social.endAll(req.user.id, req.body.userId, req.ip);
    res.status(204).end();
  });
  app.delete('/api/me/blocks/:userId', account, (req, res) => { moderation.unblock(req.user.id, req.params.userId); res.status(204).end(); });

  // My account: consents, privacy, notifications settings, data download, account deletion (rule.md PDPA section).
  app.get('/api/me/consents', account, (req, res) => res.json(accountData.consents(req.user.id)));
  app.post('/api/me/consents/participation/withdraw', account, (req, res) => res.json(accountData.withdrawParticipation(req.user.id, req.ip)));
  app.post('/api/me/consents/ai', account, (req, res) => res.json(recommender.grant(req.user.id, req.body, req.ip)));
  app.post('/api/me/consents/ai/withdraw', account, (req, res) => res.json(recommender.withdraw(req.user.id, req.ip)));
  app.put('/api/me/privacy', account, (req, res) => {
    if (!req.body || Object.keys(req.body).some(k => k !== 'historyVisibility')) throw new HttpError(400, 'bad-request', 'ข้อมูลที่ส่งมาไม่ถูกต้อง');
    res.json(social.setHistoryVisibility(req.user.id, req.body.historyVisibility));
  });
  app.get('/api/me/notification-settings', account, (req, res) => res.json(notifier.preferences(req.user.id)));
  app.put('/api/me/notification-settings', account, (req, res) => res.json(notifier.savePreferences(req.user.id, req.body)));
  app.post('/api/me/appeal', account, (req, res) => { limited(`appeal:${req.user.id}`, 5, 86_400_000); res.status(201).json(moderator.appeal(req.user.id, req.body)); });
  app.get('/api/me/appeal', account, (req, res) => res.json({ open: moderator.openAppeal(req.user.id) }));
  app.post('/api/me/export', account, async (req, res) => {
    limited(`export:${req.user.id}`, 5, 3_600_000);
    const file = await accountData.exportZip(req.user.id, req.body?.password, req.ip);
    res.type('application/zip').attachment(`joingun-my-data-${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())}.zip`).send(file);
  });
  app.post('/api/me/delete', account, (req, res) => {
    const result = accountData.deleteAccount(req.user.id, req.body?.confirmUsername, req.ip);
    res.clearCookie('jg_session', { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: '/' }).json(result);
  });

  // My activities: upcoming and past ones I host or joined.
  app.get('/api/me/activities', account, (req, res) => {
    const rows = store.db.prepare(`SELECT c.activity_id FROM participants c JOIN activities a ON a.post_id = c.activity_id
      WHERE c.user_id = ? AND c.status = 'joined' ORDER BY a.starts_at`).all(req.user.id);
    const items = rows.map(row => store.get(row.activity_id, req.user.id)).filter(Boolean);
    const time = Date.now();
    res.json({
      upcoming: items.filter(p => !p.deletedAt && new Date(p.activity.startsAt).getTime() > time - 3 * 3_600_000),
      past: items.filter(p => p.deletedAt || new Date(p.activity.startsAt).getTime() <= time - 3 * 3_600_000).reverse(),
    });
  });

  // Joining and leaving (backlog 2.4). Body for join: {} or {participationConsent: true} the first time.
  app.post('/api/activities/:id/join', account, active, userLimit('join', 60, 3_600_000), (req, res) => {
    const body = req.body ?? {};
    if (typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'participationConsent')) {
      throw new ActivityError(400, 'bad-request', 'ข้อมูลที่ส่งมาไม่ถูกต้อง');
    }
    const before = store.get(req.params.id, req.user.id);
    const post = participation.join(req.params.id, req.user.id, req.ip, body);
    if (before?.activity && !before.activity.viewerStatus) notifier.notify({ userId: post.author.id, type: 'activity.join', actorId: req.user.id, postId: post.id });
    res.json(post);
  });
  app.post('/api/activities/:id/leave', account, userLimit('join', 60, 3_600_000), (req, res) => {
    const post = participation.leave(req.params.id, req.user.id, req.ip);
    notifier.notify({ userId: post.author.id, type: 'activity.leave', actorId: req.user.id, postId: post.id });
    res.json(post);
  });
  app.get('/api/activities/:id/participants', account, (req, res) => res.json({ items: participation.participants(req.params.id, req.user.id) }));

  // People, profiles and friends (backlog 1.3, 5.1, 5.2; F5).
  app.get('/api/users', account, (req, res) => res.json({ items: social.search(req.query.q, req.user.id) }));
  app.get('/api/users/:username', (req, res) => res.json(social.profile(req.params.username, viewerId(req))));
  app.get('/api/users/:username/history', account, (req, res) => res.json({ items: social.history(req.params.username, req.user.id) }));
  app.get('/api/users/:username/posts', (req, res) => {
    const profile = social.profile(req.params.username, viewerId(req));
    res.json(store.list({ ...validateFeedQuery(req.query), viewerId: viewerId(req), authorId: profile.id }));
  });
  app.get('/api/friends', account, (req, res) => res.json({ items: social.friends(req.user.id), ...social.requests(req.user.id) }));
  app.get('/api/friends/suggestions', account, (req, res) => res.json({ items: social.suggestions(req.user.id) }));
  app.post('/api/friends/requests', account, active, userLimit('friend', 50, 86_400_000), (req, res) => {
    if (!req.body || Object.keys(req.body).some(k => k !== 'userId')) throw new HttpError(400, 'bad-request', 'ข้อมูลที่ส่งมาไม่ถูกต้อง');
    res.status(201).json(social.request(req.user.id, req.body.userId, req.ip));
  });
  app.post('/api/friends/requests/:id/accept', account, (req, res) => res.json(social.respond(req.user.id, req.params.id, true, req.ip)));
  app.post('/api/friends/requests/:id/decline', account, (req, res) => res.json(social.respond(req.user.id, req.params.id, false, req.ip)));
  app.post('/api/friends/requests/:id/cancel', account, (req, res) => res.json(social.cancel(req.user.id, req.params.id, req.ip)));
  app.delete('/api/friends/:userId', account, (req, res) => res.json(social.remove(req.user.id, req.params.userId, req.ip)));

  // Notifications (F4, backlog 4.1–4.2).
  app.get('/api/notifications', account, (req, res) => {
    const before = typeof req.query.before === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(req.query.before) ? req.query.before : null;
    res.json({ ...notifier.list(req.user.id, { before }), unread: notifier.unreadCount(req.user.id) });
  });
  app.get('/api/notifications/unread-count', account, (req, res) => res.json({ unread: notifier.unreadCount(req.user.id) }));
  app.post('/api/notifications/read', account, (req, res) => {
    const ids = req.body?.all === true ? 'all' : req.body?.ids;
    notifier.markRead(req.user.id, ids);
    res.json({ unread: notifier.unreadCount(req.user.id) });
  });

  // Recommendations (F6; LR4, LR5). Need the separate AI-recommendation consent.
  app.get('/api/recommendations', account, (req, res) => res.json(recommender.recommend(req.user.id)));
  app.post('/api/recommendations/feedback', account, (req, res) => {
    limited(`rec-feedback:${req.user.id}`, 60, 3_600_000);
    res.status(201).json(recommender.feedback(req.user.id, req.body));
  });
  app.post('/api/recommendations/reset', account, (req, res) => { recommender.resetFeedback(req.user.id); res.status(204).end(); });

  // Moderator screen.
  app.get('/api/mod/summary', account, mod, (req, res) => res.json(moderator.summary()));
  app.get('/api/mod/reports', account, mod, (req, res) => res.json({ items: moderator.reports(req.query.status) }));
  app.post('/api/mod/reports/:id/review', account, mod, (req, res) => res.json(moderator.review(req.user.id, req.params.id, req.body, req.ip)));
  app.get('/api/mod/appeals', account, mod, (req, res) => res.json({ items: moderator.appeals(req.query.status) }));
  app.post('/api/mod/appeals/:id/resolve', account, mod, (req, res) => res.json(moderator.resolveAppeal(req.user.id, req.params.id, req.body, req.ip)));
  app.get('/api/mod/recommendation-reviews', account, mod, (req, res) => res.json({ items: moderator.recommendationReviews(req.query.status) }));
  app.post('/api/mod/recommendation-reviews/:id/close', account, mod, (req, res) => res.json(moderator.closeRecommendationReview(req.user.id, req.params.id, req.ip)));

  // The web/ folder is the only public file tree; the repository root, .docs, data and .git are never served.
  const web = fileURLToPath(new URL('../web/', import.meta.url));
  app.use(express.static(web, { dotfiles: 'ignore', index: 'index.html', redirect: false, setHeaders: res => res.setHeader('Cache-Control', 'no-cache') }));
  app.use((req, res) => res.status(404).json({error: 'Not found.'}));
  app.use((error, req, res, next) => {
    if (error instanceof HttpError) return res.status(error.status).json({error: error.message, code: error.code});
    if (error instanceof ActivityError) return res.status(error.status).json({error: error.message, code: error.code});
    if (error instanceof AuthHttpError) return res.status(error.status).json({error: error.message, ...(error.field ? {field: error.field} : {})});
    if (error instanceof ValidationError) return res.status(400).json({error: error.message});
    if (error.type === 'entity.parse.failed') return res.status(400).json({error: 'Invalid JSON.'});
    if (error.type === 'entity.too.large') return res.status(413).json({error: 'Request body exceeds 32kb.'});
    console.error('Request failed:', error.code || error.name);
    res.status(500).json({error: 'Unable to complete the request.'});
  });
  return app;
}
