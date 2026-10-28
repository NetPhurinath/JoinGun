// Demo content for local testing: npm run seed
// Adds four sample accounts (no email, so nobody can sign in as them) and upcoming activities hosted by them.
// Refuses to run with NODE_ENV=production. Run it again to add another set of activities.
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDatabaseFromEnv } from '../database.js';
import { loadConfig } from '../config.js';
import { createSecurity } from '../security.js';
import { writeProfile } from '../profile-crypto.js';

try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (process.env.NODE_ENV === 'production') { console.error('npm run seed is for development only.'); process.exit(1); }
const config = loadConfig(process.env, { devSecretFile: fileURLToPath(new URL('../../data/dev-secret.txt', import.meta.url)) });
const security = createSecurity(config.secret);
const store = await openDatabaseFromEnv(process.env, fileURLToPath(new URL('../../data/pglite/', import.meta.url)));
const { db } = store;
const now = new Date().toISOString();

const people = [
  ['demo_mint', 'มิ้นท์ (ตัวอย่าง)', '2', ['sport', 'cafe'], 'ชอบตีแบดตอนเย็น หาเพื่อนตีประจำ'],
  ['demo_boss', 'บอส (ตัวอย่าง)', '3', ['study'], 'ติวแคลคูลัสให้ฟรี ชวนกันอ่านหนังสือ'],
  ['demo_fah', 'ฟ้า (ตัวอย่าง)', '1', ['cafe', 'study'], 'ตามหาคาเฟ่เงียบ ๆ ไว้นั่งทำงาน'],
  ['demo_ton', 'ต้น (ตัวอย่าง)', '4', ['sport'], 'ฟุตซอลทุกวันพุธ'],
];
const ids = {};
for (const [username, name, year, interests, bio] of people) {
  const existing = await db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) { ids[username] = existing.id; continue; }
  const id = randomUUID();
  await db.prepare(`INSERT INTO users (id, username, display_name, status, terms_version, privacy_version, created_at, updated_at, history_visibility)
    VALUES (?, ?, ?, 'active', ?, ?, ?, ?, 'public')`).run(id, username, name, config.termsVersion, config.privacyVersion, now, now);
  await writeProfile(db, security, id, { year, interests, bio });
  ids[username] = id;
}

const at = (days, hour, minute = 0) => {
  const bangkok = new Date(Date.now() + 7 * 3_600_000 + days * 86_400_000);
  return new Date(Date.UTC(bangkok.getUTCFullYear(), bangkok.getUTCMonth(), bangkok.getUTCDate(), hour - 7, minute)).toISOString();
};
const activities = [
  ['demo_mint', 'ตีแบดหลังเลิกเรียน มือใหม่มาได้', 'มีไม้สำรอง 2 อัน เอาน้ำมาเองนะ', 'sport', at(1, 17), 'โรงยิมกลาง คอร์ต 3', 'เจอกันหน้าประตูโรงยิม', 8, 20.0451, 99.8932],
  ['demo_boss', 'ติวแคลคูลัส 1 ก่อนสอบกลางภาค', 'เน้นทำโจทย์ปีเก่า เอาเครื่องคิดเลขมาด้วย', 'study', at(2, 13), 'หอสมุด ชั้น 3 ห้องอ่านกลุ่ม', 'ห้อง 3-07', 10, 20.0442, 99.8941],
  ['demo_fah', 'นั่งคาเฟ่ทำรายงานด้วยกัน', 'ใครมีงานค้างมานั่งทำด้วยกัน ร้านมีปลั๊กเยอะ', 'cafe', at(1, 10), 'คาเฟ่ข้างหอพักนักศึกษา', 'โต๊ะริมหน้าต่าง', 5, 20.0466, 99.8970],
  ['demo_ton', 'ฟุตซอล 5 คน ขาดอีก 3', 'เล่นสนุก ๆ ไม่ซีเรียส', 'sport', at(3, 18), 'สนามฟุตซอลในร่ม', 'ห้องเปลี่ยนเสื้อ', 10, 20.0425, 99.8925],
  ['demo_boss', 'อ่านหนังสือเงียบ ๆ แบบ Pomodoro', '25 นาทีอ่าน 5 นาทีพัก ไม่คุยกันระหว่างอ่าน', 'study', at(4, 9), 'อาคารเรียนรวม ห้อง C2', '', 12, null, null],
];
for (const [author, title, content, category, startsAt, location, meeting, capacity, lat, lng] of activities) {
  const id = randomUUID();
  await db.transaction(async tx => {
    await tx.prepare('INSERT INTO posts (id, author_id, type, content, created_at) VALUES (?, ?, ?, ?, ?)').run(id, ids[author], 'activity', content, now);
    await tx.prepare('INSERT INTO activities (post_id, title, starts_at, location, capacity, category, meeting, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, title, startsAt, location, capacity, category, meeting, lat, lng);
    await tx.prepare('INSERT INTO consent_records VALUES (?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), id, ids[author], 'publish-meeting-location', 'location-v1', now, 'seed');
    await tx.prepare("INSERT INTO participants (activity_id, user_id, role, status, joined_at) VALUES (?, ?, 'host', 'joined', ?)").run(id, ids[author], now);
    await tx.prepare('INSERT INTO audit_logs VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), id, ids[author], 'post.create', now, 'seed');
  });
}
await db.prepare('INSERT INTO posts (id, author_id, type, content, created_at) VALUES (?, ?, ?, ?, ?)').run(randomUUID(), ids.demo_fah, 'text', 'ใครรู้จักร้านกาแฟที่เปิดถึงดึกแถวมหาลัยบ้าง แนะนำหน่อย ☕', now);
console.log(`Seeded ${people.length} sample accounts and ${activities.length} activities (plus one text post).`);
await store.close();
