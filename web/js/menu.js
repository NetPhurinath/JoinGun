// "เมนู" tab (#/menu), like Facebook's menu: the person's profile card, shortcuts with badges, links and sign-out.
// Signed-out visitors get sign-up and sign-in buttons and the public pages.
import * as auth from './auth.js';
import { $, avatar, escapeHTML, pageHead, toast } from './dom.js';
import { icon } from './icons.js';
import { badgeCounts, onBadges } from './shell.js';
import { syncReminders } from './native.js';

const badge = count => (count ? `<span class="badge">${count > 99 ? '99+' : count}</span>` : '');

function tiles(user, counts) {
  const items = [
    ['#/activities', 'calendar', 'กิจกรรมของฉัน', 0],
    ['#/friends', 'users', 'เพื่อน', counts.requests],
    ['#/friends?tab=find', 'userPlus', 'หาเพื่อน', 0],
    ['#/settings', 'settings', 'ตั้งค่า', 0],
  ];
  if (user.role === 'moderator') items.push(['#/mod', 'shield', 'หน้าผู้ดูแล', counts.mod]);
  if (user.suspended) items.unshift(['#/settings#appeal', 'ban', 'บัญชีถูกระงับ', 1]);
  return `<div class="menu-grid">${items.map(([href, iconName, label, count]) => `<a class="menu-tile" href="${href}">${icon(iconName)}<span>${label}</span>${badge(count)}</a>`).join('')}</div>`;
}

const links = () => `<div class="menu-list">
  <a class="menu-item" href="#/safety">${icon('shieldCheck')}นัดเจอให้ปลอดภัย</a>
  <a class="menu-item" href="#/terms">${icon('text')}ข้อตกลงการใช้งาน</a>
  <a class="menu-item" href="#/privacy">${icon('lock')}นโยบายความเป็นส่วนตัว</a>
</div>`;

let stop = () => {};
export function renderMenu(main) {
  stop();
  const user = auth.getUser();
  if (!user) {
    main.innerHTML = `${pageHead('เมนู')}
      <div class="section-pad stack">
        <p class="muted">สมัครด้วยอีเมลสถานศึกษา .${auth.EMAIL_SUFFIX} เพื่อเข้าร่วมกิจกรรม เพิ่มเพื่อน และรับการแจ้งเตือนก่อนกิจกรรมเริ่ม</p>
        <button class="button button-primary" type="button" data-auth-open="signup">สมัครสมาชิก</button>
        <button class="button button-outline" type="button" data-auth-open="login">เข้าสู่ระบบ</button>
      </div>${links()}`;
    return;
  }
  const paint = counts => {
    main.innerHTML = `${pageHead('เมนู')}
      <a class="menu-profile" href="#/u/${encodeURIComponent(user.username)}">${avatar({ id: user.id, name: user.displayName }).replace('<a ', '<span ').replace('</a>', '</span>')}
        <span><strong style="display:block">${escapeHTML(user.displayName)}</strong><span class="small muted">ดูโปรไฟล์ของคุณ · @${escapeHTML(user.username)}</span></span></a>
      <p class="section-label">ทางลัด</p>
      ${tiles(user, counts)}
      ${links()}
      <div class="section-pad"><button class="button button-outline" type="button" data-menu-logout>${icon('logout', { size: 'sm' })}ออกจากระบบ</button></div>`;
  };
  paint(badgeCounts());
  stop = onBadges(counts => { if ($('main').querySelector('.menu-grid')) paint(counts); });
  main.onclick = async event => {
    if (!event.target.closest('[data-menu-logout]')) return;
    try { await auth.logout(); toast('ออกจากระบบแล้ว'); } catch { toast('ออกจากระบบในเครื่องนี้แล้ว แต่ติดต่อเซิร์ฟเวอร์ไม่ได้'); }
    syncReminders({ signedIn: false });
    location.hash = '#/';
  };
}
export const leaveMenu = () => { stop(); stop = () => {}; };
