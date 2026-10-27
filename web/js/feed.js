// Home ("หน้าแรก": tabs ล่าสุด / สำหรับคุณ / เพื่อน, with a Facebook-style composer) and Explore ("สำรวจ": search,
// category chips, filters and people search). Lists load one page at a time from the API (NFR1).
import { getRecommendations, grantAiConsent, listPosts, myActivities, recommendationFeedback, searchUsers } from './api.js';
import { getUser } from './auth.js';
import { requireAuth } from './auth-ui.js';
import { $, avatar, debounce, emptyState, escapeHTML, openDialog, openGeneric, pageHead, skeletonPosts, toast } from './dom.js';
import { CATEGORY_LABELS, dayNumber, formatDay, formatTime, monthShort, untilText } from './format.js';
import { icon } from './icons.js';
import { renderPosts } from './posts.js';

export const filters = { category: 'all', date: '', q: '', open: false };
const feed = { items: [], nextCursor: null, total: 0, loading: false, error: '', request: 0, mode: 'latest' };
let view = 'home'; // 'home' | 'explore'
let homeTab = 'latest'; // 'latest' | 'foryou' | 'friends'
let stale = false;
export const markFeedStale = () => { stale = true; };
export const takeFeedStale = () => { const was = stale; stale = false; return was; };

const hasFilters = () => filters.category !== 'all' || filters.date || filters.q.trim() || filters.open;

// ---- list rendering ----------------------------------------------------------------------------
function renderList() {
  const list = $('feed-list');
  if (!list) return;
  const status = $('feed-status');
  if (status) {
    const summary = [];
    if (filters.category !== 'all') summary.push(CATEGORY_LABELS[filters.category]);
    if (filters.date) summary.push(`วันที่ ${formatDay(filters.date)}`);
    if (filters.open) summary.push('ยังรับคน');
    if (filters.q.trim()) summary.push(`“${filters.q.trim()}”`);
    status.hidden = view === 'home';
    status.innerHTML = `<span class="caption muted" role="status">${feed.loading && !feed.items.length ? 'กำลังค้นหา…' : `พบ ${feed.total} โพสต์`}${summary.length ? ` · ${escapeHTML(summary.join(' · '))}` : ''}</span>
      ${hasFilters() ? '<button class="text-button" type="button" data-action="clear">ล้างตัวกรอง</button>' : ''}`;
  }
  const more = $('load-more');
  if (feed.loading && !feed.items.length) { list.innerHTML = skeletonPosts(); list.setAttribute('aria-busy', 'true'); more.hidden = true; return; }
  list.removeAttribute('aria-busy');
  if (feed.error && !feed.items.length) {
    list.innerHTML = `<div class="section-pad stack"><p class="error-message">${escapeHTML(feed.error)}</p><button class="button button-outline button-inline" type="button" data-action="retry">ลองอีกครั้ง</button></div>`;
    more.hidden = true;
    return;
  }
  if (!feed.items.length) {
    if (view === 'explore' && hasFilters()) list.innerHTML = emptyState('search', 'ไม่พบโพสต์ที่ตรงกัน', 'ลองเปลี่ยนคำค้นหาหรือตัวกรอง', '<button class="button button-outline" type="button" data-action="clear">ล้างตัวกรอง</button>');
    else if (feed.mode === 'friends') list.innerHTML = emptyState('users', 'ยังไม่มีโพสต์จากเพื่อน', 'เพิ่มเพื่อนเพื่อดูว่าพวกเขาชวนทำอะไร', '<a class="button button-primary" href="#/friends?tab=find">หาเพื่อน</a>');
    else list.innerHTML = emptyState('calendar', 'ยังไม่มีโพสต์', 'เริ่มชวนเพื่อนทำกิจกรรมได้เลย', '<button class="button button-primary" type="button" data-action="create">สร้างโพสต์แรก</button>');
  } else list.innerHTML = renderPosts(feed.items);
  more.hidden = !feed.nextCursor && !feed.error;
  more.disabled = feed.loading;
  more.textContent = feed.loading ? 'กำลังโหลด…' : feed.error ? 'โหลดไม่สำเร็จ ลองอีกครั้ง' : 'โหลดเพิ่ม';
}

export async function loadFeed({ reset = true } = {}) {
  if (view === 'home' && homeTab === 'foryou') return loadRecommendations();
  const request = ++feed.request;
  if (reset) { feed.items = []; feed.nextCursor = null; }
  feed.mode = view === 'home' ? homeTab : 'explore';
  feed.loading = true; feed.error = '';
  renderList();
  try {
    const query = view === 'home' ? { scope: homeTab === 'friends' ? 'friends' : 'all' } : { ...filters };
    const page = await listPosts({ ...query, before: reset ? null : feed.nextCursor });
    if (request !== feed.request) return;
    feed.items = reset ? page.items : [...feed.items, ...page.items.filter(p => !feed.items.some(old => old.id === p.id))];
    feed.nextCursor = page.nextCursor;
    feed.total = page.total;
  } catch (error) {
    if (request !== feed.request) return;
    feed.error = error.message;
  } finally {
    if (request === feed.request) { feed.loading = false; renderList(); }
  }
}

// ---- "สำหรับคุณ": recommendations with their reasons (LR4) ------------------------------------------
function consentCard() {
  return `<div class="section-pad stack">
    <div class="card stack">
      <span class="pill pill-ai">${icon('sparkle', { size: 'sm' })}ระบบแนะนำกิจกรรม (AI)</span>
      <h2>ให้ JoinGun ช่วยหากิจกรรมที่น่าจะชอบ</h2>
      <p class="muted">ถ้าคุณเปิดใช้ ระบบจะให้คะแนนกิจกรรมที่ยังไม่เริ่มจาก:</p>
      <ul class="terms-summary"><li>ความสนใจที่คุณเลือกในโปรไฟล์</li><li>หมวดกิจกรรมที่คุณเคยเข้าร่วมใน 6 เดือนที่ผ่านมา</li><li>เพื่อนของคุณที่จัดหรือเข้าร่วม</li><li>เวลาที่ใกล้จะเริ่ม</li></ul>
      <p class="caption muted">ไม่ใช้ชั้นปี เพศ คณะ หรือตำแหน่งของคุณ ไม่ส่งข้อมูลให้บริการ AI ภายนอก ทุกคำแนะนำจะบอกเหตุผล คำแนะนำอาจไม่ตรงใจ และไม่ได้รับประกันความปลอดภัยหรือตัวตนของผู้จัด ปิดได้ตลอดเวลาที่หน้าตั้งค่า</p>
      <label class="checkbox-row"><input type="checkbox" id="ai-ack"><span>ฉันยินยอมให้ใช้ความสนใจ ประวัติการเข้าร่วม และรายชื่อเพื่อนของฉันเพื่อแนะนำกิจกรรม และรับทราบข้อจำกัดข้างต้น</span></label>
      <p id="ai-error" class="error-message" role="alert" hidden></p>
      <button class="button button-primary" type="button" data-action="ai-enable">เปิดใช้ระบบแนะนำ</button>
    </div></div>`;
}

function reasonBox(item) {
  return `<div class="ai-reason">
    <div class="row"><span class="pill pill-ai">${icon('sparkle', { size: 'sm' })}แนะนำโดยระบบ AI</span><span class="small muted">คะแนน ${item.score}/100</span></div>
    <strong>ทำไมถึงแนะนำ</strong>
    <ul>${item.factors.map(f => `<li>${escapeHTML(f.label)} <span class="muted">(${f.points > 0 ? '+' : ''}${f.points})</span></li>`).join('')}</ul>
    <div class="row-wrap">
      <button class="button button-outline button-small" type="button" data-rec="dismiss" data-post="${escapeHTML(item.post.id)}">ไม่สนใจกิจกรรมนี้</button>
      <button class="button button-outline button-small" type="button" data-rec="less-category" data-post="${escapeHTML(item.post.id)}">แนะนำหมวดนี้น้อยลง</button>
      <button class="text-button" type="button" data-rec="review" data-post="${escapeHTML(item.post.id)}">ขอให้ทีมตรวจสอบ</button>
    </div></div>`;
}

async function loadRecommendations() {
  const list = $('feed-list');
  if (!list) return;
  $('load-more').hidden = true;
  if (!getUser()) {
    list.innerHTML = emptyState('sparkle', 'คำแนะนำสำหรับคุณ', 'เข้าสู่ระบบแล้วเปิดใช้ระบบแนะนำ เพื่อดูกิจกรรมที่ตรงกับความสนใจ', '<button class="button button-primary" type="button" data-auth-open="login">เข้าสู่ระบบ</button>');
    return;
  }
  list.innerHTML = skeletonPosts(2);
  const request = ++feed.request;
  try {
    const result = await getRecommendations();
    if (request !== feed.request) return;
    if (!result.consent) { list.innerHTML = consentCard(); return; }
    feed.items = result.items.map(item => item.post);
    if (!result.items.length) {
      list.innerHTML = `<div class="section-pad"><p class="notice">${icon('info', { size: 'sm' })}<span>${escapeHTML(result.disclaimer)}</span></p></div>` +
        emptyState('sparkle', 'ยังไม่มีคำแนะนำตอนนี้', 'เลือกความสนใจในหน้าตั้งค่า หรือเข้าร่วมกิจกรรมเพิ่ม ระบบจะแนะนำได้ตรงขึ้น', '<a class="button button-outline" href="#/settings#profile">ตั้งค่าความสนใจ</a>');
      return;
    }
    const byId = new Map(result.items.map(item => [item.post.id, item]));
    list.innerHTML = `<div class="section-pad"><p class="notice">${icon('info', { size: 'sm' })}<span>${escapeHTML(result.disclaimer)} <a href="#/settings#ai">จัดการระบบแนะนำ</a></span></p></div>` +
      renderPosts(feed.items, post => ({ extra: reasonBox(byId.get(post.id)) }));
  } catch (error) {
    if (request !== feed.request) return;
    list.innerHTML = `<div class="section-pad"><p class="error-message">${escapeHTML(error.message)}</p></div>`;
  }
}

function openReviewRequest(postId) {
  const body = openGeneric(`<div class="sheet-heading"><h2 id="generic-title">ขอให้ทีมตรวจสอบคำแนะนำ</h2><button class="icon-button" type="button" data-close-generic aria-label="ปิด">${icon('x')}</button></div>
    <p class="muted">บอกเราว่าคำแนะนำนี้ไม่เหมาะสมหรือไม่ตรงอย่างไร ผู้ดูแลที่เป็นคนจะอ่านและตรวจสอบ</p>
    <div class="field"><label for="rec-review">รายละเอียด</label><textarea id="rec-review" rows="4" maxlength="1000"></textarea></div>
    <p id="rec-review-error" class="error-message" role="alert" hidden></p>
    <button class="button button-primary" type="button" id="rec-review-send">ส่งให้ทีมตรวจสอบ</button>`);
  body.querySelector('[data-close-generic]').onclick = () => $('generic-dialog').close();
  body.querySelector('#rec-review-send').onclick = async () => {
    try {
      await recommendationFeedback({ postId, kind: 'review-request', details: $('rec-review').value });
      $('generic-dialog').close();
      toast('ส่งให้ทีมตรวจสอบแล้ว ขอบคุณที่ช่วยปรับปรุงระบบ');
    } catch (error) { $('rec-review-error').textContent = error.message; $('rec-review-error').hidden = false; }
  };
}

// ---- pages ------------------------------------------------------------------------------------
function composer() {
  const user = getUser();
  if (!user) {
    return `<div class="composer"><div class="composer-main"><p class="strong">ชวนเพื่อนทำกิจกรรมด้วยกัน</p>
      <p class="muted caption">สมัครด้วยอีเมลสถานศึกษาเพื่อสร้างกิจกรรมและเข้าร่วม</p>
      <div class="row"><button class="button button-primary button-small" type="button" data-auth-open="signup">สมัคร</button><button class="button button-outline button-small" type="button" data-auth-open="login">เข้าสู่ระบบ</button></div></div></div>`;
  }
  return `<div class="composer">${avatar({ id: user.id, name: user.displayName, username: user.username })}
    <div class="composer-main">
      <button class="composer-input" type="button" data-action="create">อยากชวนเพื่อนทำอะไร, ${escapeHTML(user.displayName)}?</button>
      <div class="composer-actions">
        <button class="composer-action" type="button" data-create="sport">${icon('ball', { size: 'sm' })}กีฬา</button>
        <button class="composer-action study" type="button" data-create="study">${icon('book', { size: 'sm' })}อ่านหนังสือ</button>
        <button class="composer-action cafe" type="button" data-create="cafe">${icon('coffee', { size: 'sm' })}คาเฟ่</button>
        <button class="composer-action" type="button" data-create="text">${icon('text', { size: 'sm' })}ข้อความ</button>
      </div>
    </div></div>`;
}

const homeTabs = () => `<div class="tabs" role="tablist" aria-label="ฟีด">
  ${[['latest', 'ล่าสุด'], ['foryou', 'สำหรับคุณ'], ['friends', 'เพื่อน']].map(([key, label]) =>
    `<button class="tab" role="tab" type="button" data-tab="${key}" aria-selected="${homeTab === key}">${label}</button>`).join('')}</div>`;

// "กิจกรรมที่จะถึงของคุณ": a swipeable strip of the person's upcoming activities at the top of Home.
async function loadUpcoming() {
  const box = $('upcoming');
  if (!box || !getUser()) return;
  try {
    const { upcoming } = await myActivities();
    if (!$('upcoming')) return;
    box.innerHTML = upcoming.length ? `<p class="section-label">กิจกรรมที่จะถึงของคุณ</p><div class="upcoming-strip">${upcoming.slice(0, 8).map(post => `
      <a class="upcoming-card" href="#/activity/${encodeURIComponent(post.id)}">
        <span class="mini-date" aria-hidden="true"><span>${escapeHTML(monthShort(post.activity.startsAt))}</span><strong>${escapeHTML(dayNumber(post.activity.startsAt))}</strong></span>
        <span class="grow"><strong class="ellipsis" style="display:block">${escapeHTML(post.activity.title)}</strong>
          <span class="small muted ellipsis" style="display:block">${formatTime(post.activity.startsAt)} · ${escapeHTML(untilText(post.activity.startsAt))} · ${escapeHTML(post.activity.location)}</span></span></a>`).join('')}</div>` : '';
  } catch { box.innerHTML = ''; }
}

export function renderHome(main) {
  view = 'home';
  if (homeTab !== 'latest' && !getUser()) homeTab = 'latest';
  main.innerHTML = `${pageHead('หน้าแรก', { brand: true, tabs: homeTabs(), actions: `<a class="icon-button" href="#/explore" aria-label="ค้นหา">${icon('search')}</a>` })}
    <div id="upcoming"></div>
    ${composer()}
    <div id="feed-status" class="feed-status" hidden></div>
    <div id="feed-list" class="feed" aria-live="polite"></div>
    <div class="load-more-wrap"><button id="load-more" class="button button-outline" type="button" data-action="more" hidden>โหลดเพิ่ม</button></div>`;
  renderList();
  loadUpcoming();
}

export function renderExplore(main, params) {
  view = 'explore';
  if (params.has('q')) filters.q = params.get('q');
  if (params.has('category')) filters.category = params.get('category');
  main.innerHTML = `${pageHead('สำรวจ')}
    <div class="explore-tools">
      <div class="explore-search">
        <div class="search-box">${icon('search', { size: 'sm' })}<label class="visually-hidden" for="search">ค้นหา</label>
          <input id="search" type="search" maxlength="100" autocomplete="off" placeholder="ค้นหากิจกรรม สถานที่ หรือ @ผู้ใช้"></div>
        <button class="icon-button large" type="button" data-action="filters" aria-label="ตัวกรอง">${icon('filter')}</button>
      </div>
      <div class="chip-scroll" role="radiogroup" aria-label="หมวด">
        ${['all', 'sport', 'study', 'cafe', 'text'].map(key => `<label class="chip"><input type="radio" name="explore-cat" value="${key}" ${filters.category === key ? 'checked' : ''}><span>${CATEGORY_LABELS[key]}</span></label>`).join('')}
        <label class="chip"><input type="checkbox" name="explore-open" ${filters.open ? 'checked' : ''}><span>ยังรับคน</span></label>
      </div>
    </div>
    <div id="people-results"></div>
    <div id="feed-status" class="feed-status"></div>
    <div id="feed-list" class="feed" aria-live="polite"></div>
    <div class="load-more-wrap"><button id="load-more" class="button button-outline" type="button" data-action="more" hidden>โหลดเพิ่ม</button></div>`;
  const search = $('search');
  search.value = filters.q;
  const people = debounce(async () => {
    const box = $('people-results');
    const q = filters.q.trim();
    if (!box) return;
    if (!getUser() || q.length < 2) { box.innerHTML = ''; return; }
    try {
      const { items } = await searchUsers(q);
      box.innerHTML = items.length ? `<div class="feed-status"><strong>ผู้คน</strong></div>${items.slice(0, 3).map(person => `<div class="list-item">${avatar(person)}
        <div class="grow"><a class="name" href="#/u/${encodeURIComponent(person.username)}">${escapeHTML(person.displayName)}</a><div class="small muted">@${escapeHTML(person.username)}</div></div>
        ${person.relation === 'friends' ? '<span class="pill pill-success">เพื่อน</span>' : ''}</div>`).join('')}<div class="divider-block"></div>` : '';
    } catch { box.innerHTML = ''; }
  }, 300);
  search.addEventListener('input', debounce(() => { filters.q = search.value; loadFeed(); people(); }, 300));
  main.querySelector('.chip-scroll').addEventListener('change', event => {
    if (event.target.name === 'explore-cat') filters.category = event.target.value;
    if (event.target.name === 'explore-open') filters.open = event.target.checked;
    loadFeed();
  });
  renderList();
  people();
  if (!filters.q) search.focus({ preventScroll: true });
}

export function clearFilters() {
  Object.assign(filters, { category: 'all', date: '', q: '', open: false });
  const search = $('search');
  if (search) search.value = '';
  document.querySelectorAll('input[name=explore-cat]').forEach(input => { input.checked = input.value === 'all'; });
  document.querySelectorAll('input[name=explore-open]').forEach(input => { input.checked = false; });
}

export async function handleFeedAction(action, element, openCreate) {
  if (action === 'create') openCreate();
  if (action === 'retry') loadFeed();
  if (action === 'more') loadFeed({ reset: false });
  if (action === 'clear') { clearFilters(); loadFeed(); $('search')?.focus(); }
  if (action === 'filters') {
    const form = $('filter-form');
    form.elements.category.value = filters.category;
    form.elements.date.value = filters.date;
    form.elements.open.checked = filters.open;
    openDialog($('filter-dialog'));
  }
  if (action === 'ai-enable') {
    if (!$('ai-ack').checked) { $('ai-error').textContent = 'กรุณาติ๊กยินยอมและรับทราบข้อจำกัดก่อน'; $('ai-error').hidden = false; return; }
    element.disabled = true;
    try { await grantAiConsent(); toast('เปิดใช้ระบบแนะนำแล้ว'); loadRecommendations(); }
    catch (error) { element.disabled = false; $('ai-error').textContent = error.message; $('ai-error').hidden = false; }
  }
}

export function setupFeed(openCreateWith) {
  const main = $('main');
  main.addEventListener('click', async event => {
    const tab = event.target.closest('[data-tab]');
    if (tab && view === 'home') {
      const next = tab.dataset.tab;
      if (next !== 'latest' && !getUser()) { requireAuth('account', () => { homeTab = next; renderHome(main); loadFeed(); }); return; }
      homeTab = next;
      main.querySelectorAll('[data-tab]').forEach(el => el.setAttribute('aria-selected', String(el.dataset.tab === next)));
      loadFeed();
      return;
    }
    const create = event.target.closest('[data-create]');
    if (create) { openCreateWith(create.dataset.create); return; }
    const rec = event.target.closest('[data-rec]');
    if (rec) {
      const postId = rec.dataset.post;
      if (rec.dataset.rec === 'review') { openReviewRequest(postId); return; }
      rec.disabled = true;
      try {
        await recommendationFeedback({ postId, kind: rec.dataset.rec });
        toast(rec.dataset.rec === 'dismiss' ? 'ซ่อนคำแนะนำนี้แล้ว' : 'จะแนะนำหมวดนี้น้อยลง');
        loadRecommendations();
      } catch (error) { rec.disabled = false; toast(error.message); }
    }
  });
  const form = $('filter-form');
  form.addEventListener('submit', () => {
    filters.category = form.elements.category.value;
    filters.date = form.elements.date.value;
    filters.open = form.elements.open.checked;
    document.querySelectorAll('input[name=explore-cat]').forEach(input => { input.checked = input.value === filters.category; });
    document.querySelectorAll('input[name=explore-open]').forEach(input => { input.checked = filters.open; });
    loadFeed();
  });
  $('filter-reset').addEventListener('click', () => { clearFilters(); $('filter-dialog').close(); loadFeed(); });
}

export const currentView = () => view;
export const resetHomeTab = () => { homeTab = 'latest'; };
