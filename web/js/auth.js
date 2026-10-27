// Account state and the auth API client (contract: server/README.md, "Auth API").
// Show "Continue with Google" only after the team decides to add Google sign-in on the server.
export const GOOGLE_SIGN_IN_ENABLED = false;

export const EMAIL_SUFFIX = 'ac.th';
// Must match server/config.js; the server refuses an acceptance for any other version.
export const TERMS_VERSION = 'terms-draft-1';
export const PRIVACY_VERSION = 'privacy-draft-1';

export class AuthError extends Error {
  constructor(message, field, status) { super(message); this.field = field; this.status = status; }
}

export const normalizeEmail = value => String(value || '').trim().toLowerCase();
// Same rule as the server: name@<labels>.ac.th, for example name@lamduan.mfu.ac.th or name@chula.ac.th.
export const isAllowedEmail = value => /^[a-z0-9._%+-]{1,64}@([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+ac\.th$/.test(normalizeEmail(value));
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

// ---- state ---------------------------------------------------------------
// currentUser is set only for a finished account (terms accepted and profile created).
let currentUser = null;
const listeners = new Set();
export const getUser = () => currentUser;
export const onAuthChange = listener => { listeners.add(listener); return () => listeners.delete(listener); };
function setUser(user) { currentUser = user; listeners.forEach(listener => listener(user)); }

async function call(method, path, body) {
  let response;
  try {
    response = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  } catch {
    throw new AuthError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง');
  }
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new AuthError(data?.error || 'ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง', data?.field, response.status);
  return data;
}

// ---- public functions used by the UI -----------------------------------------
export function requestCode(email) {
  if (!isAllowedEmail(email)) throw new AuthError(`ใช้อีเมลสถานศึกษาที่ลงท้ายด้วย .${EMAIL_SUFFIX}`, 'email');
  return call('POST', '/api/auth/request-code', { email: normalizeEmail(email) });
}

// Resolves to { status: 'signed-in', user } | { status: 'needs-terms' } | { status: 'needs-profile' }.
export async function verifyCode(email, code) {
  if (!/^\d{6}$/.test(code)) throw new AuthError('กรอกรหัส 6 หลักจากอีเมล', 'code');
  const result = await call('POST', '/api/auth/verify', { email: normalizeEmail(email), code });
  if (result.status === 'signed-in') setUser(result.user);
  return result;
}

export const acceptTerms = () => call('POST', '/api/auth/terms', { termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION });

export async function saveProfile(profile) {
  const user = await call('PUT', '/api/me', profile);
  setUser(user);
  return user;
}

export async function logout() {
  try { await call('POST', '/api/auth/logout'); } finally { setUser(null); }
}

// Called once on page load. Returns the unfinished step ('terms' | 'profile') when a sign-up was left halfway.
export async function restoreSession() {
  try {
    const me = await call('GET', '/api/me');
    if (me.needs) { setUser(null); return me.needs; }
    setUser(me);
  } catch {
    setUser(null);
  }
  return null;
}

// The server ended the session (expired or signed out elsewhere).
export const sessionLost = () => setUser(null);

// Local update after the server confirmed a change (e.g. participation consent given while joining).
export const updateUser = patch => { if (currentUser) setUser({ ...currentUser, ...patch }); };
