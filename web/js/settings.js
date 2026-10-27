// Settings (#/settings): profile, who sees my history (F5), notifications (backlog 4.2), recommendations (F6 consent),
// consents, suspension and appeal, blocked users, download my data and account deletion (rule.md PDPA section).
import {
  appealStatus, deleteAccount, exportMyData, getConsents, getNotificationSettings, grantAiConsent, listBlocks, recommendationFeedback,
  resetRecommendations, saveNotificationSettings, savePrivacy, sendAppeal, unblockUser, withdrawAiConsent, withdrawParticipation,
} from './api.js';
import { getUser, saveProfile, sessionLost, updateUser, USERNAME_PATTERN } from './auth.js';
import { $, avatar, escapeHTML, openGeneric, pageHead, toast } from './dom.js';
import { markFeedStale } from './feed.js';
import { formatDateTime, todayInBangkok } from './format.js';
import { icon } from './icons.js';
import { confirmSheet } from './post-actions.js';
import { isNative, syncReminders } from './native.js';

const INTERESTS = { sport: 'กีฬา', study: 'อ่านหนังสือ', cafe: 'คาเฟ่' };
const YEARS = { '': 'ไม่ระบุ', 1: 'ปี 1', 2: 'ปี 2', 3: 'ปี 3', 4: 'ปี 4', other: 'อื่น ๆ' };
const MINUTES = { 15: '15 นาที', 30: '30 นาที', 60: '1 ชั่วโมง', 120: '2 ชั่วโมง', 1440: '1 วัน' };

function errorText(id, message) { const box = $(id); if (box) { box.textContent = message; box.hidden = !message; } }

function profileSection(user) {
  return `<section id="profile" class="settings-section" aria-labelledby="profile-title">
    <h2 id="profile-title">${icon('user', { size: 'sm' })}โปรไฟล์</h2>
    <div class="row">${avatar({ id: user.id, name: user.displayName, username: user.username }, 'lg')}<p class="caption muted">รูปโปรไฟล์ใช้ตัวอักษรแรกของชื่อ ระบบไม่รับอัปโหลดรูปเพื่อลดข้อมูลส่วนตัว</p></div>
    <form id="profile-form" class="stack" novalidate>
      <div class="field"><label for="profile-name">ชื่อที่แสดง</label><input id="profile-name" maxlength="50" value="${escapeHTML(user.displayName)}" required></div>
      <div class="field"><label for="profile-username">ชื่อผู้ใช้</label>
        <div class="prefix-input"><span aria-hidden="true">@</span><input id="profile-username" maxlength="20" autocapitalize="none" spellcheck="false" value="${escapeHTML(user.username)}" required></div>
        <p class="help">3 ถึง 20 ตัว ใช้ a–z ตัวเลข และ _ เท่านั้น</p></div>
      <div class="field"><label for="profile-bio">แนะนำตัว (ไม่บังคับ)</label><textarea id="profile-bio" rows="2" maxlength="160" placeholder="เช่น ชอบตีแบดตอนเย็น หาเพื่อนติวคณิต">${escapeHTML(user.bio || '')}</textarea>
        <p class="help">ไม่เกิน 160 ตัวอักษร ไม่ต้องใส่เบอร์โทร ที่อยู่ หรือข้อมูลส่วนตัว</p></div>
      <div class="field"><label for="profile-year">ชั้นปี (ไม่บังคับ)</label><select id="profile-year">
        ${Object.entries(YEARS).map(([value, label]) => `<option value="${value}" ${String(user.year ?? '') === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
      <fieldset class="stack-tight"><legend>สนใจกิจกรรมแบบไหน (ไม่บังคับ)</legend><div class="chip-group">
        ${Object.entries(INTERESTS).map(([value, label]) => `<label class="chip"><input type="checkbox" name="profile-interests" value="${value}" ${user.interests.includes(value) ? 'checked' : ''}><span>${label}</span></label>`).join('')}
      </div><p class="help">ใช้กับระบบแนะนำเฉพาะเมื่อคุณเปิดใช้</p></fieldset>
      <p id="profile-error" class="error-message" role="alert" hidden></p>
      <button class="button button-primary button-inline" type="submit">บันทึกโปรไฟล์</button>
    </form>
  </section>`;
}

function privacySection(user) {
  const option = (value, title, text) => `<label class="radio-row"><input type="radio" name="history-visibility" value="${value}" ${user.historyVisibility === value ? 'checked' : ''}><span><strong>${title}</strong><span class="caption muted">${text}</span></span></label>`;
  return `<section id="privacy" class="settings-section" aria-labelledby="privacy-title">
    <h2 id="privacy-title">${icon('lock', { size: 'sm' })}ใครเห็นประวัติการเข้าร่วมของฉัน</h2>
    <div class="stack-tight" role="radiogroup" aria-labelledby="privacy-title">
      ${option('public', 'ทุกคนที่เข้าสู่ระบบ', 'ผู้ใช้ JoinGun ทุกคนเห็นกิจกรรมที่คุณเข้าร่วมบนโปรไฟล์')}
      ${option('friends', 'เฉพาะเพื่อน', 'เฉพาะคนที่เป็นเพื่อนกับคุณ')}
      ${option('private', 'เฉพาะฉัน (ค่าเริ่มต้น)', 'ไม่มีใครเห็น นอกจากคุณ')}
    </div>
    <p class="caption muted">ไม่ว่าเลือกแบบไหน ผู้จัดและผู้เข้าร่วมกิจกรรมเดียวกันยังเห็นชื่อคุณในรายชื่อผู้เข้าร่วมของกิจกรรมนั้น</p>
  </section>`;
}

function notificationSection(prefs) {
  const support = 'Notification' in window ? Notification.permission : 'unsupported';
  return `<section id="notifications" class="settings-section" aria-labelledby="notify-title">
    <h2 id="notify-title">${icon('bell', { size: 'sm' })}การแจ้งเตือน</h2>
    <label class="switch-row"><span><strong>เตือนก่อนกิจกรรมเริ่ม</strong><br><span class="caption muted">${isNative() ? 'เด้งเตือนบนโทรศัพท์แม้ปิดแอป และแสดงในหน้าการแจ้งเตือน' : 'แสดงในหน้าการแจ้งเตือนของ JoinGun'}</span></span><input type="checkbox" id="notify-reminders" ${prefs.reminders ? 'checked' : ''}></label>
    <div class="field"><label for="notify-minutes">เตือนล่วงหน้า</label><select id="notify-minutes">${Object.entries(MINUTES).map(([value, label]) => `<option value="${value}" ${Number(value) === prefs.reminderMinutes ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
    <label class="switch-row"><span><strong>ส่งการเตือนทางอีเมลด้วย</strong><br><span class="caption muted">ส่งไปที่อีเมลสถานศึกษาของคุณ ใช้ได้แม้ไม่ได้เปิดแอป</span></span><input type="checkbox" id="notify-email" ${prefs.email ? 'checked' : ''}></label>
    ${isNative() ? '<p class="caption muted">ถ้าไม่ได้รับการเตือน ให้อนุญาตการแจ้งเตือนของ JoinGun ในการตั้งค่าโทรศัพท์</p>' : `<div class="row-wrap"><span class="caption muted">การแจ้งเตือนบนเบราว์เซอร์: ${support === 'granted' ? 'เปิดแล้ว' : support === 'denied' ? 'ถูกบล็อกในเบราว์เซอร์' : support === 'unsupported' ? 'เบราว์เซอร์นี้ไม่รองรับ' : 'ยังไม่เปิด'}</span>
      ${support === 'default' ? '<button class="button button-outline button-small" type="button" data-settings="browser-permission">เปิดบนเบราว์เซอร์นี้</button>' : ''}</div>`}
  </section>`;
}

function aiSection(consent) {
  return `<section id="ai" class="settings-section" aria-labelledby="ai-title">
    <h2 id="ai-title">${icon('sparkle', { size: 'sm' })}ระบบแนะนำกิจกรรม (AI)</h2>
    ${consent.active ? `<p><span class="pill pill-success">เปิดใช้อยู่</span> ตั้งแต่ ${formatDateTime(consent.grantedAt)}</p>` : `<p><span class="pill pill-neutral">ปิดอยู่</span>${consent.withdrawnAt ? ` ปิดเมื่อ ${formatDateTime(consent.withdrawnAt)}` : ''}</p>`}
    <div class="notice">${icon('info', { size: 'sm' })}<span>ระบบให้คะแนนกิจกรรมจาก ความสนใจที่คุณเลือก หมวดที่คุณเคยเข้าร่วมใน 6 เดือน เพื่อนที่จัดหรือเข้าร่วม และเวลาที่ใกล้เริ่ม ทุกคำแนะนำแสดงเหตุผลและคะแนน ไม่ใช้ชั้นปี เพศ คณะ หรือตำแหน่ง และไม่ส่งข้อมูลให้บริการ AI ภายนอก คำแนะนำอาจไม่ตรงใจและไม่ได้รับประกันความปลอดภัย</span></div>
    ${consent.active ? `<div class="row-wrap">
        <button class="button button-outline button-small" type="button" data-settings="ai-reset">ล้างการตั้งค่า “ไม่สนใจ” ทั้งหมด</button>
        <button class="button button-outline button-small" type="button" data-settings="ai-review">ขอให้ทีมตรวจสอบระบบแนะนำ</button>
        <button class="button button-danger-outline button-small" type="button" data-settings="ai-off">ปิดระบบแนะนำ</button></div>`
      : `<label class="checkbox-row"><input type="checkbox" id="settings-ai-ack"><span>ฉันยินยอมให้ใช้ความสนใจ ประวัติการเข้าร่วม และรายชื่อเพื่อนของฉันเพื่อแนะนำกิจกรรม และรับทราบข้อจำกัดข้างต้น</span></label>
        <p id="settings-ai-error" class="error-message" role="alert" hidden></p>
        <button class="button button-primary button-inline" type="button" data-settings="ai-on">เปิดระบบแนะนำ</button>`}
  </section>`;
}

function consentSection(consents) {
  const p = consents.participation, t = consents.terms;
  return `<section id="consents" class="settings-section" aria-labelledby="consent-title">
    <h2 id="consent-title">${icon('shieldCheck', { size: 'sm' })}ความยินยอม</h2>
    ${t ? `<p>ยอมรับข้อตกลงการใช้งาน (${escapeHTML(t.termsVersion)}) และนโยบายความเป็นส่วนตัว (${escapeHTML(t.privacyVersion)}) เมื่อ ${formatDateTime(t.acceptedAt)} · <a href="#/terms">อ่าน</a></p>` : ''}
    <div class="stack-tight">
      <strong>เก็บประวัติการเข้าร่วมกิจกรรม</strong>
      ${p.active
        ? `<p>ให้ความยินยอมเมื่อ ${formatDateTime(p.grantedAt)}</p>
           <p class="caption muted">ถ้าถอนความยินยอม กิจกรรมที่คุณเข้าร่วมอยู่จะยังคงอยู่ แต่จะเข้าร่วมกิจกรรมใหม่ไม่ได้จนกว่าจะยินยอมอีกครั้งตอนกดเข้าร่วม</p>
           <button class="button button-outline button-small" type="button" data-settings="withdraw">ถอนความยินยอม</button>`
        : `<p class="muted">${p.withdrawnAt ? `ถอนความยินยอมแล้วเมื่อ ${formatDateTime(p.withdrawnAt)}` : 'ยังไม่ได้ให้ความยินยอม'} ระบบจะถามอีกครั้งเมื่อคุณกดเข้าร่วมกิจกรรม</p>`}
    </div>
    <p class="caption muted">ความยินยอมให้แสดงสถานที่นัดหมายขอแยกทุกครั้งที่คุณโพสต์กิจกรรม</p>
  </section>`;
}

function suspensionSection(user, openAppeal) {
  if (!user.suspended) return '';
  return `<section id="appeal" class="settings-section" aria-labelledby="appeal-title">
    <h2 id="appeal-title" style="color:var(--color-danger)">${icon('ban', { size: 'sm' })}บัญชีถูกระงับชั่วคราว</h2>
    <p>ผู้ดูแลระงับบัญชีเมื่อ ${formatDateTime(user.suspended.at)} เหตุผล: <strong>${escapeHTML(user.suspended.reason)}</strong></p>
    <p class="caption muted">ระหว่างนี้คุณยังอ่านโพสต์ ดาวน์โหลดข้อมูล และลบบัญชีได้ แต่โพสต์ เข้าร่วมกิจกรรม และส่งคำขอเป็นเพื่อนไม่ได้</p>
    ${openAppeal ? '<p class="notice">คุณส่งคำขอทบทวนแล้ว ผู้ดูแลที่เป็นคนจะตรวจสอบและแจ้งผลในหน้าการแจ้งเตือน</p>'
      : `<form id="appeal-form" class="stack" novalidate><div class="field"><label for="appeal-text">ขอให้ผู้ดูแลทบทวน</label><textarea id="appeal-text" rows="3" maxlength="2000" placeholder="อธิบายว่าทำไมคิดว่าควรยกเลิกการระงับ"></textarea></div>
        <p id="appeal-error" class="error-message" role="alert" hidden></p><button class="button button-primary button-inline" type="submit">ส่งคำขอทบทวน</button></form>`}
  </section>`;
}

function blocksSection(items) {
  return `<section id="blocks" class="settings-section" aria-labelledby="blocks-title">
    <h2 id="blocks-title">${icon('ban', { size: 'sm' })}ผู้ใช้ที่บล็อก</h2>
    ${items.length ? `<ul class="participant-list">${items.map(b => `<li>${avatar({ id: b.id, name: b.displayName }, 'sm')}
        <span class="grow"><strong>${escapeHTML(b.displayName)}</strong> <span class="muted small">@${escapeHTML(b.username ?? '')}</span></span>
        <button class="button button-outline button-small" type="button" data-unblock="${escapeHTML(b.id)}">เลิกบล็อก</button></li>`).join('')}</ul>`
      : '<p class="muted">ยังไม่ได้บล็อกใคร บล็อกได้จากเมนู ⋯ บนโพสต์หรือบนโปรไฟล์</p>'}
  </section>`;
}

function exportSection() {
  return `<section id="export" class="settings-section" aria-labelledby="export-title">
    <h2 id="export-title">${icon('download', { size: 'sm' })}ดาวน์โหลดข้อมูลของฉัน</h2>
    <p>ได้ไฟล์ ZIP ที่ล็อกด้วยรหัสผ่านที่คุณตั้งเอง ข้างในเป็นไฟล์ JSON ของโปรไฟล์ อีเมล โพสต์ ประวัติการเข้าร่วม เพื่อน ความยินยอม การแจ้งเตือน รายงานที่คุณส่ง การบล็อก และบันทึกการใช้งานของคุณ</p>
    <p class="caption muted">ไฟล์เข้ารหัสแบบ AES ซึ่งตัวเปิด ZIP ที่มากับ Windows และ macOS เปิดไม่ได้ ให้ใช้ 7-Zip บน Windows หรือ Keka / The Unarchiver บน macOS ระบบไม่เก็บรหัสผ่านนี้</p>
    <form id="export-form" class="stack" novalidate>
      <div class="field-row">
        <div class="field"><label for="export-password">ตั้งรหัสผ่านของไฟล์</label><input id="export-password" type="password" minlength="8" maxlength="128" autocomplete="new-password" required></div>
        <div class="field"><label for="export-password2">พิมพ์อีกครั้ง</label><input id="export-password2" type="password" maxlength="128" autocomplete="new-password" required></div>
      </div>
      <p id="export-error" class="error-message" role="alert" hidden></p>
      <button class="button button-outline button-inline" type="submit">${icon('download', { size: 'sm' })}ดาวน์โหลดไฟล์ข้อมูล</button>
    </form>
  </section>`;
}

function deleteSection(user) {
  return `<section id="delete" class="settings-section danger-zone" aria-labelledby="delete-title">
    <h2 id="delete-title">${icon('trash', { size: 'sm' })}ลบบัญชี</h2>
    <p>บัญชีจะหายจากทุกหน้าทันที โปรไฟล์ถูกลบ เพื่อนทั้งหมดถูกยกเลิก กิจกรรมที่คุณจัดและยังไม่เริ่มจะถูกยกเลิก และคุณจะออกจากกิจกรรมที่เข้าร่วมไว้</p>
    <p class="caption muted">ตามกฎหมาย ระบบต้องเก็บอีเมลแบบเข้ารหัสและบันทึกการใช้งานไว้ 90 วัน หลังจากนั้นจะลบหรือทำให้ระบุตัวคุณไม่ได้โดยอัตโนมัติ ถ้าอยากได้ข้อมูลไว้ ให้ดาวน์โหลดก่อนลบ</p>
    <form id="delete-form" class="stack" novalidate>
      <div class="field"><label for="delete-confirm">พิมพ์ชื่อผู้ใช้ <strong>${escapeHTML(user.username)}</strong> เพื่อยืนยัน</label><input id="delete-confirm" autocapitalize="none" spellcheck="false" autocomplete="off"></div>
      <p id="delete-error" class="error-message" role="alert" hidden></p>
      <button class="button button-danger button-inline" type="submit">ลบบัญชีถาวร</button>
    </form>
  </section>`;
}

export async function renderSettings(main) {
  const user = getUser();
  main.innerHTML = `${pageHead('ตั้งค่า', { sub: `@${user.username}` })}<p class="section-pad muted" role="status">กำลังโหลด…</p>`;
  let consents, blocks, prefs, appeal;
  try {
    [consents, { items: blocks }, prefs, appeal] = await Promise.all([getConsents(), listBlocks(), getNotificationSettings(), appealStatus()]);
  } catch (error) { main.innerHTML = `${pageHead('ตั้งค่า')}<p class="section-pad error-message">${escapeHTML(error.message)}</p>`; return; }
  main.innerHTML = `${pageHead('ตั้งค่าและความเป็นส่วนตัว', { back: '#/menu', sub: `@${user.username}` })}
    <nav class="settings-index" aria-label="ส่วนของหน้าตั้งค่า">
      ${user.suspended ? '<a href="#/settings#appeal">การระงับบัญชี</a>' : ''}
      <a href="#/settings#profile">โปรไฟล์</a><a href="#/settings#privacy">ความเป็นส่วนตัว</a><a href="#/settings#notifications">การแจ้งเตือน</a>
      <a href="#/settings#ai">ระบบแนะนำ</a><a href="#/settings#consents">ความยินยอม</a><a href="#/settings#blocks">บล็อก</a><a href="#/settings#export">ดาวน์โหลดข้อมูล</a><a href="#/settings#delete">ลบบัญชี</a>
    </nav>
    ${suspensionSection(user, appeal.open)}${profileSection(user)}${privacySection(user)}${notificationSection(prefs)}${aiSection(consents.ai)}${consentSection(consents)}${blocksSection(blocks)}${exportSection()}${deleteSection(user)}`;
  bind(main);
}

// "#/settings#privacy" style links scroll to a section without changing the route.
export function scrollToSection(name) {
  if (!name) return;
  document.getElementById(name)?.scrollIntoView({ block: 'start' });
}

async function saveNotify(patch) {
  try { await saveNotificationSettings(patch); toast('บันทึกการแจ้งเตือนแล้ว'); syncReminders({ ask: true }); }
  catch (error) { toast(error.message); }
}

function bind(main) {
  $('profile-form').addEventListener('submit', async event => {
    event.preventDefault();
    const username = $('profile-username').value.trim().toLowerCase();
    if (!$('profile-name').value.trim()) return errorText('profile-error', 'กรุณาตั้งชื่อที่แสดง');
    if (!USERNAME_PATTERN.test(username)) return errorText('profile-error', 'ชื่อผู้ใช้ต้องมี 3 ถึง 20 ตัว ใช้ a–z ตัวเลข และ _');
    errorText('profile-error', '');
    try {
      await saveProfile({ displayName: $('profile-name').value.trim(), username, year: $('profile-year').value || null, bio: $('profile-bio').value.trim(),
        interests: [...main.querySelectorAll('input[name=profile-interests]:checked')].map(input => input.value) });
      markFeedStale();
      toast('บันทึกโปรไฟล์แล้ว');
    } catch (error) { errorText('profile-error', error.message); }
  });

  main.querySelectorAll('input[name=history-visibility]').forEach(input => input.addEventListener('change', async () => {
    try { await savePrivacy(input.value); updateUser({ historyVisibility: input.value }); toast('บันทึกความเป็นส่วนตัวแล้ว'); }
    catch (error) { toast(error.message); }
  }));
  $('notify-reminders').addEventListener('change', event => saveNotify({ reminders: event.target.checked }));
  $('notify-email').addEventListener('change', event => saveNotify({ email: event.target.checked }));
  $('notify-minutes').addEventListener('change', event => saveNotify({ reminderMinutes: Number(event.target.value) }));

  $('appeal-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    try { await sendAppeal($('appeal-text').value); toast('ส่งคำขอทบทวนแล้ว'); renderSettings(main); }
    catch (error) { errorText('appeal-error', error.message); }
  });

  main.onclick = async event => {
    const action = event.target.closest('[data-settings]')?.dataset.settings;
    if (action === 'withdraw') {
      confirmSheet({
        title: 'ถอนความยินยอมเก็บประวัติการเข้าร่วม?',
        message: 'กิจกรรมที่เข้าร่วมอยู่จะยังคงอยู่ แต่จะเข้าร่วมกิจกรรมใหม่ไม่ได้จนกว่าคุณจะยินยอมอีกครั้ง',
        confirmLabel: 'ถอนความยินยอม',
        onConfirm: async () => { await withdrawParticipation(); updateUser({ participationConsent: false }); toast('ถอนความยินยอมแล้ว'); renderSettings(main); },
      });
    }
    if (action === 'ai-on') {
      if (!$('settings-ai-ack').checked) return errorText('settings-ai-error', 'กรุณาติ๊กยินยอมและรับทราบข้อจำกัดก่อน');
      try { await grantAiConsent(); toast('เปิดระบบแนะนำแล้ว ดูได้ที่แท็บ “สำหรับคุณ” ในหน้าแรก'); renderSettings(main); } catch (error) { errorText('settings-ai-error', error.message); }
    }
    if (action === 'ai-off') {
      confirmSheet({ title: 'ปิดระบบแนะนำ?', message: 'ระบบจะหยุดใช้ข้อมูลของคุณเพื่อแนะนำกิจกรรมทันที เปิดใหม่ได้ภายหลัง', confirmLabel: 'ปิดระบบแนะนำ',
        onConfirm: async () => { await withdrawAiConsent(); toast('ปิดระบบแนะนำแล้ว'); renderSettings(main); } });
    }
    if (action === 'ai-reset') { try { await resetRecommendations(); toast('ล้างแล้ว คำแนะนำที่เคยซ่อนจะกลับมา'); } catch (error) { toast(error.message); } }
    if (action === 'ai-review') {
      const body = openGeneric(`<div class="sheet-heading"><h2 id="generic-title">ขอให้ทีมตรวจสอบระบบแนะนำ</h2><button class="icon-button" type="button" data-close-generic aria-label="ปิด">${icon('x')}</button></div>
        <p class="muted">เช่น ระบบแนะนำไม่ตรงกับคุณ หรือคิดว่าไม่เป็นธรรม ผู้ดูแลที่เป็นคนจะอ่านและตรวจสอบ</p>
        <div class="field"><label for="ai-review-text">รายละเอียด</label><textarea id="ai-review-text" rows="4" maxlength="1000"></textarea></div>
        <p id="ai-review-error" class="error-message" role="alert" hidden></p><button class="button button-primary" type="button" id="ai-review-send">ส่ง</button>`);
      body.querySelector('[data-close-generic]').onclick = () => $('generic-dialog').close();
      body.querySelector('#ai-review-send').onclick = async () => {
        try { await recommendationFeedback({ kind: 'review-request', details: $('ai-review-text').value }); $('generic-dialog').close(); toast('ส่งให้ทีมตรวจสอบแล้ว'); }
        catch (error) { errorText('ai-review-error', error.message); }
      };
    }
    if (action === 'browser-permission') {
      const result = await Notification.requestPermission();
      toast(result === 'granted' ? 'เปิดการแจ้งเตือนบนเบราว์เซอร์แล้ว' : 'ยังไม่ได้เปิด');
      renderSettings(main);
    }
    const unblock = event.target.closest('[data-unblock]');
    if (unblock) {
      unblock.disabled = true;
      try { await unblockUser(unblock.dataset.unblock); markFeedStale(); toast('เลิกบล็อกแล้ว'); renderSettings(main); }
      catch (error) { unblock.disabled = false; toast(error.message); }
    }
  };

  $('export-form').addEventListener('submit', async event => {
    event.preventDefault();
    const password = $('export-password').value;
    if (password.length < 8) return errorText('export-error', 'รหัสผ่านของไฟล์ต้องมีอย่างน้อย 8 ตัวอักษร');
    if (password !== $('export-password2').value) return errorText('export-error', 'รหัสผ่านสองช่องไม่ตรงกัน');
    errorText('export-error', '');
    const button = event.target.querySelector('button');
    button.disabled = true; button.textContent = 'กำลังเตรียมไฟล์…';
    try {
      const blob = await exportMyData(password);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `joingun-my-data-${todayInBangkok()}.zip`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
      event.target.reset();
      toast('ดาวน์โหลดไฟล์แล้ว เปิดด้วยรหัสผ่านที่คุณตั้ง');
    } catch (error) { errorText('export-error', error.message); }
    finally { button.disabled = false; button.textContent = 'ดาวน์โหลดไฟล์ข้อมูล'; }
  });

  $('delete-form').addEventListener('submit', event => {
    event.preventDefault();
    const typed = $('delete-confirm').value.trim().toLowerCase();
    if (typed !== getUser().username) return errorText('delete-error', 'ชื่อผู้ใช้ไม่ตรง');
    errorText('delete-error', '');
    confirmSheet({
      title: 'ลบบัญชีถาวร?', message: 'ทำแล้วย้อนกลับไม่ได้ คุณจะออกจากระบบทันที', confirmLabel: 'ลบบัญชี', danger: true,
      onConfirm: async () => {
        await deleteAccount(typed);
        sessionLost();
        markFeedStale();
        toast('ลบบัญชีแล้ว');
        location.hash = '#/welcome';
      },
    });
  });
}

