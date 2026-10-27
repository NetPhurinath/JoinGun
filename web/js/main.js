// Entry point: hash router and global actions.
//   #/welcome            welcome page (first screen when signed out)
//   #/                   home feed (ล่าสุด / สำหรับคุณ / เพื่อน)
//   #/explore?q=…        search and filters
//   #/activity/<id>      activity detail and joining
//   #/u/<username>       profile
//   #/notifications, #/menu, #/friends, #/activities, #/settings, #/mod
//   #/terms, #/privacy, #/safety
import { getPost } from './api.js';
import { getUser, restoreSession, onAuthChange } from './auth.js';
import { renderWelcome, leaveWelcome, renderPolicy, requireAuth, setupAuthUI, openAuth } from './auth-ui.js';
import { $, copyLink, emptyState, pageHead, setupDialog, toast } from './dom.js';
import { renderHome, renderExplore, loadFeed, handleFeedAction, setupFeed, clearFilters, markFeedStale, takeFeedStale, currentView, resetHomeTab } from './feed.js';
import { renderDetail, refreshDetail, setupDetail } from './detail.js';
import { openCreate, setupCreate } from './create.js';
import { setupPostActions } from './post-actions.js';
import { renderSettings, scrollToSection } from './settings.js';
import { renderProfile } from './profile.js';
import { renderNotifications } from './notifications.js';
import { renderFriends } from './friends.js';
import { renderActivities } from './activities.js';
import { renderMod } from './mod.js';
import { setupShell, setPage, refreshBadges } from './shell.js';
import { renderMenu, leaveMenu } from './menu.js';
import { setupNative, syncReminders } from './native.js';

const main = $('main');
let cleanup = () => {};
let routeVersion = 0;
let inAppNavigations = 0;
let booted = false;

function parseRoute() {
  const raw = location.hash.replace(/^#/, '');
  const [pathAndQuery, section = ''] = raw.split('#');
  const [path, query = ''] = pathAndQuery.split('?');
  const params = new URLSearchParams(query);
  const clean = `/${path.replace(/^\/+/, '')}`;
  let match;
  if ((match = clean.match(/^\/activity\/([^/]+)$/))) return { page: 'activity', id: decodeURIComponent(match[1]) };
  if ((match = clean.match(/^\/u\/([^/]+)$/))) return { page: 'profile', username: decodeURIComponent(match[1]) };
  const simple = { '/welcome': 'welcome', '/explore': 'explore', '/notifications': 'notifications', '/friends': 'friends', '/activities': 'activities',
    '/settings': 'settings', '/account': 'settings', '/mod': 'mod', '/menu': 'menu', '/terms': 'policy', '/privacy': 'policy', '/safety': 'policy' };
  if (simple[clean]) return { page: simple[clean], key: clean.slice(1), params, section };
  return { page: 'feed', params, section };
}

function focusHeading(title) {
  document.title = title ? `${title} · JoinGun` : 'JoinGun';
  (main.querySelector('h1') || document.querySelector('#welcome-page h1'))?.focus({ preventScroll: true });
}

const NEEDS_ACCOUNT = { notifications: 'การแจ้งเตือน', friends: 'เพื่อน', activities: 'กิจกรรมของฉัน', settings: 'ตั้งค่า', mod: 'หน้าผู้ดูแล' };

async function route() {
  const version = ++routeVersion;
  cleanup(); cleanup = () => {};
  main.onclick = null; main.onchange = null;
  leaveMenu();
  main.classList.remove('page-enter'); void main.offsetWidth; main.classList.add('page-enter');
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  const r = parseRoute();
  if (r.page !== 'welcome') leaveWelcome();
  setPage(r.page === 'profile' && r.username === getUser()?.username ? 'profile' : r.page);
  window.scrollTo(0, 0);

  if (r.page === 'welcome') {
    if (!getUser()) { renderWelcome(main); focusHeading('ยินดีต้อนรับ'); return; }
    history.replaceState(null, '', '#/');
    return route();
  }
  if (NEEDS_ACCOUNT[r.page] && !getUser()) {
    main.innerHTML = `${pageHead(NEEDS_ACCOUNT[r.page])}${emptyState('lock', 'เข้าสู่ระบบก่อน', 'หน้านี้ใช้ได้เมื่อเข้าสู่ระบบด้วยอีเมลสถานศึกษา', '<button class="button button-primary" type="button" data-auth-open="login">เข้าสู่ระบบ</button>')}`;
    focusHeading(NEEDS_ACCOUNT[r.page]);
    requireAuth('account', () => route());
    return;
  }
  if (r.page === 'mod' && getUser().role !== 'moderator') {
    main.innerHTML = `${pageHead('หน้าผู้ดูแล', { back: true })}${emptyState('shield', 'เฉพาะผู้ดูแลระบบ', 'บัญชีของคุณไม่มีสิทธิ์เข้าหน้านี้')}`;
    focusHeading('หน้าผู้ดูแล');
    return;
  }
  switch (r.page) {
    case 'menu': renderMenu(main); focusHeading('เมนู'); return;
    case 'policy': focusHeading(renderPolicy(main, r.key, pageHead)); return;
    case 'notifications': renderNotifications(main); focusHeading('การแจ้งเตือน'); return;
    case 'friends': await renderFriends(main, r.params); if (version === routeVersion) focusHeading('เพื่อน'); return;
    case 'activities': await renderActivities(main); if (version === routeVersion) focusHeading('กิจกรรมของฉัน'); return;
    case 'mod': renderMod(main); focusHeading('หน้าผู้ดูแล'); return;
    case 'settings':
      await renderSettings(main);
      if (version !== routeVersion) return;
      focusHeading('ตั้งค่า');
      scrollToSection(r.section);
      return;
    case 'profile': {
      const title = await renderProfile(main, r.username);
      if (version === routeVersion) focusHeading(title || 'โปรไฟล์');
      return;
    }
    case 'activity': {
      main.innerHTML = `${pageHead('กิจกรรม', { back: true })}<p class="section-pad muted" role="status">กำลังโหลด…</p>`;
      try {
        const post = await getPost(r.id);
        if (version !== routeVersion) return;
        if (!post.activity) throw new Error('โพสต์นี้ไม่ใช่กิจกรรม');
        cleanup = renderDetail(main, post);
        focusHeading(post.activity.title);
      } catch (error) {
        if (version !== routeVersion) return;
        const message = error.status === 404 ? 'ไม่พบกิจกรรมนี้ อาจถูกลบหรือลิงก์ไม่ถูกต้อง' : error.message;
        main.innerHTML = `${pageHead('กิจกรรม', { back: true })}${emptyState('calendar', 'เปิดกิจกรรมไม่ได้', message, '<a class="button button-primary" href="#/">กลับหน้าแรก</a>')}`;
        focusHeading('เปิดกิจกรรมไม่ได้');
      }
      return;
    }
    case 'explore':
      renderExplore(main, r.params);
      focusHeading('สำรวจ');
      loadFeed();
      return;
    default: {
      const wasHome = currentView() === 'home';
      renderHome(main);
      focusHeading('หน้าแรก');
      // Reload when the list may be out of date (joined, left, signed in/out, or coming back from Explore).
      if (!wasHome || takeFeedStale() || !main.querySelector('.post')) loadFeed();
    }
  }
}

// Creating a post needs an account that is not suspended; a signed-out visitor signs in first.
function openCreateSignedIn(preset = null) {
  requireAuth('post', () => {
    if (getUser()?.suspended) { toast('บัญชีของคุณถูกระงับชั่วคราว จึงโพสต์ไม่ได้ ดูรายละเอียดที่หน้าตั้งค่า'); return; }
    openCreate(preset);
  });
}

document.addEventListener('click', event => {
  const action = event.target.closest('[data-action]');
  if (action) {
    if (action.dataset.action === 'create') openCreateSignedIn();
    else if (main.contains(action)) handleFeedAction(action.dataset.action, action, openCreateSignedIn);
    return;
  }
  const share = event.target.closest('[data-share]');
  if (share) { copyLink(`#/activity/${encodeURIComponent(share.dataset.share)}`); return; }
  // Back buttons return to the previous screen when it was inside the app.
  const back = event.target.closest('[data-back]');
  if (back && inAppNavigations > 0) { event.preventDefault(); history.back(); return; }
  const needsAuth = event.target.closest('[data-needs-auth]');
  if (needsAuth && !getUser()) { event.preventDefault(); requireAuth('account', () => { location.hash = needsAuth.getAttribute('href'); }); }
});

setupDialog($('filter-dialog'));
setupDialog($('generic-dialog'));
setupFeed(openCreateSignedIn);
setupAuthUI();
setupDetail();
setupShell();
// Buttons, badges and pages depend on who is signed in.
onAuthChange(user => {
  if (!booted) return;
  markFeedStale();
  syncReminders({ signedIn: Boolean(user), ask: Boolean(user) });
  const page = parseRoute().page;
  if (page === 'activity') refreshDetail();
  else if (page !== 'welcome') route();
  if (!user && NEEDS_ACCOUNT[page]) location.hash = '#/';
});
// After a post is deleted or its author blocked: leave a detail page that no longer applies, refresh the list.
setupPostActions(() => {
  markFeedStale();
  syncReminders();
  if (parseRoute().page === 'activity') location.hash = '#/';
  else route();
});
setupCreate(() => {
  // Show the new post at the top of the latest feed.
  clearFilters();
  resetHomeTab();
  markFeedStale();
  syncReminders({ ask: true });
  if (parseRoute().page !== 'feed') location.hash = '#/';
  else route();
}, () => {
  markFeedStale();
  syncReminders();
  if (parseRoute().page === 'activity') refreshDetail();
  else route();
});

window.addEventListener('hashchange', () => { inAppNavigations += 1; route(); });

// Pull to refresh on list screens: drag down from the top of the page.
const PULL_PAGES = ['feed', 'explore', 'notifications', 'activities', 'friends', 'menu', 'profile', 'mod'];
let pullStart = null;
const ptr = $('ptr');
document.addEventListener('touchstart', event => {
  pullStart = window.scrollY <= 0 && !document.querySelector('dialog[open]') && PULL_PAGES.includes(parseRoute().page) ? event.touches[0].clientY : null;
}, { passive: true });
document.addEventListener('touchmove', event => {
  if (pullStart === null) return;
  ptr.classList.toggle('pulling', event.touches[0].clientY - pullStart > 70);
}, { passive: true });
document.addEventListener('touchend', async () => {
  if (pullStart === null) return;
  pullStart = null;
  if (!ptr.classList.contains('pulling')) return;
  ptr.classList.replace('pulling', 'refreshing');
  markFeedStale();
  await route();
  refreshBadges();
  setTimeout(() => ptr.classList.remove('refreshing'), 400);
});

setupNative({ onResume: () => { if (getUser()) { refreshBadges(); syncReminders(); } } });
const unfinished = await restoreSession();
booted = true;
// First visit with no address: signed-out visitors see the welcome page, like X.
if (!location.hash && !getUser()) history.replaceState(null, '', '#/welcome');
route();
refreshBadges();
if (getUser()) syncReminders({ ask: true });
// A sign-up left halfway (code verified, terms or profile missing), or terms that changed, continue where they stopped.
if (unfinished) openAuth({ resume: unfinished });
