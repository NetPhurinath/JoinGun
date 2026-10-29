// Small DOM helpers. All user content goes through escapeHTML or textContent; never raw HTML.
import { icon } from './icons.js';

export const $ = id => document.getElementById(id);

export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));

let toastTimer;
export function toast(message) {
  const element = $('toast');
  element.textContent = message;
  element.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.hidden = true; }, 4000);
}

// Native modal dialogs trap focus and handle Escape; we restore focus to the opener on close.
const openers = new WeakMap();
export function openDialog(dialog) {
  openers.set(dialog, document.activeElement);
  if (!dialog.open) dialog.showModal();
}
export function setupDialog(dialog, isBusy = () => false) {
  dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => { if (!isBusy()) dialog.close(); }));
  dialog.addEventListener('cancel', event => { if (isBusy()) event.preventDefault(); });
  // A click on the backdrop (outside the panel) closes the sheet.
  dialog.addEventListener('click', event => { if (event.target === dialog && !isBusy()) dialog.close(); });
  dialog.addEventListener('close', () => {
    const opener = openers.get(dialog);
    if (opener?.isConnected) opener.focus();
  });
}

export function debounce(fn, wait) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); };
}

// A stable colour per user id for avatars and profile covers.
export function hue(id = '') {
  let h = 0;
  for (const char of String(id)) h = (h * 31 + char.charCodeAt(0)) % 360;
  return h;
}
const initial = name => escapeHTML(String(name || '?').trim().slice(0, 1).toUpperCase() || '?');

// Avatar for {id, name|displayName, username}; a link to the profile when the person has a username.
export function avatar(user, size = '') {
  const name = user?.displayName ?? user?.name ?? '?';
  const cls = `avatar${size ? ` avatar-${size}` : ''}`;
  const style = `style="--hue:${hue(user?.id)}"`;
  if (user?.username && size !== 'xs') return `<a class="${cls}" ${style} href="#/u/${encodeURIComponent(user.username)}" aria-label="โปรไฟล์ของ ${escapeHTML(name)}">${initial(name)}</a>`;
  return `<span class="${cls}" ${style} aria-hidden="true">${initial(name)}</span>`;
}


export async function copyLink(path) {
  const url = `${location.origin}${location.pathname}${path}`;
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ url, title: 'JoinGun' }); return; }
    await navigator.clipboard.writeText(url);
    toast('คัดลอกลิงก์แล้ว');
  } catch { toast(url); }
}

// One shared sheet for small forms (appeal, recommendation review, moderator notes). Returns the body element.
export function openGeneric(html) {
  const body = $('generic-body');
  body.innerHTML = html;
  openDialog($('generic-dialog'));
  return body;
}

export function emptyState(iconName, title, text, action = '') {
  return `<div class="empty"><span class="empty-icon">${icon(iconName)}</span><h2>${escapeHTML(title)}</h2><p class="muted">${escapeHTML(text)}</p>${action}</div>`;
}

export function skeletonPosts(count = 3) {
  return Array.from({ length: count }, () => `<div class="skeleton" aria-hidden="true"><span class="skeleton-circle"></span>
    <div class="skeleton-col"><span class="skeleton-line w40"></span><span class="skeleton-line w80"></span><span class="skeleton-box"></span></div></div>`).join('');
}

// Sticky page header with an optional back button and tabs.
export function pageHead(title, { back = false, sub = '', tabs = '', actions = '', brand = false } = {}) {
  return `<div class="page-head">
    <div class="page-title">
      ${back ? `<a class="back-button" href="${back === true ? '#/' : back}" data-back aria-label="ย้อนกลับ">${icon('back')}</a>` : ''}
      ${brand ? `<h1 tabindex="-1" class="brand"><span class="brand-mark" aria-hidden="true">J</span>JoinGun<span class="visually-hidden"> ${escapeHTML(title)}</span></h1>`
        : `<h1 tabindex="-1">${escapeHTML(title)}${sub ? `<span class="sub">${escapeHTML(sub)}</span>` : ''}</h1>`}
      ${actions}
    </div>
    ${tabs}
  </div>`;
}
