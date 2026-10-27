// Moderator screen (#/mod): reports, appeals against suspensions, and requests to review recommendations.
// Every decision needs a person; a suspension needs a reason the user will see (rule.md: human review).
import { modAppeals, modCloseRecReview, modRecReviews, modReports, modResolveAppeal, modReview, modSummary } from './api.js';
import { $, emptyState, escapeHTML, openGeneric, pageHead, skeletonPosts, toast } from './dom.js';
import { formatDateTime } from './format.js';
import { icon } from './icons.js';
import { REPORT_REASONS } from './post-actions.js';
import { refreshBadges } from './shell.js';

let tab = 'reports';
let status = 'open';
let summary = { openReports: 0, openAppeals: 0, openRecommendationReviews: 0 };
const ACTION_LABEL = { dismiss: 'ไม่พบการละเมิด', 'remove-post': 'ลบโพสต์', 'suspend-user': 'ระงับบัญชี' };
const who = user => user ? `${escapeHTML(user.displayName)}${user.username ? ` <span class="muted">@${escapeHTML(user.username)}</span>` : ''}` : '<span class="muted">ไม่ทราบ</span>';

function reportItem(r) {
  return `<article class="mod-item">
    <div class="row-wrap"><span class="pill pill-danger">${icon('flag', { size: 'sm' })}${escapeHTML(REPORT_REASONS[r.reason] || r.reason)}</span><span class="small muted">${formatDateTime(r.createdAt)}</span></div>
    <p class="caption">ผู้รายงาน: ${who(r.reporter)} · ผู้ถูกรายงาน: ${who(r.reportedUser)} ${r.reportedUser?.suspended ? '<span class="pill pill-warning">ถูกระงับอยู่</span>' : ''}</p>
    ${r.details ? `<p class="caption"><strong>รายละเอียดจากผู้รายงาน:</strong> ${escapeHTML(r.details)}</p>` : ''}
    ${r.post ? `<div class="mod-quote">${r.post.title ? `<strong>${escapeHTML(r.post.title)}</strong>\n` : ''}${escapeHTML(r.post.content)}</div>
      <div class="row-wrap">${r.post.type === 'activity' && !r.post.removed ? `<a class="text-button inline" href="#/activity/${encodeURIComponent(r.post.id)}">เปิดกิจกรรม</a>` : ''}${r.post.removed ? '<span class="pill pill-neutral">โพสต์ถูกลบแล้ว</span>' : ''}</div>` : ''}
    ${r.reviews.length ? `<ul class="caption" style="list-style:none">${r.reviews.map(v => `<li>${icon('check', { size: 'sm' })} ${escapeHTML(ACTION_LABEL[v.action])} โดย ${who(v.moderator)} · ${formatDateTime(v.createdAt)}${v.note ? ` · “${escapeHTML(v.note)}”` : ''}</li>`).join('')}</ul>` : ''}
    ${r.reviews.length ? '' : `<div class="mod-actions">
      <button class="button button-outline button-small" type="button" data-review="dismiss" data-id="${escapeHTML(r.id)}">ไม่พบการละเมิด</button>
      ${r.post && !r.post.removed ? `<button class="button button-danger-outline button-small" type="button" data-review="remove-post" data-id="${escapeHTML(r.id)}">ลบโพสต์</button>` : ''}
      ${r.reportedUser && !r.reportedUser.suspended && !r.reportedUser.deleted && r.reportedUser.role !== 'moderator' ? `<button class="button button-danger button-small" type="button" data-review="suspend-user" data-id="${escapeHTML(r.id)}">ระงับบัญชี</button>` : ''}
    </div>`}
  </article>`;
}

function appealItem(a) {
  return `<article class="mod-item">
    <div class="row-wrap"><strong>${who(a.user)}</strong><span class="small muted">${formatDateTime(a.createdAt)}</span>${a.outcome ? `<span class="pill ${a.outcome === 'lifted' ? 'pill-success' : 'pill-neutral'}">${a.outcome === 'lifted' ? 'ยกเลิกการระงับแล้ว' : 'คงการระงับ'}</span>` : ''}</div>
    ${a.user?.suspendedReason ? `<p class="caption">เหตุผลที่ถูกระงับ: ${escapeHTML(a.user.suspendedReason)}</p>` : ''}
    <div class="mod-quote">${escapeHTML(a.message)}</div>
    ${a.note ? `<p class="caption muted">บันทึก: ${escapeHTML(a.note)}</p>` : ''}
    ${a.resolvedAt ? '' : `<div class="mod-actions"><button class="button button-primary button-small" type="button" data-appeal="lifted" data-id="${escapeHTML(a.id)}">ยกเลิกการระงับ</button>
      <button class="button button-outline button-small" type="button" data-appeal="upheld" data-id="${escapeHTML(a.id)}">คงการระงับ</button></div>`}
  </article>`;
}

function recItem(r) {
  return `<article class="mod-item">
    <div class="row-wrap"><strong>${who(r.user)}</strong><span class="small muted">${formatDateTime(r.createdAt)}</span>${r.reviewedAt ? '<span class="pill pill-success">ตรวจแล้ว</span>' : ''}</div>
    ${r.title ? `<p class="caption">เกี่ยวกับกิจกรรม: <a href="#/activity/${encodeURIComponent(r.postId)}">${escapeHTML(r.title)}</a></p>` : '<p class="caption">เกี่ยวกับระบบแนะนำโดยรวม</p>'}
    <div class="mod-quote">${escapeHTML(r.details)}</div>
    ${r.reviewedAt ? '' : `<div class="mod-actions"><button class="button button-outline button-small" type="button" data-rec-close="${escapeHTML(r.id)}">ตรวจแล้ว</button></div>`}
  </article>`;
}

async function load() {
  const list = $('mod-list');
  list.innerHTML = skeletonPosts(2);
  try {
    summary = await modSummary();
    paintHead();
    if (tab === 'reports') { const { items } = await modReports(status); list.innerHTML = items.length ? items.map(reportItem).join('') : emptyState('shieldCheck', 'ไม่มีรายงานค้าง', 'รายงานใหม่จากผู้ใช้จะแสดงที่นี่'); }
    if (tab === 'appeals') { const { items } = await modAppeals(status); list.innerHTML = items.length ? items.map(appealItem).join('') : emptyState('shieldCheck', 'ไม่มีคำขอทบทวน', 'คำขอทบทวนการระงับบัญชีจะแสดงที่นี่'); }
    if (tab === 'recs') { const { items } = await modRecReviews(status); list.innerHTML = items.length ? items.map(recItem).join('') : emptyState('sparkle', 'ไม่มีคำขอ', 'คำขอให้ตรวจสอบระบบแนะนำจะแสดงที่นี่'); }
  } catch (error) { list.innerHTML = `<p class="section-pad error-message">${escapeHTML(error.message)}</p>`; }
}

function paintHead() {
  const count = n => (n ? `<span class="count">${n}</span>` : '');
  $('mod-head').innerHTML = pageHead('หน้าผู้ดูแล', { back: '#/menu', sub: 'ตรวจสอบโดยคน ทุกการตัดสินถูกบันทึก', tabs: `<div class="tabs" role="tablist">
    <button class="tab" role="tab" type="button" data-mod-tab="reports" aria-selected="${tab === 'reports'}">รายงาน${count(summary.openReports)}</button>
    <button class="tab" role="tab" type="button" data-mod-tab="appeals" aria-selected="${tab === 'appeals'}">ขอทบทวนการระงับ${count(summary.openAppeals)}</button>
    <button class="tab" role="tab" type="button" data-mod-tab="recs" aria-selected="${tab === 'recs'}">ระบบแนะนำ${count(summary.openRecommendationReviews)}</button></div>
    <div class="chip-scroll">${[['open', 'รอดำเนินการ'], ['reviewed', 'ดำเนินการแล้ว'], ['all', 'ทั้งหมด']].map(([key, label]) => `<label class="chip"><input type="radio" name="mod-status" value="${key}" ${status === key ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div>` });
}

function noteSheet({ title, text, label, danger, required, onSubmit }) {
  const body = openGeneric(`<div class="sheet-heading"><h2 id="generic-title">${escapeHTML(title)}</h2><button class="icon-button" type="button" data-close-generic aria-label="ปิด">${icon('x')}</button></div>
    <p class="muted">${escapeHTML(text)}</p>
    <div class="field"><label for="mod-note">${required ? 'เหตุผล (ผู้ใช้จะเห็น)' : 'บันทึก (ไม่บังคับ)'}</label><textarea id="mod-note" rows="3" maxlength="1000"></textarea></div>
    <p id="mod-note-error" class="error-message" role="alert" hidden></p>
    <button class="button ${danger ? 'button-danger' : 'button-primary'}" type="button" id="mod-note-send">${escapeHTML(label)}</button>`);
  body.querySelector('[data-close-generic]').onclick = () => $('generic-dialog').close();
  body.querySelector('#mod-note-send').onclick = async () => {
    const note = $('mod-note').value.trim();
    if (required && !note) { $('mod-note-error').textContent = 'กรุณาเขียนเหตุผล'; $('mod-note-error').hidden = false; return; }
    try { await onSubmit(note); $('generic-dialog').close(); load(); refreshBadges(); }
    catch (error) { $('mod-note-error').textContent = error.message; $('mod-note-error').hidden = false; }
  };
}

export function renderMod(main) {
  main.innerHTML = '<div id="mod-head"></div><div id="mod-list" class="feed"></div>';
  paintHead();
  main.onclick = async event => {
    const t = event.target.closest('[data-mod-tab]');
    if (t) { tab = t.dataset.modTab; load(); return; }
    const review = event.target.closest('[data-review]');
    if (review) {
      const action = review.dataset.review;
      noteSheet({
        title: ACTION_LABEL[action], label: 'ยืนยัน', danger: action !== 'dismiss', required: action === 'suspend-user',
        text: action === 'suspend-user' ? 'ผู้ใช้จะโพสต์ เข้าร่วม และเพิ่มเพื่อนไม่ได้ จนกว่าผู้ดูแลจะยกเลิก ผู้ใช้จะเห็นเหตุผลและขอให้ทบทวนได้' : action === 'remove-post' ? 'โพสต์จะหายจากฟีด ถ้าเป็นกิจกรรม ผู้เข้าร่วมจะได้รับแจ้งว่าถูกยกเลิก' : 'ปิดรายงานนี้โดยไม่ดำเนินการกับผู้ใช้ ผู้รายงานจะได้รับแจ้งผล',
        onSubmit: note => modReview(review.dataset.id, action, note).then(() => toast('บันทึกการตัดสินแล้ว')),
      });
    }
    const appeal = event.target.closest('[data-appeal]');
    if (appeal) {
      const outcome = appeal.dataset.appeal;
      noteSheet({ title: outcome === 'lifted' ? 'ยกเลิกการระงับ' : 'คงการระงับ', label: 'ยืนยัน', required: false,
        text: 'ผู้ใช้จะได้รับแจ้งผลการทบทวนพร้อมบันทึกนี้', onSubmit: note => modResolveAppeal(appeal.dataset.id, outcome, note).then(() => toast('บันทึกผลแล้ว')) });
    }
    const rec = event.target.closest('[data-rec-close]');
    if (rec) { try { await modCloseRecReview(rec.dataset.recClose); toast('ปิดคำขอแล้ว'); load(); refreshBadges(); } catch (error) { toast(error.message); } }
  };
  main.onchange = event => { if (event.target.name === 'mod-status') { status = event.target.value; load(); } };
  load();
}
