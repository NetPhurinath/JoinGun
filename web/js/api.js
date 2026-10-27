// Thin client for the JoinGun API (contract: server/README.md). Errors carry the server message and code so forms
// can map them to a field.
export class ApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

const OFFLINE = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณารัน npm start แล้วเปิด http://127.0.0.1:3000';

async function request(path, { method = 'GET', body } = {}) {
  if (location.protocol === 'file:') throw new ApiError(OFFLINE, 0);
  let response;
  try {
    response = await fetch(path, { method, credentials: 'same-origin', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch { throw new ApiError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง', 0); }
  if (response.status === 204) return null;
  if (!response.headers.get('content-type')?.includes('application/json')) throw new ApiError(OFFLINE, response.status);
  const data = await response.json();
  if (!response.ok) throw new ApiError(data.error || 'ทำรายการไม่สำเร็จ', response.status, data.code);
  return data;
}
const get = path => request(path);
const post = (path, body = {}) => request(path, { method: 'POST', body });
const put = (path, body) => request(path, { method: 'PUT', body });
const del = path => request(path, { method: 'DELETE' });
const id = value => encodeURIComponent(value);

// Feed and posts.
export function listPosts({ category = 'all', date = '', q = '', before = null, limit = 20, scope = 'all', open = false, author = null } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (category !== 'all') params.set('category', category);
  if (date) params.set('date', date);
  if (q.trim()) params.set('q', q.trim());
  if (before) params.set('before', before);
  if (scope !== 'all') params.set('scope', scope);
  if (open) params.set('open', '1');
  return get(author ? `/api/users/${id(author)}/posts?${params}` : `/api/posts?${params}`);
}
export const getPost = postId => get(`/api/posts/${id(postId)}`);
export const createPost = payload => post('/api/posts', payload);
export const updatePost = (postId, payload) => put(`/api/posts/${id(postId)}`, payload);
export const deletePost = postId => del(`/api/posts/${id(postId)}`);

// Joining and leaving.
export const joinActivity = (postId, participationConsent) => post(`/api/activities/${id(postId)}/join`, participationConsent ? { participationConsent: true } : {});
export const leaveActivity = postId => post(`/api/activities/${id(postId)}/leave`);
export const listParticipants = postId => get(`/api/activities/${id(postId)}/participants`);
export const myActivities = () => get('/api/me/activities');

// Reports and blocks.
export const reportPost = (postId, reason, details) => post('/api/reports', { postId, reason, details });
export const blockUser = userId => post('/api/me/blocks', { userId });
export const unblockUser = userId => del(`/api/me/blocks/${id(userId)}`);
export const listBlocks = () => get('/api/me/blocks');

// People and friends.
export const getProfile = username => get(`/api/users/${id(username)}`);
export const getHistory = username => get(`/api/users/${id(username)}/history`);
export const searchUsers = q => get(`/api/users?q=${encodeURIComponent(q)}`);
export const listFriends = () => get('/api/friends');
export const friendSuggestions = () => get('/api/friends/suggestions');
export const sendFriendRequest = userId => post('/api/friends/requests', { userId });
export const acceptFriend = requestId => post(`/api/friends/requests/${id(requestId)}/accept`);
export const declineFriend = requestId => post(`/api/friends/requests/${id(requestId)}/decline`);
export const cancelFriend = requestId => post(`/api/friends/requests/${id(requestId)}/cancel`);
export const removeFriend = userId => del(`/api/friends/${id(userId)}`);

// Notifications.
export const listNotifications = (before = null) => get(`/api/notifications${before ? `?before=${encodeURIComponent(before)}` : ''}`);
export const unreadCount = () => get('/api/notifications/unread-count');
export const markRead = ids => post('/api/notifications/read', ids === 'all' ? { all: true } : { ids });
export const getNotificationSettings = () => get('/api/me/notification-settings');
export const saveNotificationSettings = settings => put('/api/me/notification-settings', settings);

// Recommendations (separate AI consent).
export const getRecommendations = () => get('/api/recommendations');
export const recommendationFeedback = payload => post('/api/recommendations/feedback', payload);
export const resetRecommendations = () => post('/api/recommendations/reset');
export const grantAiConsent = () => post('/api/me/consents/ai', { accept: true, acknowledgeLimitations: true });
export const withdrawAiConsent = () => post('/api/me/consents/ai/withdraw');

// My account.
export const getConsents = () => get('/api/me/consents');
export const withdrawParticipation = () => post('/api/me/consents/participation/withdraw');
export const savePrivacy = historyVisibility => put('/api/me/privacy', { historyVisibility });
export const sendAppeal = message => post('/api/me/appeal', { message });
export const appealStatus = () => get('/api/me/appeal');
export const deleteAccount = confirmUsername => post('/api/me/delete', { confirmUsername });
// Returns the password-protected ZIP as a Blob.
export async function exportMyData(password) {
  let response;
  try { response = await fetch('/api/me/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }); }
  catch { throw new ApiError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองอีกครั้ง', 0); }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.error || 'ดาวน์โหลดไม่สำเร็จ', response.status, body.code);
  }
  return response.blob();
}

// Moderators.
export const modSummary = () => get('/api/mod/summary');
export const modReports = status => get(`/api/mod/reports?status=${status}`);
export const modReview = (reportId, action, note) => post(`/api/mod/reports/${id(reportId)}/review`, { action, note });
export const modAppeals = status => get(`/api/mod/appeals?status=${status}`);
export const modResolveAppeal = (appealId, outcome, note) => post(`/api/mod/appeals/${id(appealId)}/resolve`, { outcome, note });
export const modRecReviews = status => get(`/api/mod/recommendation-reviews?status=${status}`);
export const modCloseRecReview = reviewId => post(`/api/mod/recommendation-reviews/${id(reviewId)}/close`);
