export class ValidationError extends Error {}
const fail = message => { throw new ValidationError(message); };
function text(value, name, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    fail(`${name} must contain 1–${max} characters.`);
  }
  return value.trim();
}
export function validatePost(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('A JSON object is required.');
  const allowed = new Set(['type', 'content', 'activity', 'locationConsent']);
  if (Object.keys(body).some(key => !allowed.has(key))) fail('Unknown post field.');
  if (!['text', 'activity'].includes(body.type)) fail('type must be text or activity.');
  const post = { type: body.type, content: text(body.content, 'content', 5000), activity: null };
  if (post.type === 'text') {
    if (body.activity !== undefined || body.locationConsent !== undefined) fail('Text posts cannot contain activity data.');
    return post;
  }
  const a = body.activity;
  if (!a || typeof a !== 'object' || Array.isArray(a)) fail('activity is required.');
  if (Object.keys(a).some(key => !['title', 'startsAt', 'location', 'capacity', 'category', 'meeting', 'lat', 'lng'].includes(key))) fail('Unknown activity field.');
  if (body.locationConsent !== true) fail('Explicit locationConsent is required for an activity meeting location.');
  if (typeof a.startsAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(a.startsAt)) fail('startsAt must be an ISO timestamp with a timezone.');
  const datePart = a.startsAt.slice(0, 10);
  if (+a.startsAt.slice(11,13) > 23 || +a.startsAt.slice(14,16) > 59 || +a.startsAt.slice(17,19) > 59) fail('Invalid clock time.');
  const calendar = new Date(`${datePart}T00:00:00Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0,10) !== datePart) fail('Invalid calendar date.');
  const start = new Date(a.startsAt);
  if (!Number.isFinite(start.getTime()) || start.getTime() <= Date.now()) fail('startsAt must be in the future.');
  if (!Number.isInteger(a.capacity) || a.capacity < 2 || a.capacity > 1000) fail('capacity must be an integer from 2 to 1000, including the host.');
  post.activity = { title: text(a.title, 'title', 120), startsAt: start.toISOString(), location: text(a.location, 'location', 300), capacity: a.capacity };
  if (a.category !== undefined && !['sport','study','cafe'].includes(a.category)) fail('Invalid activity category.');
  if ((a.lat !== undefined || a.lng !== undefined) && (typeof a.lat !== 'number' || typeof a.lng !== 'number' || !Number.isFinite(a.lat) || !Number.isFinite(a.lng) || Math.abs(a.lat)>90 || Math.abs(a.lng)>180)) fail('Valid latitude and longitude must be provided together.');
  Object.assign(post.activity, {category:a.category || 'sport', meeting:a.meeting === undefined ? '' : text(a.meeting,'meeting',1000), lat:a.lat ?? null, lng:a.lng ?? null});
  return post;
}
