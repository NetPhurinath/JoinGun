// Create-post dialog, also used to edit one's own post. Location consent is a separate, unticked checkbox (LR1); no GPS is read and no
// personal fields are collected (LR5). The server re-validates everything; this file only gives faster, Thai feedback.
import { createPost, updatePost } from './api.js';
import { sessionLost } from './auth.js';
import { $, openDialog, setupDialog, toast } from './dom.js';
import { MAX_CAPACITY, todayInBangkok, toBangkokInputs } from './format.js';
import { createPicker, searchPlaces } from './map.js';

let busy = false;
let picker = null;
let pin = null;
let editing = null; // the post being edited, or null when creating

// Server messages (English, see server/validation.js) mapped to a field and a Thai message.
const SERVER_ERRORS = [
  [/^content/, 'post-content', 'กรุณาเขียนข้อความ 1 ถึง 5,000 ตัวอักษร'],
  [/^title/, 'activity-title', 'กรุณาตั้งชื่อกิจกรรม 1 ถึง 120 ตัวอักษร'],
  [/^location must/, 'activity-place', 'กรุณาระบุสถานที่ 1 ถึง 300 ตัวอักษร'],
  [/^meeting/, 'activity-meeting', 'รายละเอียดจุดนัดพบต้องไม่เกิน 1,000 ตัวอักษร'],
  [/^capacity/, 'activity-capacity', `จำนวนผู้เข้าร่วมต้องเป็น 2 ถึง ${MAX_CAPACITY} คน รวมผู้จัด`],
  [/^startsAt must be in the future/, 'activity-time', 'เวลาเริ่มต้องเป็นเวลาในอนาคต'],
  [/^(startsAt|Invalid clock|Invalid calendar)/, 'activity-date', 'วันที่หรือเวลาไม่ถูกต้อง'],
  [/locationConsent/, 'location-consent', 'กรุณายินยอมให้แสดงสถานที่นัดหมายก่อนเผยแพร่กิจกรรม'],
  [/latitude/, 'create-map', 'หมุดบนแผนที่ไม่ถูกต้อง กรุณาปักใหม่หรือลบหมุด'],
];

const form = () => $('create-form');
const isActivity = () => $('post-type').value === 'activity';

// The visible type switch and category chips write into the hidden inputs the rest of this file reads.
function setType(type) {
  $('post-type').value = type;
  form().querySelectorAll('input[name=post-type]').forEach(input => { input.checked = input.value === type; });
}
function setCategory(category) {
  $('activity-category').value = category;
  form().querySelectorAll('input[name=activity-category]').forEach(input => { input.checked = input.value === category; });
}
function updateCounter() {
  $('content-counter').textContent = `${$('post-content').value.length.toLocaleString('th-TH')} / 5,000`;
}

async function runPlaceSearch() {
  const q = $('place-search').value.trim();
  const list = $('place-results');
  if (q.length < 2) { list.hidden = true; return; }
  list.hidden = false;
  list.innerHTML = '<li class="help" style="padding:8px 12px">กำลังค้นหา…</li>';
  try {
    const results = await searchPlaces(q);
    list.innerHTML = results.length
      ? results.map((place, index) => `<li><button type="button" data-place="${index}">${place.name.replace(/[&<>"']/g, '')}</button></li>`).join('')
      : '<li class="help" style="padding:8px 12px">ไม่พบสถานที่ ลองพิมพ์ชื่ออื่น หรือแตะแผนที่เพื่อปักหมุดเอง</li>';
    list.onclick = event => {
      const button = event.target.closest('[data-place]');
      if (!button) return;
      const place = results[Number(button.dataset.place)];
      picker?.setPin({ lat: place.lat, lng: place.lng });
      if (!$('activity-place').value.trim()) $('activity-place').value = place.name.split(',')[0].slice(0, 300);
      list.hidden = true;
    };
  } catch (error) {
    list.innerHTML = '<li class="help" style="padding:8px 12px">ค้นหาสถานที่ไม่ได้ตอนนี้ แตะแผนที่เพื่อปักหมุดเองได้</li>';
  }
}

function showError(message, fieldId) {
  const box = $('create-error');
  box.textContent = message;
  box.hidden = false;
  form().querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  const field = fieldId && $(fieldId);
  if (field) {
    field.setAttribute('aria-invalid', 'true');
    field.focus();
  } else box.scrollIntoView({ block: 'nearest' });
}

function clearError() {
  $('create-error').hidden = true;
  form().querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
}

function syncType() {
  const activity = isActivity();
  const fields = $('activity-fields');
  fields.hidden = !activity;
  fields.disabled = !activity;
  $('post-content').placeholder = activity ? 'เช่น มือใหม่มาได้ เอาไม้แบดกับน้ำมาด้วย' : 'อยากแชร์อะไรกับเพื่อนในมหาวิทยาลัย';
  if (activity && !picker) {
    picker = createPicker($('create-map'), value => {
      pin = value;
      $('pin-status').textContent = value ? `ปักหมุดแล้วที่ ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)} ลากหมุดเพื่อปรับตำแหน่งได้` : 'แตะบนแผนที่เพื่อปักหมุด ระบบไม่อ่านตำแหน่งปัจจุบันของคุณ';
      $('pin-clear').hidden = !value;
    }, pin);
  }
  if (activity) picker?.resize();
}

// Client-side checks in the order the fields appear. Returns [message, fieldId] or null.
function checkForm() {
  const value = id => $(id).value.trim();
  if (!value('post-content')) return ['กรุณาเขียนข้อความหรือรายละเอียด', 'post-content'];
  if (!isActivity()) return null;
  if (!value('activity-title')) return ['กรุณาตั้งชื่อกิจกรรม', 'activity-title'];
  if (!value('activity-date')) return ['กรุณาเลือกวันที่', 'activity-date'];
  if (!value('activity-time')) return ['กรุณาเลือกเวลาเริ่ม', 'activity-time'];
  if (new Date(`${value('activity-date')}T${value('activity-time')}:00+07:00`).getTime() <= Date.now()) return ['เวลาเริ่มต้องเป็นเวลาในอนาคต', 'activity-time'];
  if (!value('activity-place')) return ['กรุณาระบุสถานที่', 'activity-place'];
  const capacity = Number(value('activity-capacity'));
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > MAX_CAPACITY) return [`จำนวนผู้เข้าร่วมต้องเป็น 2 ถึง ${MAX_CAPACITY} คน รวมผู้จัด`, 'activity-capacity'];
  if (!$('location-consent').checked) return ['กรุณายินยอมให้แสดงสถานที่นัดหมายก่อนเผยแพร่กิจกรรม', 'location-consent'];
  return null;
}

function buildPayload() {
  const payload = { type: $('post-type').value, content: $('post-content').value };
  if (payload.type === 'activity') {
    payload.locationConsent = $('location-consent').checked;
    payload.activity = {
      title: $('activity-title').value,
      category: $('activity-category').value,
      // The form's date and time are university local time.
      startsAt: `${$('activity-date').value}T${$('activity-time').value}:00+07:00`,
      location: $('activity-place').value,
      capacity: Number($('activity-capacity').value),
    };
    if ($('activity-meeting').value.trim()) payload.activity.meeting = $('activity-meeting').value;
    if (pin) Object.assign(payload.activity, pin);
  }
  return payload;
}

function prepare(post) {
  picker?.destroy();
  picker = null; editing = post; pin = post?.activity && post.activity.lat !== null ? { lat: post.activity.lat, lng: post.activity.lng } : null;
  form().reset();
  clearError();
  $('activity-date').min = todayInBangkok();
  $('pin-clear').hidden = !pin;
  $('create-title').textContent = post ? 'แก้ไขโพสต์' : 'สร้างโพสต์';
  $('publish-button').textContent = post ? 'บันทึกการแก้ไข' : 'เผยแพร่โพสต์';
  $('post-type').disabled = Boolean(post);
  form().querySelectorAll('input[name=post-type]').forEach(input => { input.disabled = Boolean(post); });
  $('publish-top').textContent = post ? 'บันทึก' : 'เผยแพร่';
  $('place-results').hidden = true;
  setType('activity');
  setCategory('sport');
  updateCounter();
}

// preset: 'text' or an activity category ('sport', 'study', 'cafe') from the composer buttons.
export function openCreate(preset = null) {
  prepare(null);
  if (preset === 'text') setType('text');
  else if (preset) setCategory(preset);
  openDialog($('create-dialog'));
  syncType();
}

// Edit one's own post. The location consent starts unticked again, because the meeting place is published again.
export function openEdit(post) {
  prepare(post);
  setType(post.type);
  $('post-content').value = post.content;
  updateCounter();
  const a = post.activity;
  if (a) {
    const { date, time } = toBangkokInputs(a.startsAt);
    $('activity-title').value = a.title;
    setCategory(a.category);
    $('activity-date').value = date;
    $('activity-time').value = time;
    $('activity-place').value = a.location;
    $('activity-meeting').value = a.meeting || '';
    $('activity-capacity').value = a.capacity;
  }
  openDialog($('create-dialog'));
  syncType();
  if (pin) $('pin-status').textContent = `หมุดเดิมที่ ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)} ลากหรือแตะแผนที่เพื่อย้าย`;
}

export function setupCreate(onCreated, onUpdated = () => {}) {
  setupDialog($('create-dialog'), () => busy);
  form().addEventListener('change', event => {
    if (event.target.name === 'post-type') { setType(event.target.value); clearError(); syncType(); }
    if (event.target.name === 'activity-category') setCategory(event.target.value);
  });
  $('post-content').addEventListener('input', updateCounter);
  $('place-search-button').addEventListener('click', runPlaceSearch);
  $('place-search').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); runPlaceSearch(); } });
  $('pin-clear').addEventListener('click', () => picker?.clear());
  form().addEventListener('input', event => event.target.removeAttribute('aria-invalid'));
  form().addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const problem = checkForm();
    if (problem) { showError(...problem); return; }
    busy = true;
    clearError();
    const button = $('publish-button');
    $('publish-top').disabled = true;
    const controls = [...form().querySelectorAll('input, textarea, select, button')];
    const wasDisabled = controls.map(c => c.disabled);
    controls.forEach(c => { c.disabled = true; });
    button.textContent = editing ? 'กำลังบันทึก…' : 'กำลังเผยแพร่…';
    let saved = null, failure = null;
    const wasEditing = editing;
    try { saved = wasEditing ? await updatePost(wasEditing.id, buildPayload()) : await createPost(buildPayload()); }
    catch (error) { failure = error; }
    busy = false;
    controls.forEach((c, i) => { c.disabled = wasDisabled[i]; });
    button.textContent = wasEditing ? 'บันทึกการแก้ไข' : 'เผยแพร่โพสต์';
    $('publish-top').disabled = false;
    if (saved) {
      $('create-dialog').close();
      if (wasEditing) { toast('บันทึกการแก้ไขแล้ว'); onUpdated(saved); }
      else { toast(saved.activity ? 'เผยแพร่กิจกรรมแล้ว' : 'เผยแพร่โพสต์แล้ว'); onCreated(saved); }
      return;
    }
    // Controls are enabled again here, so the invalid field can receive focus.
    if (failure.status === 401) {
      // The session ended while the form was open; the work stays in the form.
      sessionLost();
      showError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง แล้วกดเผยแพร่ใหม่');
      return;
    }
    // Messages with a code (started, capacity-below-joined, not-owner…) are already Thai.
    if (failure.code) { showError(failure.message, failure.code === 'capacity-below-joined' ? 'activity-capacity' : null); return; }
    const match = SERVER_ERRORS.find(([pattern]) => pattern.test(failure.message));
    showError(match ? match[2] : (failure.status ? 'เผยแพร่ไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง' : failure.message), match?.[1]);
  });
}
