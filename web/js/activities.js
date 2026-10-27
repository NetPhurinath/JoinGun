// "กิจกรรมของฉัน" (#/activities): upcoming and past activities the person hosts or joined.
import { myActivities } from './api.js';
import { $, emptyState, escapeHTML, pageHead, skeletonPosts } from './dom.js';
import { eventCard } from './posts.js';
import { rememberPosts } from './post-actions.js';

let tab = 'upcoming';
let data = { upcoming: [], past: [] };

function paint() {
  const list = $('my-list');
  if (!list) return;
  const items = data[tab];
  rememberPosts(items);
  list.innerHTML = items.length
    ? `<div class="stack section-pad">${items.map(post => eventCard(post)).join('')}</div>`
    : tab === 'upcoming'
      ? emptyState('calendar', 'ยังไม่มีกิจกรรมที่จะถึง', 'หากิจกรรมที่สนใจแล้วกดเข้าร่วม หรือสร้างกิจกรรมของคุณเอง', '<a class="button button-primary" href="#/explore">สำรวจกิจกรรม</a>')
      : emptyState('clock', 'ยังไม่มีกิจกรรมที่ผ่านมา', 'กิจกรรมที่จบหรือถูกยกเลิกจะย้ายมาอยู่ที่นี่');
}

const tabs = () => `<div class="tabs" role="tablist" aria-label="กิจกรรมของฉัน">
  <button class="tab" role="tab" type="button" data-my="upcoming" aria-selected="${tab === 'upcoming'}">กำลังจะถึง (${data.upcoming.length})</button>
  <button class="tab" role="tab" type="button" data-my="past" aria-selected="${tab === 'past'}">ที่ผ่านมา (${data.past.length})</button></div>`;

export async function renderActivities(main) {
  tab = 'upcoming';
  main.innerHTML = `<div id="my-head">${pageHead('กิจกรรมของฉัน', { back: '#/menu', tabs: tabs() })}</div><div id="my-list">${skeletonPosts(2)}</div>`;
  main.onclick = event => {
    const t = event.target.closest('[data-my]');
    if (!t) return;
    tab = t.dataset.my;
    $('my-head').innerHTML = pageHead('กิจกรรมของฉัน', { back: '#/menu', tabs: tabs() });
    paint();
  };
  try { data = await myActivities(); }
  catch (error) { $('my-list').innerHTML = `<div class="section-pad"><p class="error-message">${escapeHTML(error.message)}</p></div>`; return; }
  $('my-head').innerHTML = pageHead('กิจกรรมของฉัน', { back: '#/menu', tabs: tabs() });
  paint();
}
