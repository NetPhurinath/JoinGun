// Hashing and encryption helpers. Keys are derived from APP_SECRET, one per purpose.
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export function createSecurity(secret) {
  const key = purpose => Buffer.from(hkdfSync('sha256', secret, 'joingun', purpose, 32));
  const emailKey = key('email-lookup'), codeKey = key('login-code'), encryptionKey = key('email-encryption');
  const hmac = (k, value) => createHmac('sha256', k).update(value).digest('hex');

  return {
    // Stable lookup value for an email, so the plaintext address is not needed to find an account.
    emailHash: email => hmac(emailKey, email),
    codeHash: (emailHash, code) => hmac(codeKey, `${emailHash}:${code}`),
    sameHash(a, b) {
      const left = Buffer.from(a, 'hex'), right = Buffer.from(b, 'hex');
      return left.length === right.length && timingSafeEqual(left, right);
    },
    newCode: () => String(randomInt(0, 1_000_000)).padStart(6, '0'),
    newToken: () => randomBytes(32).toString('base64url'),
    tokenHash: token => createHash('sha256').update(token).digest('hex'),
    // AES-256-GCM; stored as base64(iv | tag | ciphertext). Used for the email kept for account recovery.
    encrypt(text) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
      const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
    },
    decrypt(stored) {
      const raw = Buffer.from(stored, 'base64');
      const decipher = createDecipheriv('aes-256-gcm', encryptionKey, raw.subarray(0, 12));
      decipher.setAuthTag(raw.subarray(12, 28));
      return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
    },
  };
}
