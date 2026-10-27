import { expect } from '@playwright/test';

const HELPER = 'http://127.0.0.1:3101';

// The sign-in code the test server recorded for this address.
export async function codeFor(request, email) {
  const res = await request.get(`${HELPER}/code?email=${encodeURIComponent(email)}`);
  expect(res.ok(), `no code recorded for ${email}`).toBeTruthy();
  return (await res.text()).trim();
}

// Full sign-up through the API, sharing the browser's cookies, for tests whose subject is not sign-up itself.
export async function signUpByApi(page, email, username) {
  const request = page.request;
  expect((await request.post('/api/auth/request-code', { data: { email } })).status()).toBe(202);
  expect((await request.post('/api/auth/verify', { data: { email, code: await codeFor(request, email) } })).status()).toBe(200);
  const versions = await (await request.get(`${HELPER}/terms`)).json();
  expect((await request.post('/api/auth/terms', { data: versions })).status()).toBe(204);
  expect((await request.put('/api/me', { data: { displayName: `E2E ${username}`, username, interests: ['sport'] } })).status()).toBe(200);
}
