// Optional profile fields (year, interests, bio) are stored encrypted (rule.md PDPA: encrypt stored profile data).
// Encrypted copies live in year_enc / interests_enc / bio_enc (AES-256-GCM, key derived from APP_SECRET in
// security.js); the plain columns are kept empty so their CHECK constraints stay valid. Display name and username
// stay readable because they are shown on every post, searched and must be unique.
const EMPTY = { year: null, interests: [], bio: '' };

export function openProfile(security, row) {
  if (!row) return { ...EMPTY };
  const read = value => { try { return security.decrypt(value); } catch { return null; } };
  const parse = text => { try { return JSON.parse(text || '[]'); } catch { return []; } };
  return {
    year: row.year_enc ? read(row.year_enc) : (row.year ?? null),
    interests: row.interests_enc ? parse(read(row.interests_enc)) : parse(row.interests),
    bio: row.bio_enc ? (read(row.bio_enc) ?? '') : (row.bio ?? ''),
  };
}

export function sealProfile(security, { year = null, interests = [], bio = '' } = {}) {
  return {
    year_enc: year === null || year === undefined ? null : security.encrypt(String(year)),
    interests_enc: interests?.length ? security.encrypt(JSON.stringify(interests)) : null,
    bio_enc: bio ? security.encrypt(bio) : null,
  };
}

export function writeProfile(db, security, userId, profile) {
  const sealed = sealProfile(security, profile);
  db.prepare("UPDATE users SET year = NULL, interests = '[]', bio = '', year_enc = ?, interests_enc = ?, bio_enc = ? WHERE id = ?")
    .run(sealed.year_enc, sealed.interests_enc, sealed.bio_enc, userId);
}

export const clearProfile = (db, userId) =>
  db.prepare("UPDATE users SET year = NULL, interests = '[]', bio = '', year_enc = NULL, interests_enc = NULL, bio_enc = NULL WHERE id = ?").run(userId);

// Encrypts rows written before encryption existed (or by older scripts). Safe to run on every start.
export function migrateProfileEncryption(db, security) {
  const rows = db.prepare("SELECT * FROM users WHERE year IS NOT NULL OR interests != '[]' OR bio != ''").all();
  for (const row of rows) writeProfile(db, security, row.id, openProfile(security, row));
  return rows.length;
}
