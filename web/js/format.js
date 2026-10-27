// Dates are always shown in the university's timezone, e.g. "8 ก.ย. 2569 · 17:00 น.".
const TIME_ZONE = 'Asia/Bangkok';
const dateFormat = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TIME_ZONE });
const timeFormat = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TIME_ZONE });
const dayFormat = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TIME_ZONE });
const weekdayFormat = new Intl.DateTimeFormat('th-TH', { weekday: 'long', timeZone: TIME_ZONE });
const monthFormat = new Intl.DateTimeFormat('th-TH', { month: 'short', timeZone: TIME_ZONE });
const dayNumberFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: TIME_ZONE });
const shortDate = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', timeZone: TIME_ZONE });

export const formatDateTime = value => {
  const date = new Date(value);
  return `${dateFormat.format(date)} · ${timeFormat.format(date)} น.`;
};
export const formatTime = value => `${timeFormat.format(new Date(value))} น.`;
export const formatDay = day => dateFormat.format(new Date(`${day}T12:00:00+07:00`));
export const formatWeekday = value => weekdayFormat.format(new Date(value));
export const monthShort = value => monthFormat.format(new Date(value));
export const dayNumber = value => dayNumberFormat.format(new Date(value));
// YYYY-MM-DD for "today" in Bangkok, used as the minimum activity date.
export const todayInBangkok = () => dayFormat.format(new Date());

// X-style relative time for posts: "เมื่อสักครู่", "5 นาที", "3 ชม.", then a short date.
export function relativeTime(value) {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'เมื่อสักครู่';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} นาที`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} ชม.`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)} วัน`;
  return shortDate.format(new Date(value));
}

// "อีก 2 วัน", "อีก 3 ชม.", "เริ่มแล้ว" for an activity start.
export function untilText(value) {
  const minutes = Math.round((new Date(value).getTime() - Date.now()) / 60000);
  if (minutes <= 0) return 'เริ่มแล้ว';
  if (minutes < 60) return `อีก ${minutes} นาที`;
  if (minutes < 24 * 60) return `อีก ${Math.floor(minutes / 60)} ชม.`;
  return `อีก ${Math.floor(minutes / 1440)} วัน`;
}

export const CATEGORY_LABELS = { all: 'ทุกโพสต์', text: 'ข้อความทั่วไป', sport: 'กีฬา', study: 'อ่านหนังสือ', cafe: 'คาเฟ่' };
export const YEAR_LABELS = { 1: 'ปี 1', 2: 'ปี 2', 3: 'ปี 3', 4: 'ปี 4', other: 'อื่น ๆ' };
export const MAX_CAPACITY = 50;

// "2/8 คน · เหลือ 6 ที่" — capacity includes the host.
export function seatsText(activity) {
  const left = Math.max(activity.capacity - activity.joinedCount, 0);
  return `${activity.joinedCount}/${activity.capacity} คน รวมผู้จัด · ${left ? `เหลือ ${left} ที่` : 'เต็มแล้ว'}`;
}

// ISO timestamp → the date and time inputs' values in Bangkok time ({date: "2026-10-16", time: "17:00"}).
export function toBangkokInputs(iso) {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TIME_ZONE }).format(date);
  return { date: dayFormat.format(date), time };
}
