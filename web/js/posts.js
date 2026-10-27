// Post rows (X style) with an activity event card (Facebook event style). The card keeps the design-system order:
// title → category → date/time → place → places → "ดูรายละเอียด". Joining happens only on the detail page.
import { avatar, escapeHTML, verifiedBadge } from './dom.js';
import { bannerArt, icon } from './icons.js';
import { CATEGORY_LABELS, dayNumber, formatDateTime, monthShort, relativeTime, seatsText, untilText } from './format.js';
import { menuButton, rememberPosts } from './post-actions.js';

const started = a => new Date(a.startsAt).getTime() <= Date.now();

export function statusPill(post) {
  const a = post.activity;
  if (!a) return '';
  if (post.deletedAt) return '<span class="pill pill-danger">ยกเลิกแล้ว</span>';
  if (a.viewerStatus === 'host') return `<span class="pill pill-neutral">${icon('user', { size: 'sm' })}คุณเป็นผู้จัด</span>`;
  if (a.viewerStatus === 'joined') return `<span class="pill pill-success">${icon('check', { size: 'sm' })}เข้าร่วมแล้ว</span>`;
  return '';
}

function bannerStatus(a, post) {
  if (post.deletedAt) return 'ยกเลิกแล้ว';
  if (a.completedAt) return 'จบแล้ว';
  if (started(a)) return 'เริ่มแล้ว';
  if (a.joinedCount >= a.capacity) return 'เต็มแล้ว';
  return untilText(a.startsAt);
}

export function eventCard(post, { link = true, headingLevel = 2 } = {}) {
  const a = post.activity;
  const percent = Math.min(100, Math.round((a.joinedCount / a.capacity) * 100));
  const full = a.joinedCount >= a.capacity;
  const tag = link ? 'a' : 'div';
  const h = `h${headingLevel}`;
  return `<${tag} class="event-card" ${link ? `href="#/activity/${encodeURIComponent(post.id)}"` : ''} aria-labelledby="title-${escapeHTML(post.id)}">
    <div class="event-banner cat-${escapeHTML(a.category)}">${bannerArt(a.category)}
      <span class="cat-chip">${icon('sparkle', { size: 'sm' })}${escapeHTML(CATEGORY_LABELS[a.category] || a.category)}</span>
      <span class="status-chip">${escapeHTML(bannerStatus(a, post))}</span>
    </div>
    <div class="event-content">
      <div class="date-badge" aria-hidden="true"><span>${escapeHTML(monthShort(a.startsAt))}</span><strong>${escapeHTML(dayNumber(a.startsAt))}</strong></div>
      <div class="event-info">
        <${h} id="title-${escapeHTML(post.id)}">${escapeHTML(a.title)}</${h}>
        <span class="event-cat">${escapeHTML(CATEGORY_LABELS[a.category] || a.category)}</span>
        <p class="meta-line strong-time">${icon('clock', { size: 'sm' })}<span><span class="visually-hidden">วันเวลา </span>${formatDateTime(a.startsAt)}</span></p>
        <p class="meta-line">${icon('pin', { size: 'sm' })}<span><span class="visually-hidden">สถานที่ </span>${escapeHTML(a.location)}</span></p>
        <div class="seats">
          <div class="seats-bar ${full ? 'full' : ''}" aria-hidden="true"><span style="width:${percent}%"></span></div>
          <div class="seats-row">${icon('people', { size: 'sm' })}<span>${seatsText(a)}</span></div>
        </div>
        ${statusPill(post)}
      </div>
    </div>
    ${link ? `<span class="button button-outline view-details">ดูรายละเอียด<span class="visually-hidden"> ${escapeHTML(a.title)}</span></span>` : ''}
  </${tag}>`;
}

function authorLine(post) {
  const author = post.author;
  const name = author.username
    ? `<a class="author" href="#/u/${encodeURIComponent(author.username)}">${escapeHTML(author.name)}</a>${verifiedBadge()}<span class="handle">@${escapeHTML(author.username)}</span>`
    : `<span class="author">${escapeHTML(author.name)}</span>`;
  return `<header class="post-meta">${name}<span aria-hidden="true">·</span><time datetime="${escapeHTML(post.createdAt)}" title="${formatDateTime(post.createdAt)}">${relativeTime(post.createdAt)}</time>${post.updatedAt ? '<span class="small">(แก้ไขแล้ว)</span>' : ''}${menuButton(post)}</header>`;
}

// extra: HTML inserted under the post (e.g. the recommendation reasons).
export function postRow(post, { extra = '' } = {}) {
  return `<article class="post" data-post-id="${escapeHTML(post.id)}">
    ${avatar({ id: post.author.id, name: post.author.name, username: post.author.username })}
    <div class="post-body">
      ${authorLine(post)}
      ${post.content ? `<p class="post-text">${escapeHTML(post.content)}</p>` : ''}
      ${post.activity ? eventCard(post) : ''}
      ${extra}
      <footer class="post-actions">
        ${post.activity ? '' : '<span class="pill pill-neutral">ข้อความทั่วไป</span>'}
        <span class="spacer"></span>
        ${post.activity ? `<button class="icon-button" type="button" data-share="${escapeHTML(post.id)}" aria-label="แชร์ลิงก์กิจกรรม">${icon('share', { size: 'sm' })}</button>` : ''}
      </footer>
    </div>
  </article>`;
}

export function renderPosts(items, options) {
  rememberPosts(items);
  return items.map(post => postRow(post, options?.(post))).join('');
}
