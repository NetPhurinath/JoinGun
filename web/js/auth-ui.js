// Welcome page, the step-by-step sign-up / sign-in sheet, the header account menu, and the draft policy pages.
// Layout follows X's flow (welcome screen, one question per step, back arrow, progress), with JoinGun's tokens.
import * as auth from './auth.js';
import { $, escapeHTML, openDialog, setupDialog, toast } from './dom.js';
import { icon } from './icons.js';
import { eventCard } from './posts.js';

const dialog = () => $('auth-dialog');
const flow = { mode: 'signup', step: 'email', email: '', reason: '', busy: false, resendTimer: null, resendLeft: 0, after: null, resumed: false, codeMinutes: 10 };
const STEP_NUMBER = { email: 1, code: 2, terms: 3, profile: 4 };
const INTERESTS = { sport: 'กีฬา', study: 'อ่านหนังสือ', cafe: 'คาเฟ่' };
const REASONS = { post: 'เข้าสู่ระบบเพื่อสร้างโพสต์', join: 'เข้าสู่ระบบเพื่อเข้าร่วมกิจกรรม', menu: 'เข้าสู่ระบบเพื่อรายงาน บล็อก หรือจัดการโพสต์', account: 'เข้าสู่ระบบเพื่อดูหน้านี้', friend: 'เข้าสู่ระบบเพื่อเพิ่มเพื่อน' };


const googleButton = () => auth.GOOGLE_SIGN_IN_ENABLED
  ? `<button class="button button-outline" type="button" data-auth="google"><span class="google-mark" aria-hidden="true">G</span>ดำเนินการต่อด้วย Google</button>
     <div class="divider" role="separator"><span>หรือ</span></div>`
  : '';

// ---- welcome page ---------------------------------------------------------
// Sample cards for the welcome collage only (not real posts).
const SAMPLE = [
  ['sport', 'ตีแบดหลังเลิกเรียน', 'โรงยิมกลาง', 1, 17, 5, 8],
  ['study', 'ติวแคลคูลัสก่อนสอบ', 'หอสมุด ชั้น 3', 2, 13, 7, 10],
  ['cafe', 'นั่งคาเฟ่ทำรายงาน', 'คาเฟ่ข้างหอ', 1, 10, 2, 5],
  ['sport', 'ฟุตซอล 5 คน', 'สนามในร่ม', 3, 18, 7, 10],
].map(([category, title, location, days, hour, joined, capacity], index) => ({
  id: `sample-${index}`, deletedAt: null,
  activity: { category, title, location, capacity, joinedCount: joined, viewerStatus: null, completedAt: null,
    startsAt: new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 11) + `${String(hour - 7).padStart(2, '0')}:00:00.000Z` },
}));

export function renderWelcome(main) {
  document.body.classList.add('is-welcome');
  main.innerHTML = '';
  let page = document.getElementById('welcome-page');
  if (!page) { page = document.createElement('div'); page.id = 'welcome-page'; document.body.prepend(page); }
  page.innerHTML = `
    <section class="welcome" aria-labelledby="welcome-title">
      <div class="welcome-art">
        <span class="brand-mark" aria-hidden="true">J</span>
        <div class="collage" aria-hidden="true">${SAMPLE.map(post => eventCard(post, { link: false, headingLevel: 3 })).join('')}</div>
      </div>
      <div class="welcome-body">
        <h1 id="welcome-title" tabindex="-1">เจอเพื่อนทำกิจกรรม<br>ในมหาวิทยาลัย</h1>
        <p class="welcome-lead">ชวนกันตีแบด อ่านหนังสือ หรือนั่งคาเฟ่ กับนักศึกษาที่ชอบเรื่องเดียวกัน</p>
        <ul class="welcome-points">
          <li>${icon('shieldCheck', { size: 'sm' })}<span>สมัครด้วยอีเมลสถานศึกษา .${auth.EMAIL_SUFFIX} เท่านั้น</span></li>
          <li>${icon('pin', { size: 'sm' })}<span>เห็นวันเวลาและจุดนัดชัดเจน พร้อมแผนที่และปุ่มนำทาง</span></li>
          <li>${icon('bell', { size: 'sm' })}<span>แจ้งเตือนก่อนกิจกรรมเริ่ม ไม่พลาดนัด</span></li>
        </ul>
        <div class="welcome-actions">
          ${googleButton()}
          <button class="button button-primary" type="button" data-auth="signup">สมัครด้วยอีเมลสถานศึกษา</button>
          <p class="caption muted">ระหว่างสมัครคุณจะได้อ่านข้อตกลงการใช้งานและนโยบายความเป็นส่วนตัวก่อนยืนยัน</p>
          <p class="welcome-subhead">มีบัญชีอยู่แล้ว?</p>
          <button class="button button-outline" type="button" data-auth="login">เข้าสู่ระบบ</button>
          <a class="text-button" href="#/" style="text-align:left;padding:0">ดูกิจกรรมก่อน โดยยังไม่เข้าสู่ระบบ →</a>
        </div>
        <p class="welcome-foot" style="margin-top:32px"><a href="#/terms">ข้อตกลงการใช้งาน</a><a href="#/privacy">นโยบายความเป็นส่วนตัว</a><a href="#/safety">ความปลอดภัย</a></p>
      </div>
    </section>`;
  return page;
}
export const leaveWelcome = () => { document.body.classList.remove('is-welcome'); document.getElementById('welcome-page')?.remove(); };

// ---- policy drafts -----------------------------------------------------------
const POLICIES = {
  terms: {
    title: 'ข้อตกลงการใช้งาน',
    version: auth.TERMS_VERSION,
    body: `<p>JoinGun เป็นพื้นที่ให้นักศึกษาชวนกันทำกิจกรรมออฟไลน์ ผู้ใช้ต้องสมัครด้วยอีเมลสถานศึกษาของตนเองที่ลงท้ายด้วย .${auth.EMAIL_SUFFIX} และใช้บัญชีเดียวต่อคน</p>
      <h2>ความปลอดภัย</h2>
      <p>การยืนยันอีเมลสถานศึกษาไม่ได้รับประกันตัวตน เจตนา หรือความปลอดภัยของผู้ใช้คนอื่น ควรนัดพบในพื้นที่สาธารณะและตรวจสอบรายละเอียดก่อนเข้าร่วมทุกครั้ง</p>
      <h2>สิ่งที่ห้ามทำ</h2>
      <ul><li>สแปม ขายของ หรือชักชวนไปทำสิ่งผิดกฎหมายหรือไม่ปลอดภัย</li><li>คุกคาม กลั่นแกล้ง หรือแอบอ้างเป็นผู้อื่น</li><li>โพสต์ข้อมูลส่วนตัวของผู้อื่นโดยไม่ได้รับอนุญาต</li></ul>
      <p>ผู้ดูแลอาจลบโพสต์หรือระงับบัญชีที่ฝ่าฝืน โดยแจ้งเหตุผลให้ทราบ และคุณขอให้ผู้ดูแลทบทวนการระงับได้ที่หน้าตั้งค่า</p>
      <h2>บันทึกการใช้งาน</h2>
      <p>ระบบบันทึกการเข้าสู่ระบบ การโพสต์ การเข้าร่วมและออกจากกิจกรรม การส่งและตอบรับคำขอเป็นเพื่อน และการรายงาน พร้อมเวลาและ IP address ไว้อย่างน้อย 90 วันตามพระราชบัญญัติว่าด้วยการกระทำความผิดเกี่ยวกับคอมพิวเตอร์</p>
      <h2>ระบบแนะนำกิจกรรม</h2>
      <p>ระบบแนะนำ (AI) ปิดไว้เป็นค่าเริ่มต้น เมื่อเปิดใช้ ระบบจะแสดงเหตุผลของทุกคำแนะนำ คำแนะนำอาจไม่ตรงใจและไม่ใช่การรับประกันความปลอดภัย คุณซ่อนคำแนะนำ ปิดระบบ หรือขอให้ทีมตรวจสอบได้ตลอดเวลา</p>`,
  },
  privacy: {
    title: 'นโยบายความเป็นส่วนตัว',
    version: auth.PRIVACY_VERSION,
    body: `<h2>ข้อมูลที่เก็บ</h2>
      <ul><li>อีเมลสถานศึกษา เพื่อยืนยันและกู้คืนบัญชี เก็บแบบเข้ารหัสและแยกจากโพสต์และประวัติกิจกรรม</li>
      <li>ชื่อที่แสดง ชื่อผู้ใช้ และถ้าคุณเลือกกรอก: ชั้นปี ความสนใจ และคำแนะนำตัวสั้น ๆ</li>
      <li>โพสต์ กิจกรรม การเข้าร่วม เพื่อน การบล็อก รายงาน และการแจ้งเตือนของคุณ</li></ul>
      <h2>ข้อมูลที่ไม่เก็บ</h2>
      <p>เลขบัตรประชาชน ที่อยู่บ้าน ศาสนา และตำแหน่ง GPS ของอุปกรณ์คุณ</p>
      <h2>ความยินยอมแยกตามวัตถุประสงค์</h2>
      <ul><li>สถานที่นัดหมายและหมุดบนแผนที่: ขอทุกครั้งที่โพสต์กิจกรรม</li>
      <li>ประวัติการเข้าร่วมกิจกรรม: ขอครั้งแรกที่กดเข้าร่วม และถอนได้</li>
      <li>ระบบแนะนำกิจกรรม (AI): ปิดไว้จนกว่าคุณจะเปิด และถอนได้</li></ul>
      <h2>ใครเห็นอะไร</h2>
      <p>โพสต์และกิจกรรมเห็นได้ทุกคน รายชื่อผู้เข้าร่วมเห็นได้เฉพาะผู้จัดและผู้เข้าร่วม ประวัติการเข้าร่วมบนโปรไฟล์เห็นได้ตามที่คุณตั้ง (ทุกคน เพื่อน หรือเฉพาะคุณ ค่าเริ่มต้นคือเพื่อน)</p>
      <h2>การส่งข้อมูลออก</h2>
      <p>ระบบแนะนำทำงานในเซิร์ฟเวอร์ของ JoinGun ไม่ส่งข้อมูลให้บริการ AI ภายนอก การค้นหาสถานที่บนแผนที่ส่งเฉพาะคำค้นหาไปที่ OpenStreetMap อีเมลแจ้งรหัสและการเตือนส่งผ่าน Gmail</p>
      <h2>สิทธิของคุณ</h2>
      <p>แก้ไขโปรไฟล์ ดาวน์โหลดข้อมูลของคุณเป็นไฟล์ ZIP ที่ล็อกด้วยรหัสผ่าน และลบบัญชีได้ที่หน้าตั้งค่า เมื่อลบบัญชี ระบบซ่อนบัญชีทันที เก็บอีเมลแบบเข้ารหัสและบันทึกการใช้งานไว้ 90 วันตามกฎหมาย แล้วลบหรือทำให้ระบุตัวไม่ได้ สำเนาสำรองของฐานข้อมูลจะหมุนออกภายใน 7 วันหลังจากนั้น</p>`,
  },
  safety: {
    title: 'นัดเจอให้ปลอดภัย',
    version: null,
    body: `<ul><li>นัดพบในพื้นที่สาธารณะที่มีคนอยู่ เช่น อาคารเรียน หอสมุด โรงยิม</li>
      <li>บอกเพื่อนหรือคนที่ไว้ใจว่าจะไปไหน กับใคร และกลับกี่โมง</li>
      <li>เครื่องหมายยืนยันอีเมลสถานศึกษาบอกได้แค่ว่าเจ้าของบัญชีเข้าถึงอีเมลนั้นได้ ไม่ได้รับประกันตัวตนหรือเจตนา</li>
      <li>อย่าให้ข้อมูลส่วนตัว เช่น ที่อยู่ เลขบัญชี หรือรหัสผ่าน กับคนที่เพิ่งรู้จัก</li>
      <li>ถ้ารู้สึกไม่ปลอดภัย ออกจากสถานที่ได้ทันที แล้วกด ⋯ บนโพสต์เพื่อรายงาน หรือบล็อกผู้ใช้</li>
      <li>เหตุฉุกเฉิน โทร 191 (ตำรวจ) หรือ 1669 (การแพทย์ฉุกเฉิน)</li></ul>`,
  },
};
export function renderPolicy(main, key, pageHead) {
  const policy = POLICIES[key];
  main.innerHTML = `${pageHead(policy.title, { back: true, sub: policy.version ? `เวอร์ชัน ${policy.version}` : '' })}
    <div class="policy-body stack">
      ${policy.version ? '<p class="draft-note">ฉบับร่างสำหรับการทดสอบกับกลุ่มเล็ก ยังไม่ผ่านการตรวจทางกฎหมาย</p>' : ''}
      ${policy.body}
    </div>`;
  return policy.title;
}

// ---- auth sheet ------------------------------------------------------------
// resume: 'terms' | 'profile' continues a sign-up that was left halfway (the session already exists).
export function openAuth({ mode = 'signup', reason = '', after = null, resume = null } = {}) {
  Object.assign(flow, { mode, reason, after, step: resume || 'email', email: '', busy: false, resumed: Boolean(resume) });
  stopResendTimer();
  renderStep();
  if (!dialog().open) openDialog(dialog());
  focusFirst();
}

// Run `action` now if signed in, otherwise after a successful sign-in.
export function requireAuth(reason, action) {
  if (auth.getUser()) action();
  else openAuth({ mode: 'login', reason, after: action });
}

function stepLabel() {
  if (flow.mode === 'login' && (flow.step === 'email' || flow.step === 'code')) return '';
  const n = STEP_NUMBER[flow.step];
  return `<div class="step-progress" aria-hidden="true">${[1, 2, 3, 4].map(i => `<span class="${i <= n ? 'done' : ''}"></span>`).join('')}</div><p class="step-label">ขั้นตอนที่ ${n} จาก 4</p>`;
}

function header() {
  const canGoBack = flow.step === 'code';
  return `<div class="auth-top">
      ${canGoBack ? `<button class="icon-button" type="button" data-auth="back" aria-label="ย้อนกลับไปแก้อีเมล">${icon('back')}</button>` : `<button class="icon-button" type="button" data-auth="close" aria-label="ปิด">${icon('x')}</button>`}
      <span class="auth-logo" aria-hidden="true">J</span>
      <span class="icon-spacer" aria-hidden="true"></span>
    </div>${stepLabel()}`;
}

const errorBox = () => '<p id="auth-error" class="error-message" role="alert" hidden></p>';

function renderStep() {
  const body = $('auth-body');
  const { step, mode } = flow;
  if (step === 'email') {
    body.innerHTML = `${header()}
      <h2 id="auth-title" class="auth-title">${mode === 'signup' ? 'สร้างบัญชีของคุณ' : 'เข้าสู่ระบบ JoinGun'}</h2>
      ${flow.reason ? `<p class="muted">${escapeHTML(REASONS[flow.reason] || '')}</p>` : ''}
      <form class="stack auth-form" data-form="email" novalidate>
        ${googleButton()}
        <div class="field">
          <label for="auth-email">อีเมลสถานศึกษา</label>
          <input id="auth-email" name="email" type="email" inputmode="email" autocomplete="email" required placeholder="ชื่อ@lamduan.mfu.ac.th" value="${escapeHTML(flow.email)}">
          <p class="help">เราจะส่งรหัส 6 หลักไปที่อีเมลนี้ ไม่ต้องตั้งรหัสผ่าน</p>
        </div>
        ${errorBox()}
        <button class="button button-primary" type="submit">ถัดไป</button>
        <p class="caption muted switch-mode">${mode === 'signup'
          ? 'มีบัญชีอยู่แล้ว? <button class="text-button inline" type="button" data-auth="to-login">เข้าสู่ระบบ</button>'
          : 'ยังไม่มีบัญชี? <button class="text-button inline" type="button" data-auth="to-signup">สมัคร</button>'}</p>
      </form>`;
  }
  if (step === 'code') {
    body.innerHTML = `${header()}
      <h2 id="auth-title" class="auth-title">เราส่งรหัสให้คุณแล้ว</h2>
      <p class="muted">กรอกรหัส 6 หลักที่ส่งไปที่ <strong>${escapeHTML(flow.email)}</strong> รหัสใช้ได้ ${flow.codeMinutes} นาที ถ้าไม่เห็นอีเมล ลองดูในโฟลเดอร์สแปม</p>
      <form class="stack auth-form" data-form="code" novalidate>
        <div class="field">
          <label for="auth-code">รหัสยืนยัน</label>
          <input id="auth-code" class="code-input" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="\\d{6}" maxlength="6" required>
        </div>
        ${errorBox()}
        <button class="button button-primary" type="submit">ยืนยัน</button>
        <button id="auth-resend" class="text-button" type="button" data-auth="resend"></button>
      </form>`;
    updateResend();
  }
  if (step === 'terms') {
    body.innerHTML = `${header()}
      <h2 id="auth-title" class="auth-title">${flow.resumed ? 'ตั้งค่าบัญชีต่อจากเดิม' : mode === 'login' ? 'ยังไม่มีบัญชีนี้ มาตั้งค่าบัญชีใหม่กัน' : 'ก่อนเริ่มใช้งาน'}</h2>
      <p class="muted">อ่านสรุปด้านล่าง แล้วยืนยันว่าคุณยอมรับข้อตกลง</p>
      <form class="stack auth-form" data-form="terms" novalidate>
        <ul class="terms-summary">
          <li>เราเก็บอีเมลสถานศึกษาแบบเข้ารหัส ชื่อที่แสดง และชื่อผู้ใช้ ไม่เก็บเลขบัตรประชาชน ที่อยู่ หรือ GPS ของคุณ</li>
          <li>การยืนยันอีเมลไม่ได้รับประกันตัวตนหรือความปลอดภัยของคนที่คุณจะไปเจอ ควรนัดในที่สาธารณะ</li>
          <li>ระบบบันทึกการเข้าสู่ระบบ การโพสต์ และการเข้าร่วมพร้อมเวลาและ IP ไว้อย่างน้อย 90 วัน</li>
          <li>ประวัติการเข้าร่วมกิจกรรมจะขอความยินยอมแยก ตอนที่คุณกดเข้าร่วมครั้งแรก ส่วนระบบแนะนำกิจกรรม (AI) ปิดไว้จนกว่าคุณจะเปิดเองในหน้าตั้งค่า</li>
          <li>ระบบบันทึกการส่งและตอบรับคำขอเป็นเพื่อน และส่งการแจ้งเตือนก่อนกิจกรรมเริ่ม ซึ่งปิดได้ในหน้าตั้งค่า</li>
        </ul>
        <p class="caption"><a href="#/terms" target="_blank" rel="noopener">อ่านข้อตกลงการใช้งาน</a> · <a href="#/privacy" target="_blank" rel="noopener">อ่านนโยบายความเป็นส่วนตัว</a></p>
        <label class="checkbox-row">
          <input id="auth-terms" type="checkbox" required>
          <span>ฉันได้อ่านและยอมรับข้อตกลงการใช้งาน (${auth.TERMS_VERSION}) และนโยบายความเป็นส่วนตัว (${auth.PRIVACY_VERSION})</span>
        </label>
        ${errorBox()}
        <button class="button button-primary" type="submit">ยอมรับและดำเนินการต่อ</button>
      </form>`;
  }
  if (step === 'profile') {
    body.innerHTML = `${header()}
      <h2 id="auth-title" class="auth-title">ตั้งค่าโปรไฟล์</h2>
      <p class="muted">คนอื่นจะเห็นชื่อนี้ในโพสต์และกิจกรรมของคุณ</p>
      <form class="stack auth-form" data-form="profile" novalidate>
        <div class="field">
          <label for="auth-name">ชื่อที่แสดง</label>
          <input id="auth-name" name="displayName" maxlength="50" autocomplete="nickname" required placeholder="เช่น ต้นข้าว">
        </div>
        <div class="field">
          <label for="auth-username">ชื่อผู้ใช้</label>
          <div class="prefix-input"><span aria-hidden="true">@</span><input id="auth-username" name="username" maxlength="20" autocomplete="username" autocapitalize="none" spellcheck="false" required placeholder="tonkhao_23"></div>
          <p id="username-help" class="help">3 ถึง 20 ตัว ใช้ a–z ตัวเลข และ _ เท่านั้น</p>
        </div>
        <div class="field">
          <label for="auth-year">ชั้นปี (ไม่บังคับ)</label>
          <select id="auth-year" name="year">
            <option value="">ไม่ระบุ</option><option value="1">ปี 1</option><option value="2">ปี 2</option>
            <option value="3">ปี 3</option><option value="4">ปี 4</option><option value="other">อื่น ๆ</option>
          </select>
        </div>
        <fieldset class="stack-tight">
          <legend>สนใจกิจกรรมแบบไหน (ไม่บังคับ)</legend>
          <div class="chip-group">${Object.entries(INTERESTS).map(([value, label]) => `<label class="chip"><input type="checkbox" name="interests" value="${value}"><span>${label}</span></label>`).join('')}</div>
        </fieldset>
        ${errorBox()}
        <button class="button button-primary" type="submit">เสร็จสิ้น</button>
      </form>`;
  }
  body.setAttribute('aria-labelledby', 'auth-title');
}

function focusFirst() {
  const target = $('auth-body').querySelector('input:not([type=checkbox]), input');
  target?.focus();
}

function showError(message, fieldId) {
  const box = $('auth-error');
  if (!box) return;
  box.textContent = message;
  box.hidden = false;
  const field = fieldId && $(fieldId);
  if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
}

// ---- resend countdown ------------------------------------------------------------
function stopResendTimer() { clearInterval(flow.resendTimer); flow.resendTimer = null; }
function startResendTimer(seconds) {
  stopResendTimer();
  flow.resendLeft = seconds;
  flow.resendTimer = setInterval(() => {
    flow.resendLeft -= 1;
    if (flow.resendLeft <= 0) stopResendTimer();
    updateResend();
  }, 1000);
}
function updateResend() {
  const button = $('auth-resend');
  if (!button) return;
  button.disabled = flow.resendLeft > 0;
  button.textContent = flow.resendLeft > 0 ? `ยังไม่ได้รับรหัส? ขอรหัสใหม่ได้ใน ${flow.resendLeft} วินาที` : 'ไม่ได้รับรหัส? ส่งรหัสใหม่';
}

// ---- submit handlers -------------------------------------------------------------
async function withBusy(form, label, work) {
  if (flow.busy) return;
  flow.busy = true;
  const button = form.querySelector('button[type=submit]');
  const original = button.textContent;
  const controls = [...form.querySelectorAll('input, select, button')];
  controls.forEach(control => { control.disabled = true; });
  button.textContent = label;
  let failure = null;
  try { await work(); } catch (error) { failure = error; }
  flow.busy = false;
  if (!form.isConnected) return; // the step already moved on
  controls.forEach(control => { control.disabled = false; });
  button.textContent = original;
  if (failure) showError(failure.message, failure.field ? { email: 'auth-email', code: 'auth-code', username: 'auth-username' }[failure.field] : null);
}

function goTo(step) {
  flow.step = step;
  renderStep();
  focusFirst();
}

function finish(user) {
  stopResendTimer();
  dialog().close();
  toast(`ยินดีต้อนรับ ${user.displayName}`);
  const after = flow.after;
  flow.after = null;
  if (after) after();
  else if (location.hash === '#/welcome') location.hash = '#/';
}

async function onSubmit(event) {
  event.preventDefault();
  const form = event.target;
  form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  const kind = form.dataset.form;
  if (kind === 'email') {
    const email = form.elements.email.value;
    if (!auth.isAllowedEmail(email)) { showError(`ใช้อีเมลสถานศึกษาที่ลงท้ายด้วย .${auth.EMAIL_SUFFIX}`, 'auth-email'); return; }
    await withBusy(form, 'กำลังส่งรหัส…', async () => {
      let sent;
      try { sent = await auth.requestCode(email); }
      catch (error) {
        if (error.status !== 429) throw error;
        // Too soon for another code: the latest one sent to this address still works until it expires,
        // so go on to the code step instead of leaving the person stuck on this one.
        flow.email = auth.normalizeEmail(email);
        stopResendTimer();
        flow.resendLeft = 0;
        goTo('code');
        showError(`${error.message} ใช้รหัสล่าสุดที่ได้รับทางอีเมลได้ ถ้ายังไม่หมดอายุ`);
        return;
      }
      const { resendAfter, expiresInMinutes } = sent;
      flow.email = auth.normalizeEmail(email);
      flow.codeMinutes = expiresInMinutes || flow.codeMinutes;
      goTo('code');
      startResendTimer(resendAfter);
      updateResend();
    });
  }
  if (kind === 'code') {
    const code = form.elements.code.value.trim();
    if (!/^\d{6}$/.test(code)) { showError('กรอกรหัส 6 หลักจากอีเมล', 'auth-code'); return; }
    await withBusy(form, 'กำลังตรวจสอบ…', async () => {
      const result = await auth.verifyCode(flow.email, code);
      stopResendTimer();
      if (result.status === 'signed-in') finish(result.user);
      else goTo(result.status === 'needs-profile' ? 'profile' : 'terms');
    });
  }
  if (kind === 'terms') {
    if (!$('auth-terms').checked) { showError('กรุณาติ๊กยอมรับข้อตกลงก่อนดำเนินการต่อ', 'auth-terms'); return; }
    await withBusy(form, 'กำลังบันทึก…', async () => { await auth.acceptTerms(); goTo('profile'); });
  }
  if (kind === 'profile') {
    const displayName = form.elements.displayName.value.trim();
    const username = form.elements.username.value.trim().toLowerCase();
    if (!displayName) { showError('กรุณาตั้งชื่อที่แสดง', 'auth-name'); return; }
    if (!auth.USERNAME_PATTERN.test(username)) { showError('ชื่อผู้ใช้ต้องมี 3 ถึง 20 ตัว ใช้ a–z ตัวเลข และ _', 'auth-username'); return; }
    const profile = {
      displayName, username,
      year: form.elements.year.value || null,
      interests: [...form.querySelectorAll('input[name=interests]:checked')].map(input => input.value),
    };
    await withBusy(form, 'กำลังสร้างบัญชี…', async () => finish(await auth.saveProfile(profile)));
  }
}

async function onClick(event) {
  const action = event.target.closest('[data-auth]')?.dataset.auth;
  if (!action) return;
  if (action === 'close' && !flow.busy) dialog().close();
  if (action === 'back' && !flow.busy) { stopResendTimer(); goTo('email'); }
  if (action === 'to-login' || action === 'to-signup') { flow.mode = action === 'to-login' ? 'login' : 'signup'; goTo('email'); }
  if (action === 'resend' && flow.resendLeft <= 0) {
    try { const { resendAfter } = await auth.requestCode(flow.email); startResendTimer(resendAfter); updateResend(); toast('ส่งรหัสใหม่แล้ว รหัสเดิมใช้ไม่ได้แล้ว'); }
    catch (error) { showError(error.message); }
  }
  if (action === 'google') toast('การเข้าสู่ระบบด้วย Google ยังไม่เปิดใช้');
}

export function setupAuthUI() {
  setupDialog(dialog(), () => flow.busy);
  dialog().addEventListener('close', stopResendTimer);
  $('auth-body').addEventListener('submit', onSubmit);
  $('auth-body').addEventListener('click', onClick);
  document.addEventListener('click', event => {
    const open = event.target.closest('[data-auth-open], [data-auth="signup"], [data-auth="login"]');
    if (open && !dialog().contains(open)) openAuth({ mode: open.dataset.authOpen || open.dataset.auth });
  });
}
