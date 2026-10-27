// Notifications page (#/notifications): reminders, friend requests, joins and changes to activities (F4).
import { listNotifications, markRead } from './api.js';
import { $, avatar, emptyState, escapeHTML, pageHead, skeletonPosts, toast } from './dom.js';
import { formatDateTime, relativeTime } from './format.js';
import { icon } from './icons.js';
import { refreshBadges } from './shell.js';
import { isNative } from './native.js';

const OUTCOME = { dismiss: 'ตรวจแล้ว ไม่พบการละเมิด', 'remove-post': 'ลบโพสต์ที่ถูกรายงานแล้ว', 'suspend-user': 'ระงับบัญชีที่ถูกรายงานแล้ว' };
const name = n => `<strong>${escapeHTML(n.actor?.name || 'ผู้ใช้ JoinGun')}</strong>`;
const title = n => `<strong>${escapeHTML(n.activityTitle || 'กิจกรรม')}</strong>`;

// [icon, colour, html text, link]
function describe(n) {
  const activity = n.postId ? `#/activity/${encodeURIComponent(n.postId)}` : '#/notifications';
  switch (n.type) {
    case 'activity.reminder': return ['clock', 'amber', `${title(n)} จะเริ่ม${n.startsAt ? ` ${formatDateTime(n.startsAt)}` : 'เร็ว ๆ นี้'} อย่าลืมไปตามนัดนะ`, activity];
    case 'friend.request': return ['userPlus', '', `${name(n)} ส่งคำขอเป็นเพื่อน`, '#/friends?tab=requests'];
    case 'friend.accept': return ['userCheck', 'green', `${name(n)} ตอบรับคำขอเป็นเพื่อนแล้ว`, n.actor?.username ? `#/u/${encodeURIComponent(n.actor.username)}` : '#/friends'];
    case 'activity.join': return ['people', 'green', `${name(n)} เข้าร่วม ${title(n)} ของคุณ`, activity];
    case 'activity.leave': return ['people', '', `${name(n)} ออกจาก ${title(n)}`, activity];
    case 'activity.updated': return ['edit', '', `ผู้จัดแก้ไขรายละเอียด ${title(n)} ตรวจสอบวันเวลาและสถานที่อีกครั้ง`, activity];
    case 'activity.cancelled': return ['x', 'red', `${title(n)} ถูกยกเลิก${n.data?.byModerator ? 'โดยผู้ดูแล' : 'โดยผู้จัด'}`, activity];
    case 'report.reviewed': return ['shieldCheck', 'green', `ผู้ดูแลตรวจสอบรายงานของคุณแล้ว: ${escapeHTML(OUTCOME[n.data?.outcome] || 'ดำเนินการแล้ว')}`, '#/notifications'];
    case 'post.removed': return ['trash', 'red', `ผู้ดูแลลบโพสต์ของคุณ${n.data?.reason ? `: ${escapeHTML(n.data.reason)}` : ''}`, '#/settings#appeal'];
    case 'account.suspended': return ['ban', 'red', `บัญชีของคุณถูกระงับชั่วคราว: ${escapeHTML(n.data?.reason || '')} ขอให้ทบทวนได้ที่หน้าตั้งค่า`, '#/settings#appeal'];
    case 'account.restored': return ['shieldCheck', 'green', 'ผู้ดูแลยกเลิกการระงับบัญชีของคุณแล้ว', '#/settings'];
    case 'account.appeal-upheld': return ['shield', 'amber', `ผู้ดูแลทบทวนแล้วและยังคงการระงับไว้${n.data?.note ? `: ${escapeHTML(n.data.note)}` : ''}`, '#/settings#appeal'];
    default: return ['bell', '', 'มีการแจ้งเตือนใหม่', '#/notifications'];
  }
}

let state = { items: [], nextCursor: null };

function row(n) {
  const [iconName, colour, text, href] = describe(n);
  return `<a class="note ${n.read ? '' : 'unread'}" href="${href}" data-note="${escapeHTML(n.id)}">
    ${n.actor && ['friend.request', 'friend.accept', 'activity.join', 'activity.leave'].includes(n.type) ? avatar({ id: n.actor.id, name: n.actor.name }, '') : `<span class="note-icon ${colour}">${icon(iconName, { size: 'sm' })}</span>`}
    <span class="note-body"><span>${text}</span><br><time class="note-time" datetime="${escapeHTML(n.createdAt)}">${relativeTime(n.createdAt)}</time>${n.read ? '' : '<span class="visually-hidden"> (ยังไม่อ่าน)</span>'}</span></a>`;
}

function permissionCard() {
  if (isNative() || !('Notification' in window)) return '';
  if (Notification.permission === 'granted') return '';
  if (Notification.permission === 'denied') return `<div class="section-pad"><p class="notice notice-warning">${icon('info', { size: 'sm' })}<span>เบราว์เซอร์บล็อกการแจ้งเตือนของ JoinGun ไว้ เปิดได้ในการตั้งค่าเว็บไซต์ของเบราว์เซอร์ ระหว่างนี้คุณยังเห็นการแจ้งเตือนในหน้านี้และทางอีเมล (ถ้าเปิดไว้)</span></p></div>`;
  return `<div class="section-pad"><div class="card"><div class="row">${icon('bell')}<strong>เปิดการแจ้งเตือนบนเบราว์เซอร์</strong></div>
    <p class="caption muted">ให้เบราว์เซอร์เด้งเตือนเมื่อกิจกรรมใกล้เริ่มหรือมีคำขอเป็นเพื่อน ขณะเปิด JoinGun ค้างไว้ในแท็บ ถ้าอยากได้รับแม้ปิดแอป ให้เปิดการเตือนทางอีเมลในหน้าตั้งค่า</p>
    <button class="button button-primary button-inline" type="button" data-notes="permission">เปิดการแจ้งเตือน</button></div></div>`;
}

async function load(more = false) {
  const list = $('notes-list');
  if (!list) return;
  if (!more) list.innerHTML = skeletonPosts(3);
  try {
    const page = await listNotifications(more ? state.nextCursor : null);
    state.items = more ? [...state.items, ...page.items] : page.items;
    state.nextCursor = page.nextCursor;
    list.innerHTML = state.items.length ? state.items.map(row).join('') : emptyState('bell', 'ยังไม่มีการแจ้งเตือน', 'เมื่อมีคนเข้าร่วมกิจกรรมของคุณ ส่งคำขอเป็นเพื่อน หรือกิจกรรมใกล้เริ่ม จะแสดงที่นี่');
    $('notes-more').hidden = !state.nextCursor;
  } catch (error) { list.innerHTML = `<div class="section-pad"><p class="error-message">${escapeHTML(error.message)}</p></div>`; }
}

export function renderNotifications(main) {
  main.innerHTML = `${pageHead('การแจ้งเตือน', { actions: `<button class="button button-outline button-small" type="button" data-notes="read-all">${icon('check', { size: 'sm' })}อ่านทั้งหมด</button><a class="icon-button" href="#/settings#notifications" aria-label="ตั้งค่าการแจ้งเตือน">${icon('settings', { size: 'sm' })}</a>` })}
    ${permissionCard()}
    <div id="notes-list" class="feed" aria-live="polite"></div>
    <div class="load-more-wrap"><button id="notes-more" class="button button-outline" type="button" hidden>โหลดเพิ่ม</button></div>`;
  main.onclick = async event => {
    const note = event.target.closest('[data-note]');
    if (note && note.classList.contains('unread')) { markRead([note.dataset.note]).then(refreshBadges).catch(() => {}); }
    const action = event.target.closest('[data-notes]')?.dataset.notes;
    if (action === 'read-all') {
      try { await markRead('all'); toast('อ่านทั้งหมดแล้ว'); refreshBadges(); load(); } catch (error) { toast(error.message); }
    }
    if (action === 'permission') {
      const result = await Notification.requestPermission();
      toast(result === 'granted' ? 'เปิดการแจ้งเตือนบนเบราว์เซอร์แล้ว' : 'ยังไม่ได้เปิดการแจ้งเตือน');
      renderNotifications(main);
    }
    if (event.target.closest('#notes-more')) load(true);
  };
  load();
}
