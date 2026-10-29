// Core workflow "join an activity from the feed" in a real browser (test plan L2). Each title starts with its
// requirement ID; the test-plan case it covers is in the comment above it.
import { test, expect } from '@playwright/test';
import { codeFor, signUpByApi } from './helpers.js';

// TC-ACC-09: nothing on the welcome page is wider than a phone screen (the page once grew to 958 px on 412 px).
test('NFR1 — the welcome page fits a phone screen', async ({ page }) => {
  await page.goto('/#/welcome');
  await expect(page.getByRole('button', { name: 'สมัครด้วยอีเมลสถานศึกษา' }).first()).toBeVisible();
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  expect(scrollWidth).toBe(clientWidth);
});

// TC-ACC-01/03/04, UI path: sign-up with an .ac.th email code, terms, profile.
test('F1 — sign up with an .ac.th email code through the UI', async ({ page }) => {
  const email = 'newcomer@lamduan.mfu.ac.th';
  await page.goto('/');
  await page.getByRole('button', { name: 'สมัครด้วยอีเมลสถานศึกษา' }).first().click();
  const sheet = page.locator('#auth-dialog');
  await sheet.getByLabel('อีเมลสถานศึกษา').fill(email);
  await sheet.getByRole('button', { name: 'ถัดไป' }).click();
  await sheet.getByLabel('รหัสยืนยัน').fill(await codeFor(page.request, email));
  await sheet.getByRole('button', { name: 'ยืนยัน', exact: true }).click();
  await sheet.locator('#auth-terms').check();
  await sheet.getByRole('button', { name: 'ยอมรับและดำเนินการต่อ' }).click();
  await sheet.getByLabel('ชื่อที่แสดง').fill('Newcomer');
  await sheet.locator('#auth-username').fill('newcomer_e2e');
  await sheet.getByRole('button', { name: 'เสร็จสิ้น' }).click();
  await expect(sheet).not.toBeVisible();
  await expect(page.getByText('E2E Badminton open').first()).toBeVisible();
});

// Going back to the email step and pressing ถัดไป again inside the 60-second resend wait leads on to the code step,
// where the code already sent still works (it used to stop on the email step with a rate-limit error).
test('F1 — asking again too soon still reaches the code step', async ({ page }) => {
  const email = 'again@lamduan.mfu.ac.th';
  await page.goto('/');
  await page.getByRole('button', { name: 'สมัครด้วยอีเมลสถานศึกษา' }).first().click();
  const sheet = page.locator('#auth-dialog');
  await sheet.getByLabel('อีเมลสถานศึกษา').fill(email);
  await sheet.getByRole('button', { name: 'ถัดไป' }).click();
  await sheet.getByRole('button', { name: 'ย้อนกลับไปแก้อีเมล' }).click();
  await sheet.getByRole('button', { name: 'ถัดไป' }).click();
  await expect(sheet.getByRole('alert')).toContainText('ใช้รหัสล่าสุดที่ได้รับ');
  await sheet.getByLabel('รหัสยืนยัน').fill(await codeFor(page.request, email));
  await sheet.getByRole('button', { name: 'ยืนยัน', exact: true }).click();
  await expect(sheet.locator('#auth-terms')).toBeVisible();
});

// TC-JOIN-07: user journey steps 1–5.
test('2.4 LR1 — core journey: filter, open an activity, join with consent', async ({ page }) => {
  await signUpByApi(page, 'joiner@lamduan.mfu.ac.th', 'joiner_e2e');
  await page.goto('/#/explore');
  await page.getByRole('radiogroup', { name: 'หมวด' }).locator('label', { hasText: 'กีฬา' }).click();
  await expect(page.getByText('E2E Study group')).toHaveCount(0);
  await page.locator('a.event-card', { hasText: 'E2E Badminton open' }).click();

  await page.getByRole('button', { name: 'เข้าร่วมกิจกรรม' }).click();
  const consent = page.locator('#participation-consent');
  await expect(consent).not.toBeChecked();
  await expect(page.locator('#join-confirm')).toBeDisabled();
  await expect(page.getByText('หลังเข้าร่วม: 2/6 คน รวมผู้จัด')).toBeVisible();
  await consent.check();
  await page.locator('#join-confirm').click();

  await expect(page.getByRole('heading', { name: /เข้าร่วมสำเร็จ/ })).toBeVisible();
  await expect(page.getByText('ตอนนี้มีผู้เข้าร่วม 2/6 คน', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'ดูรายละเอียดกิจกรรม' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'เข้าร่วมแล้ว' })).toBeVisible();
});

// TC-JOIN-02, UI side: a full activity offers no way to join.
test('2.4 — a full activity cannot be joined', async ({ page }) => {
  await signUpByApi(page, 'late@lamduan.mfu.ac.th', 'late_e2e');
  await page.goto('/#/explore');
  await page.locator('a.event-card', { hasText: 'E2E Badminton full' }).click();
  await expect(page.getByRole('button', { name: 'กิจกรรมเต็มแล้ว' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'เข้าร่วมกิจกรรม' })).toHaveCount(0);
});

// TC-POST-05, L2: the location consent is its own, unticked box.
test('LR1 — the location consent is separate and unticked when posting', async ({ page }) => {
  await signUpByApi(page, 'poster@lamduan.mfu.ac.th', 'poster_e2e');
  await page.goto('/');
  await page.getByRole('button', { name: 'สร้างโพสต์' }).first().click();
  const consent = page.locator('#location-consent');
  await expect(consent).toBeVisible();
  await expect(consent).not.toBeChecked();
});

// TC-FEED-04 and TC-POST-07, L2: a post survives a reload; delete asks first and cancel keeps it.
test('F2 F3 — delete asks first; cancel keeps the post, and it survives a reload', async ({ page }) => {
  await signUpByApi(page, 'writer@lamduan.mfu.ac.th', 'writer_e2e');
  const text = `E2E text post ${Date.now()}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'สร้างโพสต์' }).first().click();
  await page.locator('#create-form label', { hasText: 'ข้อความทั่วไป' }).click();
  await page.locator('#post-content').fill(text);
  await page.locator('#publish-button').click();
  await expect(page.getByText(text)).toBeVisible();

  await page.reload();
  const post = page.locator('article.post', { hasText: text });
  await expect(post).toBeVisible();

  await post.locator('[data-post-menu]').click();
  await page.getByRole('button', { name: 'ลบโพสต์' }).click();
  await expect(page.locator('#confirm-dialog')).toBeVisible();
  await page.locator('#confirm-dialog').getByRole('button', { name: 'ยกเลิก' }).click();
  await expect(page.locator('#confirm-dialog')).not.toBeVisible();
  await page.reload();
  await expect(page.locator('article.post', { hasText: text })).toBeVisible();
});
