// Runtime configuration from environment variables (see .env.example). Secrets never appear in code or Git.
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const bool = value => ['1', 'true', 'yes'].includes(String(value || '').toLowerCase());

// In development without APP_SECRET, keep one generated secret in the data folder (ignored by Git) so sessions and
// encrypted emails still work after a restart. Production must set APP_SECRET explicitly.
function developmentSecret(file) {
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  const secret = randomBytes(32).toString('hex');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, secret, { mode: 0o600 });
  console.warn(`APP_SECRET is not set: generated a development secret in ${file}.`);
  return secret;
}

export function loadConfig(env = process.env, { devSecretFile } = {}) {
  const production = env.NODE_ENV === 'production';
  let secret = env.APP_SECRET;
  if (!secret) {
    if (production || !devSecretFile) throw new Error('APP_SECRET is required (at least 32 characters).');
    secret = developmentSecret(devSecretFile);
  }
  if (secret.length < 32) throw new Error('APP_SECRET must be at least 32 characters.');

  const gmailUser = (env.GMAIL_USER || '').trim();
  // Google shows App Passwords in groups of four ("abcd efgh ijkl mnop"); spaces are not part of the password.
  const gmailAppPassword = (env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  // Gmail API over HTTPS (OAuth refresh token) for hosts that block SMTP, such as Render's free web services.
  const gmailApi = {
    clientId: (env.GMAIL_CLIENT_ID || '').trim(),
    clientSecret: (env.GMAIL_CLIENT_SECRET || '').trim(),
    refreshToken: (env.GMAIL_REFRESH_TOKEN || '').trim(),
  };
  const useGmailApi = Boolean(gmailApi.clientId && gmailApi.clientSecret && gmailApi.refreshToken);
  if (production && (!gmailUser || !(gmailAppPassword || useGmailApi))) {
    throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD (or GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN) are required in production.');
  }

  // Accepted sign-up emails: any domain ending in this suffix (default: Thai educational institutions, *.ac.th).
  const emailSuffix = (env.ALLOWED_EMAIL_SUFFIX || 'ac.th').replace(/^[.@]+/, '').toLowerCase();

  // Comma-separated emails that become moderators on sign-in (the report review screen).
  const moderatorEmails = (env.MODERATOR_EMAILS || '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
  const host = env.HOST || '127.0.0.1';
  if (!/^[a-zA-Z0-9.:[\]-]+$/.test(host)) throw new Error('Invalid HOST.');

  // PostgreSQL connection URL (Render sets DATABASE_URL from render.yaml). Without it, development and tests use a local PGlite database.
  const databaseUrl = (env.DATABASE_URL || '').trim();
  if (production && !databaseUrl) throw new Error('DATABASE_URL is required in production.');
  if (databaseUrl && !/^postgres(ql)?:\/\//i.test(databaseUrl)) throw new Error('DATABASE_URL must start with postgres:// or postgresql://.');

  return {
    production,
    moderatorEmails,
    databaseUrl,
    databaseSsl: env.DATABASE_SSL || '',
    secret,
    emailSuffix,
    gmailUser,
    gmailAppPassword,
    gmailApi: useGmailApi ? gmailApi : null,
    mailFromName: env.MAIL_FROM_NAME || 'JoinGun',
    cookieSecure: production || bool(env.COOKIE_SECURE),
    trustProxy: bool(env.TRUST_PROXY),
    host,
    sessionDays: 30,
    codeMinutes: 10,
    codeMaxAttempts: 5,
    resendSeconds: 60,
    termsVersion: 'terms-draft-1',
    privacyVersion: 'privacy-draft-1',
  };
}
