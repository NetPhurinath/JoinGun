// The "⋯" menu on posts (backlog 5.3 and 2.1): edit or delete your own post; report or block someone else's.
// Decision 2026-10-15: a block only hides the blocked person's posts from you.
import { blockUser, deletePost, reportPost } from './api.js';
import { getUser } from './auth.js';
import { requireAuth } from './auth-ui.js';
import { openEdit } from './create.js';
import { $, escapeHTML, openDialog, setupDialog, toast } from './dom.js';
import { icon } from './icons.js';

const posts = new Map(); // id → post, for every post currently on screen
let target = null;
let busy = false;
let afterChange = () => {};

export const rememberPosts = list => list.forEach(post => posts.set(post.id, post));
export const menuButton = post => `<button class="icon-button post-menu" type="button" data-post-menu="${escapeHTML(post.id)}" aria-label="ตัวเลือกของโพสต์ ${escapeHTML(post.activity?.title || 'นี้')}" aria-haspopup="dialog">${icon('more', { size: 'sm' })}</button>`;

export const REPORT_REASONS = {
  spam: 'สแปมหรือขายของ', harassment: 'คุกคามหรือกลั่นแกล้ง', unsafe: 'ชวนไปทำสิ่งที่ไม่ปลอดภัย',
  fake: 'แอบอ้างหรือบัญชีปลอม', inappropriate: 'เนื้อหาไม่เหมาะสม', other: 'อื่น ๆ',
};

function openMenu(post) {
  target = post;
  const mine = post.author.id === getUser()?.id;
  const canBlock = !mine && post.author.username;
  $('post-menu-body').innerHTML = `
    <div class="sheet-heading"><h2 id="post-menu-title">ตัวเลือก</h2><button class="icon-button" type="button" data-close aria-label="ปิด">${icon('x')}</button></div>
    ${mine ? `
      <button class="menu-item" type="button" data-menu="edit">${icon('edit')}แก้ไขโพสต์</button>
      <button class="menu-item danger" type="button" data-menu="delete">${icon('trash')}${post.activity ? 'ยกเลิกกิจกรรมและลบโพสต์' : 'ลบโพสต์'}</button>` : `
      ${post.author.username ? `<a class="menu-item" href="#/u/${encodeURIComponent(post.author.username)}" data-menu="profile">${icon('user')}ดูโปรไฟล์ @${escapeHTML(post.author.username)}</a>` : ''}
      <button class="menu-item" type="button" data-menu="report">${icon('flag')}รายงานโพสต์นี้</button>
      ${canBlock ? `<button class="menu-item danger" type="button" data-menu="block">${icon('ban')}บล็อก @${escapeHTML(post.author.username)}</button>` : ''}`}`;
  openDialog($('post-menu'));
}

function confirmSheet({ title, message, confirmLabel, danger = false, onConfirm }) {
  $('confirm-body').innerHTML = `
    <h2 id="confirm-title">${escapeHTML(title)}</h2>
    <p class="muted">${escapeHTML(message)}</p>
    <p id="confirm-error" class="error-message" role="alert" hidden></p>
    <button id="confirm-yes" class="button ${danger ? 'button-danger' : 'button-primary'}" type="button">${escapeHTML(confirmLabel)}</button>
    <button class="button button-outline" type="button" data-close>ยกเลิก</button>`;
  $('confirm-yes').onclick = async () => {
    if (busy) return;
    busy = true; $('confirm-yes').disabled = true;
    try { await onConfirm(); $('confirm-dialog').close(); }
    catch (error) { $('confirm-error').textContent = error.message; $('confirm-error').hidden = false; }
    finally { busy = false; if ($('confirm-yes')) $('confirm-yes').disabled = false; }
  };
  openDialog($('confirm-dialog'));
}
export { confirmSheet };

function openReport(post) {
  $('report-body').innerHTML = `
    <div class="sheet-heading"><h2 id="report-title">รายงานโพสต์</h2><button class="icon-button" type="button" data-close aria-label="ปิด">${icon('x')}</button></div>
    <p class="muted">รายงานจะถูกเก็บไว้ให้ทีมผู้ดูแลตรวจสอบ คนที่ถูกรายงานจะไม่รู้ว่าใครรายงาน</p>
    <fieldset class="stack-tight"><legend>เหตุผล</legend>
      <div class="chip-group">${Object.entries(REPORT_REASONS).map(([value, label]) => `<label class="chip"><input type="radio" name="report-reason" value="${value}"><span>${label}</span></label>`).join('')}</div>
    </fieldset>
    <div class="field"><label for="report-details">รายละเอียดเพิ่มเติม (ไม่บังคับ)</label><textarea id="report-details" rows="3" maxlength="1000"></textarea></div>
    <p class="notice">ถ้ามีคนตกอยู่ในอันตราย ให้ติดต่อเจ้าหน้าที่หรือหมายเลขฉุกเฉิน 191 ทันที</p>
    <p id="report-error" class="error-message" role="alert" hidden></p>
    <button id="report-send" class="button button-primary" type="button">ส่งรายงาน</button>`;
  $('report-send').onclick = async () => {
    const reason = $('report-body').querySelector('input[name=report-reason]:checked')?.value;
    if (!reason) { $('report-error').textContent = 'กรุณาเลือกเหตุผล'; $('report-error').hidden = false; return; }
    if (busy) return;
    busy = true; $('report-send').disabled = true; $('report-send').textContent = 'กำลังส่ง…';
    try {
      await reportPost(post.id, reason, $('report-details').value);
      $('report-dialog').close();
      toast('ส่งรายงานแล้ว ขอบคุณที่ช่วยดูแลชุมชน');
    } catch (error) {
      $('report-error').textContent = error.message; $('report-error').hidden = false;
    } finally { busy = false; if ($('report-send')) { $('report-send').disabled = false; $('report-send').textContent = 'ส่งรายงาน'; } }
  };
  openDialog($('report-dialog'));
}

function onMenuChoice(choice) {
  const post = target;
  $('post-menu').close();
  if (choice === 'profile') return;
  if (choice === 'edit') openEdit(post);
  if (choice === 'delete') {
    confirmSheet({
      title: post.activity ? 'ยกเลิกกิจกรรมนี้?' : 'ลบโพสต์นี้?',
      message: post.activity
        ? 'โพสต์จะหายจากฟีด คนที่เข้าร่วมแล้วจะเห็นว่ากิจกรรมถูกยกเลิก และกู้คืนไม่ได้'
        : 'โพสต์จะหายจากฟีดและกู้คืนไม่ได้',
      confirmLabel: post.activity ? 'ยกเลิกกิจกรรม' : 'ลบโพสต์', danger: true,
      onConfirm: async () => { await deletePost(post.id); toast(post.activity ? 'ยกเลิกกิจกรรมแล้ว' : 'ลบโพสต์แล้ว'); afterChange('deleted', post); },
    });
  }
  if (choice === 'report') openReport(post);
  if (choice === 'block') {
    confirmSheet({
      title: `บล็อก @${post.author.username}?`,
      message: 'คุณจะไม่เห็นโพสต์ของผู้ใช้นี้ในฟีดอีก ถ้าเป็นเพื่อนกันอยู่จะเลิกเป็นเพื่อน เขาจะไม่ได้รับแจ้ง และคุณเลิกบล็อกได้ที่หน้าตั้งค่า',
      confirmLabel: 'บล็อก',
      onConfirm: async () => { await blockUser(post.author.id); toast(`บล็อก @${post.author.username} แล้ว`); afterChange('blocked', post); },
    });
  }
}

// onChange(kind, post) runs after a delete or block, so the screen can reload.
export function setupPostActions(onChange) {
  afterChange = onChange;
  for (const id of ['post-menu', 'report-dialog', 'confirm-dialog']) {
    setupDialog($(id), () => busy);
    $(id).addEventListener('click', event => { if (event.target.closest('[data-close]') && !busy) $(id).close(); });
  }
  $('post-menu').addEventListener('click', event => {
    const choice = event.target.closest('[data-menu]')?.dataset.menu;
    if (choice) onMenuChoice(choice);
  });
  document.addEventListener('click', event => {
    const id = event.target.closest('[data-post-menu]')?.dataset.postMenu;
    if (!id || !posts.has(id)) return;
    requireAuth('menu', () => openMenu(posts.get(id)));
  });
}
