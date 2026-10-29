// Profile page (#/u/<username>): cover, avatar, bio, interests, friend button, and tabs for posts and the activity
// history. The history follows the owner's privacy setting (F5); the server decides who may see it.
import { acceptFriend, blockUser, cancelFriend, declineFriend, getHistory, getProfile, listPosts, removeFriend, sendFriendRequest, unblockUser } from './api.js';
import { getUser } from './auth.js';
import { requireAuth } from './auth-ui.js';
import { $, avatar, emptyState, escapeHTML, hue, pageHead, skeletonPosts, toast } from './dom.js';
import { CATEGORY_LABELS, YEAR_LABELS, dayNumber, formatDateTime, monthShort } from './format.js';
import { icon } from './icons.js';
import { confirmSheet } from './post-actions.js';
import { renderPosts } from './posts.js';
import { refreshBadges } from './shell.js';

let state = null; // { username, profile, tab, posts: {items,nextCursor} }
const VISIBILITY = { public: 'ทุกคนที่เข้าสู่ระบบ', friends: 'เฉพาะเพื่อน', private: 'เฉพาะฉัน' };

function friendButton(p) {
  if (p.relation === 'self') return '<a class="button button-outline button-small" href="#/settings#profile">แก้ไขโปรไฟล์</a>';
  if (p.blockedByMe) return `<button class="button button-danger-outline button-small" type="button" data-profile="unblock">${icon('ban', { size: 'sm' })}เลิกบล็อก</button>`;
  const more = `<button class="icon-button large" type="button" data-profile="more" aria-label="ตัวเลือกเพิ่มเติม" style="border:1px solid var(--color-border)">${icon('more', { size: 'sm' })}</button>`;
  if (p.relation === 'friends') return `<button class="button button-outline button-small" type="button" data-profile="unfriend">${icon('userCheck', { size: 'sm' })}เพื่อนกันแล้ว</button>${more}`;
  if (p.relation === 'outgoing') return `<button class="button button-outline button-small" type="button" data-profile="cancel">ยกเลิกคำขอ</button>${more}`;
  if (p.relation === 'incoming') return `<button class="button button-primary button-small" type="button" data-profile="accept">ตอบรับ</button><button class="button button-outline button-small" type="button" data-profile="decline">ปฏิเสธ</button>${more}`;
  return `<button class="button button-dark button-small" type="button" data-profile="add">${icon('userPlus', { size: 'sm' })}เพิ่มเพื่อน</button>${getUser() ? more : ''}`;
}

function header(p) {
  const joined = new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date(p.createdAt));
  return `
    <div class="profile-cover" style="--hue:${hue(p.id)}"></div>
    <div class="profile-top">
      ${avatar({ id: p.id, name: p.displayName }, 'lg')}
      <div class="profile-actions">${friendButton(p)}</div>
    </div>
    <div class="profile-info">
      <div>
        <h2 class="profile-name">${escapeHTML(p.displayName)}</h2>
        <p class="muted">@${escapeHTML(p.username)}</p>
      </div>
      ${p.bio ? `<p class="post-text">${escapeHTML(p.bio)}</p>` : ''}
      <div class="row-wrap">
        ${p.year ? `<span class="pill pill-neutral">${icon('book', { size: 'sm' })}${escapeHTML(YEAR_LABELS[p.year] || p.year)}</span>` : ''}
        ${p.interests.map(item => `<span class="pill pill-primary">${escapeHTML(CATEGORY_LABELS[item] || item)}</span>`).join('')}
        <span class="pill pill-neutral">${icon('calendar', { size: 'sm' })}เข้าร่วมเมื่อ ${escapeHTML(joined)}</span>
      </div>
      <div class="profile-stats">
        <span><strong>${p.stats.friends}</strong> เพื่อน</span>
        <span><strong>${p.stats.hosted}</strong> กิจกรรมที่จัด</span>
        <span><strong>${p.stats.joined}</strong> ครั้งที่เข้าร่วม</span>
      </div>
      ${p.relation === 'self' ? `<p class="small muted">${icon('lock', { size: 'sm' })} ประวัติการเข้าร่วมของคุณเห็นได้โดย: <strong>${VISIBILITY[p.historyVisibility]}</strong> · <a href="#/settings#privacy">เปลี่ยน</a></p>` : ''}
    </div>
    <div class="tabs" role="tablist" aria-label="เนื้อหาโปรไฟล์" style="border-bottom:1px solid var(--color-divider)">
      <button class="tab" role="tab" type="button" data-ptab="posts" aria-selected="${state.tab === 'posts'}">โพสต์</button>
      <button class="tab" role="tab" type="button" data-ptab="history" aria-selected="${state.tab === 'history'}">ประวัติการเข้าร่วม</button>
    </div>
    <div id="profile-list" class="feed" aria-live="polite"></div>
    <div class="load-more-wrap"><button id="profile-more" class="button button-outline" type="button" hidden>โหลดเพิ่ม</button></div>`;
}

async function loadTab({ more = false } = {}) {
  const list = $('profile-list');
  if (!list) return;
  const button = $('profile-more');
  if (state.tab === 'posts') {
    if (!more) { list.innerHTML = skeletonPosts(2); state.posts = { items: [], nextCursor: null }; }
    try {
      const page = await listPosts({ author: state.username, before: more ? state.posts.nextCursor : null });
      state.posts.items.push(...page.items);
      state.posts.nextCursor = page.nextCursor;
      list.innerHTML = state.posts.items.length ? renderPosts(state.posts.items) : emptyState('text', 'ยังไม่มีโพสต์', state.profile.relation === 'self' ? 'เริ่มชวนเพื่อนทำกิจกรรมได้เลย' : 'ผู้ใช้นี้ยังไม่ได้โพสต์อะไร');
      button.hidden = !state.posts.nextCursor;
    } catch (error) { list.innerHTML = `<div class="section-pad"><p class="error-message">${escapeHTML(error.message)}</p></div>`; }
    return;
  }
  button.hidden = true;
  if (!getUser()) { list.innerHTML = emptyState('lock', 'เข้าสู่ระบบเพื่อดูประวัติ', 'ประวัติการเข้าร่วมเห็นได้เฉพาะผู้ใช้ที่เข้าสู่ระบบ และตามที่เจ้าของตั้งไว้', '<button class="button button-primary" type="button" data-auth-open="login">เข้าสู่ระบบ</button>'); return; }
  if (!state.profile.historyVisible) { list.innerHTML = emptyState('lock', 'ประวัติถูกซ่อนไว้', 'เจ้าของโปรไฟล์ไม่ได้เปิดให้คุณเห็นประวัติการเข้าร่วม'); return; }
  list.innerHTML = skeletonPosts(1);
  try {
    const { items } = await getHistory(state.username);
    list.innerHTML = items.length ? items.map(item => `<a class="history-item" href="#/activity/${encodeURIComponent(item.id)}">
        <span class="mini-date" aria-hidden="true"><span>${escapeHTML(monthShort(item.startsAt))}</span><strong>${escapeHTML(dayNumber(item.startsAt))}</strong></span>
        <span class="grow"><strong style="display:block">${escapeHTML(item.title)}</strong><span class="small muted">${formatDateTime(item.startsAt)} · ${escapeHTML(item.location)}</span></span>
        <span class="pill ${item.role === 'host' ? 'pill-primary' : 'pill-neutral'}">${item.role === 'host' ? 'ผู้จัด' : 'ผู้เข้าร่วม'}</span>
        ${item.completedAt ? '<span class="pill pill-success">จบแล้ว</span>' : ''}</a>`).join('')
      : emptyState('calendar', 'ยังไม่มีประวัติ', 'ยังไม่ได้เข้าร่วมกิจกรรม');
  } catch (error) { list.innerHTML = `<div class="section-pad"><p class="error-message">${escapeHTML(error.message)}</p></div>`; }
}

async function act(action) {
  const p = state.profile;
  const reload = async message => { if (message) toast(message); state.profile = await getProfile(state.username); paint(); refreshBadges(); };
  try {
    if (action === 'add') await requireAuth('friend', async () => { await sendFriendRequest(p.id); reload('ส่งคำขอเป็นเพื่อนแล้ว'); });
    if (action === 'cancel') { await cancelFriend(p.requestId); reload('ยกเลิกคำขอแล้ว'); }
    if (action === 'accept') { await acceptFriend(p.requestId); reload(`เป็นเพื่อนกับ ${p.displayName} แล้ว`); }
    if (action === 'decline') { await declineFriend(p.requestId); reload('ปฏิเสธคำขอแล้ว'); }
    if (action === 'unblock') { await unblockUser(p.id); reload('เลิกบล็อกแล้ว'); }
    if (action === 'unfriend') confirmSheet({ title: `เลิกเป็นเพื่อนกับ ${p.displayName}?`, message: 'อีกฝ่ายจะไม่ได้รับแจ้ง คุณส่งคำขอใหม่ได้ภายหลัง', confirmLabel: 'เลิกเป็นเพื่อน', danger: true, onConfirm: async () => { await removeFriend(p.id); reload('เลิกเป็นเพื่อนแล้ว'); } });
    if (action === 'more') {
      confirmSheet({ title: `บล็อก @${p.username}?`, message: 'คุณจะไม่เห็นโพสต์ของผู้ใช้นี้ในฟีด ถ้าเป็นเพื่อนกันอยู่จะเลิกเป็นเพื่อน และเขาส่งคำขอเป็นเพื่อนถึงคุณไม่ได้ เขาจะไม่ได้รับแจ้ง', confirmLabel: 'บล็อก', danger: true, onConfirm: async () => { await blockUser(p.id); reload(`บล็อก @${p.username} แล้ว`); } });
    }
  } catch (error) { toast(error.message); }
}

function paint() {
  const main = state.main;
  main.innerHTML = `${pageHead(state.profile.displayName, { back: true, sub: `${state.profile.stats.hosted} กิจกรรมที่จัด` })}${header(state.profile)}`;
  loadTab();
}

export async function renderProfile(main, username) {
  state = { main, username, tab: 'posts', profile: null, posts: { items: [], nextCursor: null } };
  main.innerHTML = `${pageHead('โปรไฟล์', { back: true })}<div class="section-pad muted" role="status">กำลังโหลด…</div>`;
  try { state.profile = await getProfile(username); }
  catch (error) {
    main.innerHTML = `${pageHead('โปรไฟล์', { back: true })}${emptyState('user', error.status === 404 ? 'ไม่พบผู้ใช้นี้' : 'เปิดโปรไฟล์ไม่ได้', error.status === 404 ? 'บัญชีอาจถูกลบหรือชื่อผู้ใช้ไม่ถูกต้อง' : error.message)}`;
    return state.profile?.displayName;
  }
  paint();
  main.onclick = event => {
    const tab = event.target.closest('[data-ptab]');
    if (tab) {
      state.tab = tab.dataset.ptab;
      main.querySelectorAll('[data-ptab]').forEach(el => el.setAttribute('aria-selected', String(el === tab)));
      loadTab();
      return;
    }
    const action = event.target.closest('[data-profile]')?.dataset.profile;
    if (action) act(action);
    if (event.target.closest('#profile-more')) loadTab({ more: true });
  };
  return state.profile.displayName;
}

export const leaveProfile = main => { main.onclick = null; state = null; };
