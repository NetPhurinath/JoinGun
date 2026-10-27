// Friends page (#/friends): friends, requests received and sent, and finding people (backlog 5.1, 5.2).
import { acceptFriend, cancelFriend, declineFriend, friendSuggestions, listFriends, removeFriend, searchUsers, sendFriendRequest } from './api.js';
import { $, avatar, debounce, emptyState, escapeHTML, pageHead, skeletonPosts, toast } from './dom.js';
import { CATEGORY_LABELS, YEAR_LABELS } from './format.js';
import { icon } from './icons.js';
import { confirmSheet } from './post-actions.js';
import { refreshBadges, suggestionReason } from './shell.js';

let tab = 'friends';
let data = { items: [], incoming: [], outgoing: [] };

const meta = person => [person.year ? YEAR_LABELS[person.year] : '', ...person.interests.map(i => CATEGORY_LABELS[i])].filter(Boolean).join(' · ');

function personRow(person, actions, sub = '') {
  return `<div class="list-item">${avatar(person)}
    <div class="grow"><a class="name" href="#/u/${encodeURIComponent(person.username)}">${escapeHTML(person.displayName)}</a>
      <div class="small muted ellipsis">@${escapeHTML(person.username)}${sub || meta(person) ? ` · ${escapeHTML(sub || meta(person))}` : ''}</div></div>
    <div class="row">${actions}</div></div>`;
}

function relationButton(person) {
  if (person.relation === 'friends') return '<span class="pill pill-success">เพื่อน</span>';
  if (person.relation === 'outgoing') return '<span class="pill pill-neutral">ส่งคำขอแล้ว</span>';
  if (person.relation === 'incoming') return `<a class="button button-primary button-small" href="#/friends?tab=requests">ตอบรับ</a>`;
  return `<button class="button button-dark button-small" type="button" data-friend="add" data-id="${escapeHTML(person.id)}">เพิ่มเพื่อน</button>`;
}

async function renderTab() {
  const box = $('friends-body');
  if (!box) return;
  if (tab === 'friends') {
    box.innerHTML = data.items.length ? data.items.map(f => personRow(f, `<button class="button button-outline button-small" type="button" data-friend="remove" data-id="${escapeHTML(f.id)}" data-name="${escapeHTML(f.displayName)}">เพื่อน ${icon('check', { size: 'sm' })}</button>`)).join('')
      : emptyState('users', 'ยังไม่มีเพื่อน', 'ค้นหาคนที่รู้จัก หรือเพิ่มเพื่อนจากกิจกรรมที่เคยไปด้วยกัน', '<button class="button button-primary" type="button" data-friend-tab="find">หาเพื่อน</button>');
  }
  if (tab === 'requests') {
    box.innerHTML = data.incoming.length ? data.incoming.map(r => personRow(r.user, `<button class="button button-primary button-small" type="button" data-friend="accept" data-id="${escapeHTML(r.id)}">ตอบรับ</button>
      <button class="button button-outline button-small" type="button" data-friend="decline" data-id="${escapeHTML(r.id)}">ปฏิเสธ</button>`)).join('')
      : emptyState('userPlus', 'ไม่มีคำขอใหม่', 'คำขอเป็นเพื่อนที่คุณได้รับจะแสดงที่นี่');
  }
  if (tab === 'sent') {
    box.innerHTML = data.outgoing.length ? data.outgoing.map(r => personRow(r.user, `<button class="button button-outline button-small" type="button" data-friend="cancel" data-id="${escapeHTML(r.id)}">ยกเลิกคำขอ</button>`)).join('')
      : emptyState('userPlus', 'ไม่มีคำขอที่ส่งไว้', 'คำขอที่คุณส่งและยังไม่ได้รับคำตอบจะแสดงที่นี่');
  }
  if (tab === 'find') {
    box.innerHTML = `<div class="section-pad"><div class="search-box">${icon('search', { size: 'sm' })}<label class="visually-hidden" for="people-search">ค้นหาผู้ใช้</label>
      <input id="people-search" type="search" maxlength="50" autocomplete="off" placeholder="ค้นหาด้วยชื่อหรือ @ชื่อผู้ใช้"></div>
      <p class="help" style="margin-top:6px">ค้นหาได้ด้วยชื่อที่แสดงและชื่อผู้ใช้เท่านั้น ไม่มีใครค้นหาคุณด้วยอีเมลได้</p></div>
      <div id="people-list"></div>`;
    const input = $('people-search');
    const showSuggestions = async () => {
      $('people-list').innerHTML = skeletonPosts(1);
      try {
        const { items } = await friendSuggestions();
        $('people-list').innerHTML = items.length ? `<div class="feed-status"><strong>คนที่คุณอาจรู้จัก</strong></div>${items.map(p => personRow({ ...p, relation: 'none' }, relationButton({ ...p, relation: 'none' }), suggestionReason(p.reasons))).join('')}`
          : '<p class="section-pad muted">พิมพ์ชื่อเพื่อค้นหา</p>';
      } catch { $('people-list').innerHTML = ''; }
    };
    input.addEventListener('input', debounce(async () => {
      const q = input.value.trim();
      if (!q) return showSuggestions();
      try {
        const { items } = await searchUsers(q);
        if (input.value.trim() !== q) return;
        $('people-list').innerHTML = items.length ? items.map(p => personRow(p, relationButton(p))).join('') : emptyState('search', 'ไม่พบผู้ใช้', 'ลองพิมพ์ชื่ออื่น');
      } catch (error) { $('people-list').innerHTML = `<p class="section-pad error-message">${escapeHTML(error.message)}</p>`; }
    }, 300));
    showSuggestions();
    input.focus({ preventScroll: true });
  }
}

function tabs() {
  const count = n => (n ? `<span class="count">${n}</span>` : '');
  return `<div class="tabs" role="tablist" aria-label="เพื่อน">
    <button class="tab" role="tab" type="button" data-friend-tab="friends" aria-selected="${tab === 'friends'}">เพื่อน${count(0)}</button>
    <button class="tab" role="tab" type="button" data-friend-tab="requests" aria-selected="${tab === 'requests'}">คำขอ${count(data.incoming.length)}</button>
    <button class="tab" role="tab" type="button" data-friend-tab="sent" aria-selected="${tab === 'sent'}">ส่งแล้ว</button>
    <button class="tab" role="tab" type="button" data-friend-tab="find" aria-selected="${tab === 'find'}">หาเพื่อน</button></div>`;
}

async function reload() {
  try { data = await listFriends(); } catch (error) { toast(error.message); }
  const head = $('friends-head');
  if (head) head.innerHTML = pageHead('เพื่อน', { back: '#/menu', sub: `${data.items.length} คน`, tabs: tabs() });
  renderTab();
  refreshBadges();
}

export async function renderFriends(main, params) {
  tab = ['friends', 'requests', 'sent', 'find'].includes(params.get('tab')) ? params.get('tab') : 'friends';
  main.innerHTML = `<div id="friends-head">${pageHead('เพื่อน', { back: '#/menu', tabs: tabs() })}</div><div id="friends-body">${skeletonPosts(2)}</div>`;
  main.onclick = async event => {
    const t = event.target.closest('[data-friend-tab]');
    if (t) { tab = t.dataset.friendTab; $('friends-head').innerHTML = pageHead('เพื่อน', { back: '#/menu', sub: `${data.items.length} คน`, tabs: tabs() }); renderTab(); return; }
    const button = event.target.closest('[data-friend]');
    if (!button) return;
    const { friend: action, id, name } = button.dataset;
    if (action === 'remove') {
      confirmSheet({ title: `เลิกเป็นเพื่อนกับ ${name}?`, message: 'อีกฝ่ายจะไม่ได้รับแจ้ง คุณส่งคำขอใหม่ได้ภายหลัง', confirmLabel: 'เลิกเป็นเพื่อน', danger: true, onConfirm: async () => { await removeFriend(id); toast('เลิกเป็นเพื่อนแล้ว'); reload(); } });
      return;
    }
    button.disabled = true;
    try {
      if (action === 'add') { await sendFriendRequest(id); button.outerHTML = '<span class="pill pill-neutral">ส่งคำขอแล้ว</span>'; toast('ส่งคำขอเป็นเพื่อนแล้ว'); return; }
      if (action === 'accept') { await acceptFriend(id); toast('เป็นเพื่อนกันแล้ว'); }
      if (action === 'decline') { await declineFriend(id); toast('ปฏิเสธคำขอแล้ว'); }
      if (action === 'cancel') { await cancelFriend(id); toast('ยกเลิกคำขอแล้ว'); }
      reload();
    } catch (error) { button.disabled = false; toast(error.message); }
  };
  await reload();
}
