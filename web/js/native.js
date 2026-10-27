// Native features when JoinGun runs inside the Capacitor Android app (capacitor.config.json loads this server's web/
// through server.url, so the plugins are reached through window.Capacitor.Plugins; there is no bundler).
// In a normal browser every function here does nothing.
//   - Android back button: close an open sheet, else go back, else leave the app from the home screen
//   - status bar colour follows the light/dark theme
//   - activity reminders (F4) scheduled on the phone with Local Notifications, so they arrive with the app closed
import { myActivities, getNotificationSettings } from './api.js';

const cap = () => window.Capacitor;
export const isNative = () => Boolean(cap()?.isNativePlatform?.());
const plugin = name => (isNative() ? cap().Plugins?.[name] : null);

// Notification ids are numbers; derive a stable one from the activity id.
const notificationId = postId => {
  let h = 7;
  for (const char of postId) h = (h * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(h) % 2_000_000_000 || 1;
};

let permission = null;
async function canNotify(ask) {
  const notes = plugin('LocalNotifications');
  if (!notes) return false;
  if (permission === 'granted') return true;
  try {
    let status = (await notes.checkPermissions()).display;
    if (status !== 'granted' && ask) status = (await notes.requestPermissions()).display;
    permission = status;
    return status === 'granted';
  } catch { return false; }
}

// Cancels JoinGun's scheduled reminders and schedules one per upcoming activity at startsAt − lead time.
export async function syncReminders({ signedIn = true, ask = false } = {}) {
  const notes = plugin('LocalNotifications');
  if (!notes) return { scheduled: 0 };
  try {
    const pending = await notes.getPending();
    if (pending.notifications?.length) await notes.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
    if (!signedIn) return { scheduled: 0 };
    const [{ upcoming }, settings] = await Promise.all([myActivities(), getNotificationSettings()]);
    if (!settings.reminders || !upcoming.length) return { scheduled: 0 };
    if (!(await canNotify(ask))) return { scheduled: 0 };
    const now = Date.now();
    const lead = settings.reminderMinutes * 60_000;
    const notifications = upcoming
      .filter(post => !post.deletedAt && new Date(post.activity.startsAt).getTime() - lead > now + 30_000)
      .slice(0, 50)
      .map(post => ({
        id: notificationId(post.id),
        title: 'JoinGun: กิจกรรมใกล้เริ่มแล้ว',
        body: `“${post.activity.title}” เริ่ม ${new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(post.activity.startsAt))} น. ที่ ${post.activity.location}`,
        schedule: { at: new Date(new Date(post.activity.startsAt).getTime() - lead), allowWhileIdle: true },
        extra: { postId: post.id },
      }));
    if (notifications.length) await notes.schedule({ notifications });
    return { scheduled: notifications.length };
  } catch (error) {
    console.warn('Reminder sync failed', error?.message);
    return { scheduled: 0 };
  }
}

function applyStatusBar() {
  const bar = plugin('StatusBar');
  if (!bar) return;
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  bar.setStyle({ style: dark ? 'DARK' : 'LIGHT' }).catch(() => {});
  bar.setBackgroundColor?.({ color: dark ? '#000000' : '#FFFFFF' }).catch(() => {});
}

// onResume: called when the app comes back to the foreground (refresh badges, reminders).
export function setupNative({ onResume = () => {} } = {}) {
  if (!isNative()) return;
  document.documentElement.classList.add('native-app');
  applyStatusBar();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyStatusBar);
  const app = plugin('App');
  app?.addListener('backButton', () => {
    const open = [...document.querySelectorAll('dialog[open]')].pop();
    if (open) { open.close(); return; }
    const root = ['', '#/', '#/welcome'].includes(location.hash);
    if (root) app.exitApp();
    else history.back();
  });
  app?.addListener('appStateChange', state => { if (state.isActive) onResume(); });
  plugin('LocalNotifications')?.addListener('localNotificationActionPerformed', event => {
    const postId = event?.notification?.extra?.postId;
    if (postId) location.hash = `#/activity/${encodeURIComponent(postId)}`;
  });
}
