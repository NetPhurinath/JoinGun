// App shell for the phone-style layout: the bottom tab bar (หน้าแรก · สำรวจ · สร้าง · แจ้งเตือน · เมนู), unread badges,
// and system notifications while the app is open. The same layout is used on every screen size (a phone frame on
// wide screens).
import * as auth from './auth.js';
import { listFriends, listNotifications, modSummary, unreadCount } from './api.js';
import { $, avatar } from './dom.js';
import { icon } from './icons.js';
import { isNative } from './native.js';

const state = { unread: 0, requests: 0, mod: 0, page: 'feed', timer: null, lastSeenUnread: null };
const listeners = new Set();

const badge = count => (count ? `<span class="badge" aria-label="${count} รายการใหม่">${count > 99 ? '99+' : count}</span>` : '');
const current = pages => (pages.includes(state.page) ? 'aria-current="page"' : '');
const MENU_PAGES = ['menu', 'friends', 'activities', 'settings', 'mod', 'profile', 'policy'];

function renderTabs() {
  const user = auth.getUser();
  const menuIcon = user
    ? avatar({ id: user.id, name: user.displayName }, 'xs').replace('avatar-xs', 'avatar-xs tab-avatar')
    : icon('user');
  $('tabbar').innerHTML = `
    <a class="tab-link" href="#/" ${current(['feed'])} aria-label="หน้าแรก">${icon('home')}<span class="tab-label">หน้าแรก</span></a>
    <a class="tab-link" href="#/explore" ${current(['explore'])} aria-label="สำรวจ">${icon('search')}<span class="tab-label">สำรวจ</span></a>
    <button class="tab-create" type="button" data-action="create" aria-label="สร้างโพสต์">${icon('plus')}</button>
    <a class="tab-link" href="#/notifications" ${current(['notifications'])} aria-label="การแจ้งเตือน" ${user ? '' : 'data-needs-auth'}>${icon('bell')}${badge(state.unread)}<span class="tab-label">แจ้งเตือน</span></a>
    <a class="tab-link" href="#/menu" ${current(MENU_PAGES)} aria-label="เมนู">${menuIcon}${badge(state.requests + state.mod)}<span class="tab-label">เมนู</span></a>`;
}

export const badgeCounts = () => ({ unread: state.unread, requests: state.requests, mod: state.mod });
export const onBadges = listener => { listeners.add(listener); return () => listeners.delete(listener); };

export async function refreshBadges() {
  const user = auth.getUser();
  if (!user) { Object.assign(state, { unread: 0, requests: 0, mod: 0 }); renderTabs(); return; }
  try {
    const [{ unread }, friends, summary] = await Promise.all([
      unreadCount(), listFriends(), user.role === 'moderator' ? modSummary() : Promise.resolve(null),
    ]);
    const before = state.lastSeenUnread;
    Object.assign(state, { unread, requests: friends.incoming.length, mod: summary ? summary.openReports + summary.openAppeals + summary.openRecommendationReviews : 0 });
    state.lastSeenUnread = unread;
    renderTabs();
    listeners.forEach(listener => listener(badgeCounts()));
    if (before !== null && unread > before) browserNotify(unread - before);
  } catch (error) {
    if (error.status === 401) auth.sessionLost();
  }
}

export const suggestionReason = reasons => reasons.includes('mutual') ? 'มีเพื่อนร่วมกัน' : reasons.includes('activity') ? 'เคยอยู่กิจกรรมเดียวกัน' : 'สนใจกิจกรรมคล้ายกัน';

const NOTE_TEXT = {
  'activity.reminder': n => `“${n.activityTitle}” ใกล้เริ่มแล้ว`,
  'friend.request': n => `${n.actor?.name} ส่งคำขอเป็นเพื่อน`,
  'friend.accept': n => `${n.actor?.name} ตอบรับคำขอเป็นเพื่อนแล้ว`,
  'activity.join': n => `${n.actor?.name} เข้าร่วม “${n.activityTitle}”`,
  'activity.cancelled': n => `“${n.activityTitle}” ถูกยกเลิก`,
};
// Browser tabs only: the Android app gets reminders from scheduled local notifications instead (native.js).
async function browserNotify(count) {
  if (isNative() || !('Notification' in window) || Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
  try {
    const { items } = await listNotifications();
    for (const note of items.filter(n => !n.read).slice(0, Math.min(count, 3))) {
      const text = NOTE_TEXT[note.type]?.(note) || 'มีการแจ้งเตือนใหม่ใน JoinGun';
      const n = new Notification('JoinGun', { body: text, icon: 'favicon.svg', tag: note.id });
      n.onclick = () => { window.focus(); location.hash = note.postId ? `#/activity/${note.postId}` : '#/notifications'; };
    }
  } catch { /* ignore */ }
}

export function setPage(page) {
  state.page = page;
  renderTabs();
}

// The test-version banner floats above the tab bar; content and the sticky action bar make room for its height plus its lift.
function trackDemoBanner() {
  const banner = $('demo-banner');
  if (!banner) return;
  const update = () => {
    const height = banner.offsetHeight ? banner.offsetHeight + parseFloat(getComputedStyle(banner).getPropertyValue('--demo-banner-lift') || 0) : 0;
    document.documentElement.style.setProperty('--demo-banner-h', `${height}px`);
  };
  update();
  if (window.ResizeObserver) new ResizeObserver(update).observe(banner);
}

export function setupShell() {
  trackDemoBanner();
  auth.onAuthChange(() => { state.lastSeenUnread = null; renderTabs(); refreshBadges(); });
  renderTabs();
  refreshBadges();
  clearInterval(state.timer);
  state.timer = setInterval(() => { if (auth.getUser() && document.visibilityState === 'visible') refreshBadges(); }, 30_000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && auth.getUser()) refreshBadges(); });
}
