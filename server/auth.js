// Auth routes and session middleware. Contract: server/README.md, "Auth API".
// User-facing error messages are Thai because the web UI shows them as they are.
import { Router } from 'express';
import { createAccounts } from './accounts.js';
import { codeEmail, MailError } from './mailer.js';
import { createSecurity } from './security.js';

export const SESSION_COOKIE = 'jg_session';
const INTERESTS = ['sport', 'study', 'cafe'];
const YEARS = ['1', '2', '3', '4', 'other'];

export class AuthHttpError extends Error {
  constructor(status, message, field) { super(message); this.status = status; this.field = field; }
}

// Fixed-window counters kept in memory. Enough for one server process; a shared store is needed with several.
export function createRateLimiter() {
  const hits = new Map();
  return {
    allow(key, limit, windowMs) {
      const time = Date.now();
      const recent = (hits.get(key) || []).filter(at => time - at < windowMs);
      if (recent.length >= limit) { hits.set(key, recent); return false; }
      recent.push(time);
      hits.set(key, recent);
      return true;
    },
    // Gives back the latest hit, for an attempt that did not get what it was counted for (a send that failed).
    undo(key) { hits.get(key)?.pop(); },
  };
}

function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function normalizeEmail(value) { return typeof value === 'string' ? value.trim().toLowerCase() : ''; }

// local@<one or more labels>.<suffix>, e.g. name@lamduan.mfu.ac.th or name@chula.ac.th for suffix "ac.th".
export function isAllowedEmail(email, suffix) {
  if (email.length > 254) return false;
  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^[a-z0-9._%+-]{1,64}@([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+${escaped}$`).test(email);
}

function only(body, keys) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AuthHttpError(400, 'ข้อมูลที่ส่งมาไม่ถูกต้อง');
  if (Object.keys(body).some(key => !keys.includes(key))) throw new AuthHttpError(400, 'ข้อมูลที่ส่งมาไม่ถูกต้อง');
  return body;
}

function validateProfile(body) {
  only(body, ['displayName', 'username', 'year', 'interests', 'bio']);
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  if (!displayName || displayName.length > 50) throw new AuthHttpError(400, 'ชื่อที่แสดงต้องมี 1 ถึง 50 ตัวอักษร', 'displayName');
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new AuthHttpError(400, 'ชื่อผู้ใช้ต้องมี 3 ถึง 20 ตัว ใช้ a–z ตัวเลข และ _', 'username');
  const year = body.year ?? null;
  if (year !== null && !YEARS.includes(year)) throw new AuthHttpError(400, 'ชั้นปีไม่ถูกต้อง', 'year');
  const interests = body.interests ?? [];
  if (!Array.isArray(interests) || interests.some(item => !INTERESTS.includes(item)) || new Set(interests).size !== interests.length) {
    throw new AuthHttpError(400, 'ความสนใจไม่ถูกต้อง', 'interests');
  }
  let bio;
  if (body.bio !== undefined) {
    if (typeof body.bio !== 'string' || body.bio.trim().length > 160) throw new AuthHttpError(400, 'แนะนำตัวต้องไม่เกิน 160 ตัวอักษร', 'bio');
    bio = body.bio.trim();
  }
  return { displayName, username, year, interests, bio };
}

export function createAuth(store, { config, mailer, limiter = createRateLimiter() }) {
  const security = createSecurity(config.secret);
  const accounts = createAccounts(store.db, security, config);
  const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: '/' };

  // Attaches req.user (raw row or null) and req.sessionToken to every request.
  async function session(req, res, next) {
    req.sessionToken = readCookie(req, SESSION_COOKIE);
    req.user = await accounts.userForSession(req.sessionToken);
    next();
  }
  const requireSession = (req, res, next) => {
    if (!req.user) return next(new AuthHttpError(401, 'กรุณาเข้าสู่ระบบก่อน'));
    next();
  };
  // A usable account: current terms accepted and a profile set up.
  const requireAccount = async (req, res, next) => {
    if (!req.user) return next(new AuthHttpError(401, 'กรุณาเข้าสู่ระบบก่อน'));
    if ((await accounts.toPublicUser(req.user)).needs) return next(new AuthHttpError(403, 'กรุณาตั้งค่าบัญชีให้เสร็จก่อน'));
    next();
  };

  // Posting, joining and friend requests are closed while a moderator's suspension is in force.
  const requireActive = (req, res, next) => {
    if (req.user?.suspended_at) return next(new AuthHttpError(403, 'บัญชีของคุณถูกระงับชั่วคราว ดูเหตุผลและขอให้ทบทวนได้ที่หน้าตั้งค่า'));
    next();
  };
  const requireModerator = (req, res, next) => {
    if (req.user?.role !== 'moderator') return next(new AuthHttpError(403, 'เฉพาะผู้ดูแลระบบ'));
    next();
  };

  const router = Router();

  router.post('/request-code', async (req, res) => {
    const { email: raw } = only(req.body, ['email']);
    const email = normalizeEmail(raw);
    if (!isAllowedEmail(email, config.emailSuffix)) throw new AuthHttpError(400, `ใช้อีเมลสถานศึกษาที่ลงท้ายด้วย .${config.emailSuffix}`, 'email');
    const emailHash = security.emailHash(email);
    // The resend wait is checked first, so taps inside it do not use up the hourly allowance.
    const resendKey = `code-email:${emailHash}`, hourKey = `code-email-hour:${emailHash}`;
    if (!limiter.allow(resendKey, 1, config.resendSeconds * 1000)) {
      throw new AuthHttpError(429, `ขอรหัสใหม่ได้หลังจาก ${config.resendSeconds} วินาที`);
    }
    const hourOk = limiter.allow(hourKey, 5, 3_600_000);
    if (!hourOk || !limiter.allow(`code-ip:${req.ip}`, 20, 3_600_000)) {
      if (hourOk) limiter.undo(hourKey);
      await accounts.log({ emailHash, action: 'code.request', status: 'rate-limited', ip: req.ip });
      throw new AuthHttpError(429, 'ขอรหัสครบจำนวนต่อชั่วโมงแล้ว กรุณาลองใหม่ในอีกไม่เกิน 1 ชั่วโมง');
    }
    const code = await accounts.issueCode(emailHash);
    try {
      await mailer.send({ to: email, ...codeEmail(code, config.codeMinutes) });
    } catch (error) {
      // No email arrived: the person may try again at once, and the try does not count towards the hourly limit.
      // The per-IP count stays, so a failing mail service is not hit without limit.
      limiter.undo(resendKey);
      limiter.undo(hourKey);
      await accounts.log({ emailHash, action: 'code.request', status: 'mail-failed', ip: req.ip });
      if (error instanceof MailError) console.error('Mail failed:', error.message);
      throw new AuthHttpError(503, 'ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
    await accounts.log({ emailHash, action: 'code.request', status: 'sent', ip: req.ip });
    // Same answer whether or not an account exists, so addresses cannot be probed.
    res.status(202).json({ resendAfter: config.resendSeconds, expiresInMinutes: config.codeMinutes });
  });

  router.post('/verify', async (req, res) => {
    const { email: raw, code } = only(req.body, ['email', 'code']);
    const email = normalizeEmail(raw);
    if (!isAllowedEmail(email, config.emailSuffix) || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      throw new AuthHttpError(400, 'กรอกรหัส 6 หลักจากอีเมล', 'code');
    }
    const emailHash = security.emailHash(email);
    if (!limiter.allow(`verify-ip:${req.ip}`, 30, 600_000)) throw new AuthHttpError(429, 'ลองบ่อยเกินไป กรุณารอสักครู่');
    const result = await accounts.checkCode(emailHash, code);
    if (result !== 'ok') {
      await accounts.log({ emailHash, action: 'login', status: result === 'wrong' ? 'failure-wrong-code' : 'failure-expired-code', ip: req.ip });
      throw new AuthHttpError(400, result === 'wrong' ? 'รหัสไม่ถูกต้อง ลองใหม่อีกครั้ง' : 'รหัสหมดอายุหรือกรอกผิดเกินจำนวนครั้ง กรุณาขอรหัสใหม่', 'code');
    }
    const { user, created } = await accounts.findOrCreateUser(email, emailHash);
    if (user.status === 'deleted') throw new AuthHttpError(403, 'บัญชีนี้ถูกปิดแล้ว');
    if (config.moderatorEmails.includes(email)) await accounts.makeModerator(user.id);
    if (req.sessionToken) await accounts.endSession(req.sessionToken);
    const token = await accounts.createSession(user.id, req.ip);
    await accounts.log({ userId: user.id, emailHash, action: created ? 'signup' : 'login', status: 'success', ip: req.ip });
    res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: config.sessionDays * 86_400_000 });
    const publicUser = await accounts.toPublicUser(await accounts.getUser(user.id));
    res.json(publicUser.needs ? { status: publicUser.needs === 'terms' ? 'needs-terms' : 'needs-profile' } : { status: 'signed-in', user: publicUser });
  });

  router.post('/terms', requireSession, async (req, res) => {
    const { termsVersion, privacyVersion } = only(req.body, ['termsVersion', 'privacyVersion']);
    if (termsVersion !== config.termsVersion || privacyVersion !== config.privacyVersion) {
      throw new AuthHttpError(409, 'ข้อตกลงมีการเปลี่ยนแปลง กรุณาโหลดหน้าใหม่แล้วอ่านอีกครั้ง');
    }
    await accounts.acceptTerms(req.user.id, req.ip);
    res.status(204).end();
  });

  router.post('/logout', async (req, res) => {
    if (req.sessionToken) {
      if (req.user) await accounts.log({ userId: req.user.id, action: 'logout', status: 'success', ip: req.ip });
      await accounts.endSession(req.sessionToken);
    }
    res.clearCookie(SESSION_COOKIE, cookieOptions).status(204).end();
  });

  const me = Router();
  me.get('/', requireSession, async (req, res) => res.json(await accounts.toPublicUser(req.user)));
  me.put('/', requireSession, async (req, res) => {
    if ((await accounts.toPublicUser(req.user)).needs === 'terms') throw new AuthHttpError(403, 'กรุณายอมรับข้อตกลงก่อน');
    const profile = validateProfile(req.body);
    if (await accounts.usernameTaken(profile.username, req.user.id)) throw new AuthHttpError(409, 'ชื่อผู้ใช้นี้มีคนใช้แล้ว', 'username');
    try {
      res.json(await accounts.toPublicUser(await accounts.saveProfile(req.user.id, profile, req.ip)));
    } catch (error) {
      // Two people picking the same username at the same moment: the UNIQUE constraint decides (SQLSTATE 23505).
      if (error.code === '23505' && /username/.test(`${error.constraint ?? ''} ${error.message}`)) throw new AuthHttpError(409, 'ชื่อผู้ใช้นี้มีคนใช้แล้ว', 'username');
      throw error;
    }
  });

  return { session, requireAccount, requireActive, requireModerator, router, me, accounts, config, security, limiter };
}
