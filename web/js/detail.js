// Activity detail ("รายละเอียดกิจกรรม") and the join flow — user journey steps 3–5:
// detail → "เข้าร่วมกิจกรรม" → confirm sheet with the participation consent (asked once, unticked) → "เข้าร่วมสำเร็จ"
// → back to the detail showing "เข้าร่วมแล้ว" and the updated count. Text details come before the map.
import { getPost, joinActivity, leaveActivity, listParticipants } from './api.js';
import { getUser, updateUser, sessionLost } from './auth.js';
import { requireAuth } from './auth-ui.js';
import { $, avatar, copyLink, escapeHTML, openDialog, pageHead, setupDialog, toast } from './dom.js';
import { markFeedStale } from './feed.js';
import { CATEGORY_LABELS, dayNumber, formatDateTime, formatWeekday, monthShort, seatsText, untilText } from './format.js';
import { bannerArt, icon } from './icons.js';
import { showPin } from './map.js';
import { menuButton, rememberPosts } from './post-actions.js';
import { syncReminders } from './native.js';

let current = null; // { main, post } while a detail page is shown
let busy = false;

const started = a => new Date(a.startsAt).getTime() <= Date.now();
const full = a => a.joinedCount >= a.capacity;

function renderActions() {
  const { post } = current, a = post.activity, bar = current.main.querySelector('#action-bar');
  const user = getUser();
  let html;
  if (post.deletedAt) {
    html = '<p class="error-message">กิจกรรมนี้ถูกยกเลิกแล้ว</p>';
  } else if (a.viewerStatus === 'host') {
    html = `<div class="row"><span class="pill pill-neutral">${icon('user', { size: 'sm' })}คุณเป็นผู้จัดกิจกรรมนี้</span><span class="spacer"></span>${started(a) ? '' : `<button class="button button-outline button-small" type="button" data-detail="ics">${icon('calendar', { size: 'sm' })}เพิ่มลงปฏิทิน</button>`}</div><p class="caption muted">ผู้จัดออกจากกิจกรรมของตัวเองไม่ได้ แก้ไขหรือยกเลิกได้จากปุ่ม ⋯ ด้านบน</p>`;
  } else if (a.viewerStatus === 'joined') {
    html = `<div class="row"><span class="pill pill-success" role="status">${icon('check', { size: 'sm' })}เข้าร่วมแล้ว</span><span class="spacer"></span>${started(a) ? '' : `<button class="button button-outline button-small" type="button" data-detail="ics">${icon('calendar', { size: 'sm' })}เพิ่มลงปฏิทิน</button>`}</div>
      ${started(a) ? '<p class="caption muted">กิจกรรมเริ่มแล้ว ออกจากกิจกรรมไม่ได้</p>' : '<button class="button button-danger-outline" type="button" data-detail="leave">ออกจากกิจกรรม</button>'}`;
  } else if (started(a)) {
    html = `<button class="button button-primary" type="button" disabled aria-describedby="join-note">เข้าร่วมกิจกรรม</button><p id="join-note" class="caption muted">กิจกรรมนี้เริ่มไปแล้ว</p>`;
  } else if (full(a)) {
    html = `<button class="button button-primary" type="button" disabled aria-describedby="join-note">กิจกรรมเต็มแล้ว</button><p id="join-note" class="caption muted">ที่ว่างครบ ${a.capacity} คนแล้ว ลองกลับมาดูอีกครั้ง ถ้ามีคนออก ที่จะว่างขึ้น</p>`;
  } else {
    html = `<button class="button button-primary" type="button" data-detail="join">เข้าร่วมกิจกรรม</button>
      ${user ? '' : '<p class="caption muted">ต้องเข้าสู่ระบบก่อนเข้าร่วม</p>'}`;
  }
  bar.innerHTML = html;
  current.main.querySelector('#detail-count').textContent = seatsText(a);
  const seatsBar = current.main.querySelector('#detail-seats-bar');
  if (seatsBar) seatsBar.style.width = `${Math.min(100, Math.round((a.joinedCount / a.capacity) * 100))}%`;
}

async function renderParticipants() {
  const { post } = current, section = current.main.querySelector('#participants');
  if (!['host', 'joined'].includes(post.activity.viewerStatus)) { section.hidden = true; section.innerHTML = ''; return; }
  section.hidden = false;
  section.innerHTML = '<h2 id="participants-title">ผู้เข้าร่วม</h2><p class="muted" role="status">กำลังโหลด…</p>';
  try {
    const { items } = await listParticipants(post.id);
    if (current?.post.id !== post.id) return;
    section.innerHTML = `<h2 id="participants-title">ผู้เข้าร่วม (${items.length})</h2>
      <p class="caption muted">เห็นได้เฉพาะผู้จัดและผู้ที่เข้าร่วมแล้ว</p>
      <ul class="participant-list">${items.map(p => `<li>${avatar({ id: p.username || p.displayName, name: p.displayName, username: p.username }, 'sm')}
        <span class="grow">${p.username ? `<a href="#/u/${encodeURIComponent(p.username)}">${escapeHTML(p.displayName)}</a> <span class="muted small">@${escapeHTML(p.username)}</span>` : `<strong>${escapeHTML(p.displayName)}</strong>`}</span>
        ${p.role === 'host' ? '<span class="pill pill-primary">ผู้จัด</span>' : ''}</li>`).join('')}</ul>`;
  } catch (error) {
    section.innerHTML = `<h2 id="participants-title">ผู้เข้าร่วม</h2><p class="error-message">${escapeHTML(error.message)}</p>`;
  }
}

function setPost(post) {
  current.post = post;
  rememberPosts([post]);
  renderActions();
  renderParticipants();
}

// Re-reads the post (after sign-in/out) so the buttons match the viewer.
export async function refreshDetail() {
  if (!current) return null;
  try { const post = await getPost(current.post.id); if (current) setPost(post); return post; }
  catch { return null; }
}

// ---- join sheet -------------------------------------------------------------
function summary(a) {
  return `<div class="card summary">
      <strong>${escapeHTML(a.title)}</strong>
      <p class="meta-line">${icon('clock', { size: 'sm' })}<span>${formatDateTime(a.startsAt)}</span></p>
      <p class="meta-line">${icon('pin', { size: 'sm' })}<span>${escapeHTML(a.meeting || a.location)}</span></p>
    </div>`;
}

function renderJoinConfirm() {
  const a = current.post.activity, user = getUser();
  const needsConsent = !user.participationConsent;
  $('join-body').innerHTML = `
    <div class="sheet-heading"><h2 id="join-title">ยืนยันการเข้าร่วม</h2><button class="icon-button" type="button" data-close aria-label="ปิด">${icon('x')}</button></div>
    ${summary(a)}
    <p class="caption muted">หลังเข้าร่วม: ${a.joinedCount + 1}/${a.capacity} คน รวมผู้จัด</p>
    ${needsConsent ? `
      <div class="stack-tight">
        <p class="caption">ระบบจะเก็บว่าคุณเข้าร่วมกิจกรรมไหน เพื่อแสดงสถานะ “เข้าร่วมแล้ว” ให้คุณ และให้ผู้จัดกับผู้เข้าร่วมเห็นชื่อคุณ ไม่ใช้กับระบบแนะนำ AI และไม่ใช้ตำแหน่ง GPS ของคุณ <a href="#/privacy" target="_blank" rel="noopener">อ่านนโยบายความเป็นส่วนตัว</a></p>
        <label class="checkbox-row"><input id="participation-consent" type="checkbox"><span>ยินยอมให้เก็บประวัติการเข้าร่วมเพื่อจัดการกิจกรรมของฉัน</span></label>
      </div>`
    : '<p class="caption muted">คุณให้ความยินยอมเก็บประวัติการเข้าร่วมไว้แล้ว</p>'}
    <p class="notice">${icon('shield', { size: 'sm' })}<span>นัดพบในพื้นที่สาธารณะ และตรวจสอบรายละเอียดก่อนไป การยืนยันอีเมลไม่ได้รับประกันตัวตนหรือความปลอดภัยของผู้อื่น</span></p>
    <p id="join-error" class="error-message" role="alert" hidden></p>
    <button id="join-confirm" class="button button-primary" type="button" ${needsConsent ? 'disabled aria-describedby="join-hint"' : ''}>ยืนยันเข้าร่วม</button>
    ${needsConsent ? '<p id="join-hint" class="caption muted">ติ๊กยินยอมด้านบนก่อน จึงจะยืนยันได้</p>' : ''}
    <button class="button button-outline" type="button" data-close>กลับไปดูกิจกรรม</button>`;
}

function renderJoinSuccess() {
  const a = current.post.activity;
  $('join-body').innerHTML = `
    <div class="success-panel" role="status">
      <h2 id="join-title" tabindex="-1">✓ เข้าร่วมสำเร็จ</h2>
      <p>คุณเข้าร่วม “${escapeHTML(a.title)}” แล้ว</p>
    </div>
    ${summary(a)}
    <p class="caption muted">ตอนนี้มีผู้เข้าร่วม ${a.joinedCount}/${a.capacity} คน รวมผู้จัด ระบบจะแจ้งเตือนก่อนกิจกรรมเริ่มตามที่ตั้งไว้ในหน้าตั้งค่า</p>
    <button class="button button-primary" type="button" data-close>ดูรายละเอียดกิจกรรม</button>`;
  $('join-title').focus();
}

function openJoin() {
  renderJoinConfirm();
  openDialog($('join-dialog'));
  ($('participation-consent') || $('join-confirm')).focus();
}

async function confirmJoin() {
  if (busy) return;
  const consentBox = $('participation-consent');
  busy = true;
  const button = $('join-confirm');
  button.disabled = true; button.textContent = 'กำลังเข้าร่วม…';
  try {
    const post = await joinActivity(current.post.id, Boolean(consentBox?.checked));
    if (consentBox?.checked) updateUser({ participationConsent: true });
    markFeedStale();
    setPost(post);
    renderJoinSuccess();
    syncReminders({ ask: true });
  } catch (error) {
    if (error.status === 401) sessionLost();
    const box = $('join-error');
    box.textContent = error.status === 401 ? 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง' : error.message;
    box.hidden = false;
    button.disabled = false; button.textContent = 'ยืนยันเข้าร่วม';
    if (['full', 'started'].includes(error.code)) refreshDetail();
  } finally { busy = false; }
}

async function confirmLeave() {
  if (busy) return;
  busy = true;
  const button = $('leave-confirm');
  button.disabled = true; button.textContent = 'กำลังออก…';
  try {
    const post = await leaveActivity(current.post.id);
    markFeedStale();
    setPost(post);
    syncReminders({ ask: true });
    $('leave-dialog').close();
    toast('ออกจากกิจกรรมแล้ว');
  } catch (error) {
    $('leave-error').textContent = error.message; $('leave-error').hidden = false;
  } finally { busy = false; button.disabled = false; button.textContent = 'ออกจากกิจกรรม'; }
}

export function setupDetail() {
  setupDialog($('join-dialog'), () => busy);
  setupDialog($('leave-dialog'), () => busy);
  $('join-body').addEventListener('change', event => {
    if (event.target.id !== 'participation-consent') return;
    $('join-confirm').disabled = !event.target.checked;
    $('join-hint').hidden = event.target.checked;
  });
  $('join-body').addEventListener('click', event => {
    if (event.target.closest('#join-confirm')) confirmJoin();
    if (event.target.closest('[data-close]') && !busy) $('join-dialog').close();
  });
  $('leave-confirm').addEventListener('click', confirmLeave);
}

// ---- calendar file (.ics), made in the browser ---------------------------------------------------
function downloadIcs(post) {
  const a = post.activity;
  const stamp = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const text = value => String(value).replace(/[\\;,]/g, char => `\\${char}`).replace(/\n/g, '\\n');
  const end = new Date(new Date(a.startsAt).getTime() + 2 * 3_600_000).toISOString();
  const link = `${location.origin}${location.pathname}#/activity/${post.id}`;
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//JoinGun//TH', 'BEGIN:VEVENT', `UID:${post.id}@joingun`, `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(a.startsAt)}`, `DTEND:${stamp(end)}`, `SUMMARY:${text(a.title)}`, `LOCATION:${text(a.location)}`,
    `DESCRIPTION:${text(`${a.meeting ? `จุดนัดพบ: ${a.meeting}\n` : ''}${link}`)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT60M', 'ACTION:DISPLAY', `DESCRIPTION:${text(a.title)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  anchor.download = 'joingun-activity.ics';
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 10_000);
}

// ---- page -------------------------------------------------------------------
export function renderDetail(main, post) {
  const a = post.activity;
  current = { main, post };
  const percent = Math.min(100, Math.round((a.joinedCount / a.capacity) * 100));
  const hasPin = a.lat !== null && a.lng !== null;
  main.innerHTML = `
    ${pageHead('กิจกรรม', { back: true, actions: `<button class="icon-button" type="button" data-detail-share aria-label="แชร์ลิงก์">${icon('share', { size: 'sm' })}</button>${post.deletedAt ? '' : menuButton(post)}` })}
    ${post.deletedAt ? '<p class="cancelled-banner" role="status">กิจกรรมนี้ถูกยกเลิกแล้ว</p>' : ''}
    <div class="detail-hero cat-${escapeHTML(a.category)}">${bannerArt(a.category)}</div>
    <div class="detail-head">
      <div class="date-badge" aria-hidden="true"><span>${escapeHTML(monthShort(a.startsAt))}</span><strong>${escapeHTML(dayNumber(a.startsAt))}</strong></div>
      <div class="grow">
        <p class="meta-line strong-time">${icon('clock', { size: 'sm' })}<span>${escapeHTML(a.completedAt ? 'จบแล้ว' : untilText(a.startsAt))}</span></p>
        <h1 tabindex="-1">${escapeHTML(a.title)}</h1>
        <div class="row-wrap"><span class="pill pill-primary">${escapeHTML(CATEGORY_LABELS[a.category] || a.category)}</span></div>
      </div>
    </div>

    <section class="detail-section" aria-labelledby="host-title">
      <h2 id="host-title" class="visually-hidden">ผู้จัด</h2>
      <div class="host-row">
        ${avatar({ id: post.author.id, name: post.author.name, username: post.author.username })}
        <div class="grow">
          <div class="row">${post.author.username ? `<a class="name" href="#/u/${encodeURIComponent(post.author.username)}">จัดโดย ${escapeHTML(post.author.name)}</a>` : `<strong>จัดโดย ${escapeHTML(post.author.name)}</strong>`}</div>
          ${post.author.username
            ? `<p class="small muted">@${escapeHTML(post.author.username)} · <span class="pill pill-primary">ยืนยันอีเมลสถานศึกษาแล้ว</span></p>`
            : '<p class="small muted">บัญชีตัวอย่างจากเวอร์ชันก่อน ไม่ได้ยืนยันอีเมล</p>'}
        </div>
      </div>
      <p class="notice">${icon('shield', { size: 'sm' })}<span>นัดพบในพื้นที่สาธารณะ และตรวจสอบรายละเอียดก่อนเข้าร่วม การยืนยันอีเมลไม่ได้รับประกันตัวตนหรือความปลอดภัยของผู้จัด <a href="#/safety">อ่านคำแนะนำความปลอดภัย</a></span></p>
    </section>

    <section class="detail-section" aria-labelledby="about-title">
      <h2 id="about-title">รายละเอียด</h2>
      <p class="post-text">${escapeHTML(post.content)}</p>
    </section>

    <section class="detail-section" aria-labelledby="when-title">
      <h2 id="when-title">รายละเอียดนัดหมาย</h2>
      <div class="info-grid">
        <div class="info-row"><span class="info-icon">${icon('calendar', { size: 'sm' })}</span><div><strong>${escapeHTML(formatWeekday(a.startsAt))} ${formatDateTime(a.startsAt)}</strong><span class="small muted">เวลาประเทศไทย</span></div></div>
        <div class="info-row"><span class="info-icon">${icon('pin', { size: 'sm' })}</span><div><strong>${escapeHTML(a.location)}</strong></div></div>
        <div class="info-row"><span class="info-icon">${icon('people', { size: 'sm' })}</span><div style="flex:1"><strong id="detail-count">${seatsText(a)}</strong>
          <div class="seats-bar" style="margin-top:6px" aria-hidden="true"><span id="detail-seats-bar" style="width:${percent}%"></span></div></div></div>
      </div>
    </section>

    <section class="detail-section" aria-labelledby="map-title">
      <h2 id="map-title">จุดนัดหมาย</h2>
      <p>${escapeHTML(a.meeting || a.location)}</p>
      <div id="detail-map" class="map"></div>
      ${hasPin ? `<div class="map-links">
        <a class="button button-outline button-small" href="https://www.google.com/maps/dir/?api=1&amp;destination=${a.lat},${a.lng}" target="_blank" rel="noopener noreferrer">${icon('navigation', { size: 'sm' })}นำทางด้วย Google Maps</a>
        <a class="button button-outline button-small" href="https://www.openstreetmap.org/?mlat=${a.lat}&amp;mlon=${a.lng}#map=18/${a.lat}/${a.lng}" target="_blank" rel="noopener noreferrer">${icon('map', { size: 'sm' })}เปิดใน OpenStreetMap</a>
      </div><p class="help">ปุ่มนำทางเปิดแอปแผนที่ภายนอก ซึ่งอาจขอตำแหน่งของคุณเอง JoinGun ไม่อ่านตำแหน่งของคุณ</p>` : ''}
    </section>

    <section id="participants" class="detail-section" aria-labelledby="participants-title" hidden></section>

    <div id="action-bar" class="action-bar"></div>`;

  main.querySelector('#action-bar').addEventListener('click', event => {
    const action = event.target.closest('[data-detail]')?.dataset.detail;
    if (action === 'join') {
      requireAuth('join', async () => {
        // After signing in, re-read the post: the person may be the host or already a member.
        const fresh = getUser() && current ? await refreshDetail() : null;
        const a2 = fresh?.activity ?? current?.post.activity;
        if (current && a2 && !a2.viewerStatus && !full(a2) && !started(a2)) openJoin();
      });
    }
    if (action === 'leave') { $('leave-error').hidden = true; openDialog($('leave-dialog')); }
    if (action === 'ics') downloadIcs(current.post);
  });
  main.querySelector('[data-detail-share]').addEventListener('click', () => copyLink(`#/activity/${encodeURIComponent(post.id)}`));
  setPost(post);

  const container = main.querySelector('#detail-map');
  let removeMap = () => {};
  if (!hasPin) {
    container.classList.add('map-fallback');
    container.textContent = 'ผู้จัดไม่ได้ปักหมุด ดูจุดนัดพบจากข้อความด้านบน';
  } else removeMap = showPin(container, a.lat, a.lng);
  return () => { removeMap(); current = null; };
}
