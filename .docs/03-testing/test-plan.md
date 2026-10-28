# JoinGun — Test Plan (MVP 0.3.0)

| Item | Value |
| --- | --- |
| Status | **For team review and submission.** Revised against the course *Post-Midterm Plan* (2569): Test Plan due before Wed 28 Oct 2026, testing with real users on Wed 4 Nov 2026, final presentation on 11 or 18 Nov 2026. Targets and role assignments are still proposals until the Product Owner (scope, acceptance targets) and Tech Lead (tools, environment) confirm them. |
| Version | 0.2, 2026-10-28 (0.1 was 2026-10-27) |
| Build under test | 0.3.0 (web UI in `web/`, Express + PostgreSQL server in `server/`, Capacitor Android app in `android/`) |
| Plan owner | QA/Test (Parinya Chotchungtakul) — proposed |
| Method sources | Course deck *Post-Midterm Plan* (Test Plan contents, session format, metrics, schedule) and *From a spec to a working MVP* (CoffeeAI case, Layer 4 "Proven": every Must-have has a test that names its requirement, and a `test-report.md` maps each test to an acceptance criterion; what cannot be met yet is listed as a known gap instead of hidden). |
| AI use | Yes — see [§12 Use of AI](#12-use-of-ai). |
| Inputs | [Requirement spec](../01-requirements/01-spec/20260908-01-joingun.md), [legal traceability](../01-requirements/01-spec/20260908-02-legal-traceability.md), [backlog](../01-requirements/backlog.md), [user journey](../02-design/user-journey.md), [rule.md](../../rule.md), [DECISIONS.md](../../DECISIONS.md), [server README](../../server/README.md), `server/test/*.test.js` |

## 1. Purpose

This plan says how the team will show that JoinGun's MVP does what the spec asks, keeps the promises in `rule.md`, and actually helps students find activity partners. It covers two questions:

1. **Does it work as specified?** (verification) — automated tests, browser end-to-end checks, non-functional measurements and compliance checks, each traced to an F/NFR/LR ID, backlog item or `rule.md` provision.
2. **Is it useful and usable for real students?** (validation) — at least 10 moderated sessions with real students, comparing task results **before** (their current way: chat groups and social media) and **after** (JoinGun), plus SUS and TAM questionnaires.

## 2. Scope

### 2.1 Core workflow (MUST)

The locked MUST workflow is **"join an activity from the feed"** ([feature list](../02-design/feature-list.md), [user journey](../02-design/user-journey.md)): a signed-in student browses and filters the feed, opens an activity, sees where it meets, joins with the participation-history consent, and gets a reminder. Its requirements are F1 (sign-in), F2 (activity with map pin), F3 (feed and filters) and backlog 2.4 (join). The user sessions (§5) test only this workflow; everything else below is tested by the team at the system level.

### 2.2 In scope

| Area | Requirement IDs | Backlog | MoSCoW |
| --- | --- | --- | --- |
| **Core journey: join and leave an activity from the feed** | Scope workflow 4, LR1 (no F-ID, see §11) | 2.4 | **Must (core workflow)** |
| Sign-up and sign-in with an `.ac.th` email code, terms acceptance | F1, NFR3 | 1.1, 1.2, 8.1 | Must |
| Create, edit and delete activity posts with an optional map pin | F2, NFR2, LR1 | 2.1, 3.1 | Must |
| Feed, search, filters, activity details | F3, NFR1 | 2.2, 2.3, 7.1, 7.2 | Must |
| Reminders and notification settings (in-app, email, phone local notifications) | F4 | 4.1, 4.2 | Should |
| Activity-history privacy (default "only me" since 2026-10-28) | F5 | 7.3 | Should |
| Profile and account settings | Scope workflow 2 | 1.3, 7.3 | — (secondary) |
| Place search, navigation links, add to calendar | supports F2 | 3.2 | — (secondary) |
| Friends, report, block, moderation and appeal | rule.md (Computer Crime Act, ETA guidance) | 5.1–5.3 | — (secondary) |
| Points-based recommendations behind their own consent | F6, LR4, LR5 | 6.1–6.3 | Could |
| PDPA functions: consent records, data download, account deletion, encrypted fields, data minimisation | LR1, LR2, LR3, LR5, rule.md PDPA | 8.1, 8.2 | — (compliance) |
| Capacity and response time | NFR1, NFR4 | 8.2 | — |
| Android app (Capacitor) and phone browsers | NFR1, F4 | — | — |

### 2.3 Out of scope (not tested)

- F7 private chat (Won't), payments, permanent groups, points or rewards (Scope, proposal, DECISIONS.md #36).
- Server-sent push (Firebase), iOS app, whole-database encryption — not built (see `CLAUDE.md`). They are recorded as known gaps, not tested.
- Legal compliance. Tests show that a `rule.md` rule behaves as written; they do not prove the system is lawful.
- Load testing of third-party services (Gmail SMTP, OpenStreetMap tiles, Nominatim).

## 3. Test levels

The levels follow the Testing Pyramid from the course (Unit → Integration → E2E, then UAT with real users):

- **Unit / module level:** tests that call server modules directly — `profile-crypto.test.js` (field encryption) and the security and auth helpers used directly in `auth.test.js`. There are no isolated pure unit tests yet; this is the thinnest layer.
- **Integration:** most of the 47 tests in `server/test/` start the real Express app on a temporary PostgreSQL database (PGlite) and call the HTTP API, so they check validation, access control, records and transactions together.
- **E2E:** the real UI driving the real server (Playwright when approved; until then the same steps by hand).
- **UAT:** real students completing the core workflow (§5).

| Level | What it proves | Tool | Who (proposed) | Runs when | State on 2026-10-28 |
| --- | --- | --- | --- | --- | --- |
| L1 Unit and API integration | Server rules: validation, access control, consent and log records, transactions, encryption | `node:test` (`npm test`), 47 tests in `server/test/` | Tech Lead | Every push (GitHub Actions `.github/workflows/test.yml`) and before each UAT round | **47 pass, 0 fail, 0 skipped (run 2026-10-28, Node 22.21.0).** |
| L2 System / end-to-end (browser) | The real UI drives the real server: core journey, persistence after reload, delete-with-confirm, signed-out view | Playwright 1.64.0, Chromium with a Pixel 7 phone screen (`npm run test:e2e`, `tests/e2e/core-journey.spec.js`, own in-memory server `tests/e2e/server.js`) | QA/Test, Tech Lead | Every push (GitHub Actions job `e2e`) and before UAT round 1 | **Set up 2026-10-28 (approved by the Tech Lead). 6 tests, all pass after fixing the layout defect TC-ACC-09.** |
| L3 Non-functional | NFR1–NFR4, security headers, rate limits | `npm run perf`, Chrome DevTools, stopwatch, manual measurement | Tech Lead, QA | Once on the UAT environment; NFR4 again on a deployed host | `npm run perf` exists; no recorded results on a host. |
| L4 Compliance (rule.md) | Each applicable `rule.md` rule has evidence: records, fields, access limits, user-facing text | L1 tests + inspection checklist (§4.8) | QA, AI Lead (AI rules) | Before UAT round 1 | Partly covered by L1; inspection not done. |
| L5 Device and compatibility | Layout and reminders on real phones; Android app works | Android phones (≥2 models), Chrome on Android, Safari on iPhone (web) | QA | Before UAT round 1 | Android app has not been built or run on a device. |
| L6 User acceptance (UAT) | Real students can complete the core workflow; JoinGun beats their current way; SUS and TAM scores | Moderated sessions (§5–§6) | QA (moderator), Designer (note-taker), PO (sign-off) | Round 1 on 4 Nov, round 2 on 7–8 Nov; ≥10 sessions in total | Not started. |
| Regression | Fixes do not break earlier behaviour | L1 on CI + L2 core journey | Tech Lead, QA | After each fix batch between rounds | CI exists. |

## 4. Test cases

Each case names its requirement, as the method deck asks. **Steps / test data** says what to do and with which data; **Evidence** points to the existing automated test (file and test name) or says what still has to be done; **Result** is pass/fail with the date, or "Not run". Expected results also serve as the proposed acceptance criteria, because the spec and backlog have none yet (§11). L1 results below come from the `npm test` run on 2026-10-28.

### 4.1 Accounts (F1, NFR3; backlog 1.1–1.3, 8.1)

| ID | Requirement | Steps / test data | Expected result | Level | Evidence | Result |
| --- | --- | --- | --- | --- | --- | --- |
| TC-ACC-01 | F1 | Request a code with `student@mfu.ac.th`, `STUDENT@MFU.AC.TH`, `someone@gmail.com`, `x@ac.th.evil.com` | Only addresses ending in `.ac.th` (any case) get a code | L1 | auth.test.js — "only .ac.th addresses are accepted, case-insensitively" | Pass 2026-10-28 |
| TC-ACC-02 | F1 | Reuse a code; use an expired one; enter 5 wrong codes; resend within 60 s | Codes are single-use and expire; 5 wrong attempts lock; resends are rate-limited | L1 | auth.test.js — "codes are single-use, expire, lock after five wrong attempts…" | Pass 2026-10-28 |
| TC-ACC-03 | F1, rule.md PDPA + CCA | Sign up, sign in, sign out with a test `.ac.th` address | No plaintext email stored; terms record has `user_id`, timestamp, `ip_address`, `terms_version`; auth logs for login/logout have `user_id`, ISO-8601 UTC time, `source_ip`, `auth_status` | L1 | auth.test.js — "sign-up stores no plaintext email, records terms acceptance and auth logs…" | Pass 2026-10-28 |
| TC-ACC-04 | F1, rule.md CCA | New account; accept an old terms version; pick a username already taken | Terms must be accepted before a profile; old version refused (409); usernames unique | L1 | auth.test.js — "returning users sign straight in; new accounts must accept terms…" | Pass 2026-10-28 |
| TC-ACC-05 | rule.md CCA (renewed acceptance) | Bump `terms_version` in config, sign in with an existing account | User must review and accept the new version before continuing | L2 | Planned E2E / manual (not asserted for existing accounts in L1) | Not run |
| TC-ACC-06 | Security | Sign in; inspect the `jg_session` cookie | `HttpOnly`, `SameSite=Lax`, `Secure` when configured | L1 | auth.test.js — "session cookie is HttpOnly and SameSite=Lax…" | Pass 2026-10-28 |
| TC-ACC-07 | NFR3 | 10 real sign-up emails to at least 2 different `.ac.th` mail systems, timed from tapping "send code" to the message in the inbox | 10/10 arrive in the inbox (not spam) within 2 minutes | L3 | Manual, on the UAT environment with Gmail SMTP set. One real send recorded on 2026-10-14; not timed. | Not run |
| TC-ACC-08 | F1 | Make the mail service fail (test mailer that throws) | 503 with a plain message; log has no email address | L1 | auth.test.js — "a failed email send returns 503…" | Pass 2026-10-28 |
| TC-ACC-09 | F1, NFR1 (phone layout) | On a phone-size screen (Pixel 7, 412 px): welcome → "สมัครด้วยอีเมลสถานศึกษา" → email → code → terms → profile | Sign-up completes and the feed shows; nothing is wider than the screen | L2 | core-journey.spec.js — "F1 — sign up with an .ac.th email code through the UI" and "NFR1 — the welcome page fits a phone screen" | **Failed, then fixed; pass 2026-10-28.** The welcome page was 958 px wide on a 412 px screen, so the sign-up sheet was wider than the screen and "ถัดไป" could not be clicked (severity 3, §7). Cause: the `.visually-hidden` labels inside the sample cards are absolutely positioned and escaped the horizontal scroller `.welcome-art .collage`. Fix: `position: relative` on the scroller (`web/css/app.css`). |

### 4.2 Posting and maps (F2, NFR2, LR1; backlog 2.1, 3.1, 3.2)

| ID | Requirement | Steps / test data | Expected result | Level | Evidence | Result |
| --- | --- | --- | --- | --- | --- | --- |
| TC-POST-01 | F2, rule.md CCA | Create a text post and an activity post (title, future start time, location, capacity 8) | Both saved and returned; post-creation log has `user_id`, time, `ip_address`, action; IP never appears in the feed | L1 | posts.test.js — "text and activity posts round-trip…" | Pass 2026-10-28 |
| TC-POST-02 | F2 | Submit: missing title, past date, out-of-range coordinates, unknown fields | Nothing saved: no post, consent or log row | L1 | posts.test.js — "invalid requests do not create posts…" | Pass 2026-10-28 |
| TC-POST-03 | F2 | Force the audit write to fail | Post and activity rolled back together | L1 | posts.test.js — "failed audit write rolls back…" | Pass 2026-10-28 |
| TC-POST-04 | F2 | Capacity 1, 2, 50, 51 | Only 2–50 (host included) accepted | L1 | posts.test.js — "activity capacity is limited to 2–50…" | Pass 2026-10-28 |
| TC-POST-05 | LR1 | Open the create form, add a pin at the library entrance | Location-consent box is separate and **unticked**; post with pin is refused without it; a consent record is stored with it | L1 + L2 | L1: posts.test.js (consent rows). L2: core-journey.spec.js — "LR1 — the location consent is separate and unticked when posting" | L1 pass, L2 pass 2026-10-28 |
| TC-POST-06 | F2 | Author edits; another user tries; capacity lowered below the members already in | Author edit saved and logged, meeting-place consent asked again; others refused; capacity cannot go below people already in | L1 | account.test.js — two "editing" tests | Pass 2026-10-28 |
| TC-POST-07 | F2, method deck "delete must confirm" | Delete own activity; cancel the confirm dialog once, then confirm | Cancel deletes nothing; confirm hides the post, members still see it as cancelled and nobody can join | L1 + L2 | L1: account.test.js — "deleting a post hides it…". L2: core-journey.spec.js — "F2 F3 — delete asks first…" (cancel path) | L1 pass, L2 pass 2026-10-28 |
| TC-POST-08 | NFR2 | Pin 10 known campus points (coordinates taken from OpenStreetMap), save, reload the detail page | Stored and redisplayed pin is ≤ 10 m from the point selected (haversine distance), 10/10 | L3 | Manual measurement sheet | Not run |
| TC-POST-09 | 3.2, LR5 | Search "หอสมุด"; open "navigate" and "add to calendar" | Search request carries only the typed words; links open Google Maps / OpenStreetMap; `.ics` imports with the right time (Asia/Bangkok) | L2 | Manual with DevTools network view | Not run |

### 4.3 Feed and details (F3, NFR1; backlog 2.2, 2.3, 7.1, 7.2)

| ID | Requirement | Steps / test data | Expected result | Level | Evidence | Result |
| --- | --- | --- | --- | --- | --- | --- |
| TC-FEED-01 | F3 | Page through the feed while a new post arrives | No duplicates or skipped posts | L1 | posts.test.js — "feed pagination is stable…" | Pass 2026-10-28 |
| TC-FEED-02 | 7.2 | Filter by category `sport`, a Bangkok calendar day and search text "badminton" | Only matching posts, with correct totals | L1 | posts.test.js — "feed filters by category, Bangkok calendar day…" | Pass 2026-10-28 |
| TC-FEED-03 | F3, 2.4 | View the feed as the host, a member and another user | Everyone sees counts; only the viewer sees their own "joined" status | L1 | participation.test.js — "the feed shows counts to everyone…" | Pass 2026-10-28 |
| TC-FEED-04 | method deck "close the browser, reopen" | Create a post, close the browser (or restart the server), reopen | The post is still on top of the feed | L1 + L2 | L1: posts.test.js — "posts persist after closing and reopening the database". L2: core-journey.spec.js — "F2 F3 — … survives a reload" | L1 pass, L2 pass 2026-10-28 |
| TC-FEED-05 | F3 | Open web routes and private paths (`/data/`, `/.env`, `/server/`) | UI routes load; private paths are not served | L1 | posts.test.js — "web UI routes load, private paths stay hidden…" | Pass 2026-10-28 |
| TC-FEED-06 | NFR1 | Open the feed on a real phone on 4G/5G (and Chrome "Fast 4G" throttling), 5 cold loads | First cards visible within 2 s in at least 4 of 5 loads; median ≤ 2 s | L3 | Manual timing (screen recording); `npm run perf` for server-side p95 | Not run |

### 4.4 Core journey: joining and leaving (backlog 2.4, LR1)

| ID | Requirement | Steps / test data | Expected result | Level | Evidence | Result |
| --- | --- | --- | --- | --- | --- | --- |
| TC-JOIN-01 | 2.4, LR1 | First join to an activity with capacity 8 | Host is the first participant; join requires a one-time participation-history consent (unticked by default), stored with `user_id`, time, IP | L1 | participation.test.js — "the host is the first participant…" | Pass 2026-10-28 |
| TC-JOIN-02 | 2.4 | Two users race for the last place | Capacity counts the host; only one gets the place | L1 | participation.test.js — "capacity counts the host…" | Pass 2026-10-28 |
| TC-JOIN-03 | 2.4 | Leave, rejoin; host tries to leave | Leave and rejoin without new consent; host cannot leave | L1 | participation.test.js — "members can leave and rejoin…" | Pass 2026-10-28 |
| TC-JOIN-04 | rule.md PDPA | Non-member opens the participant list | Names visible only to host and members | L1 | participation.test.js — "participant names are visible only…" | Pass 2026-10-28 |
| TC-JOIN-05 | 2.4 | Join a started activity, a text post, an unknown id, or while signed out | All refused | L1 | participation.test.js — "started activities, text posts and unknown ids…" | Pass 2026-10-28 |
| TC-JOIN-06 | rule.md CCA | Join and leave | Each writes a log with `user_id`, exact time, `ip_address`, action type | L1 | participation.test.js (log assertions) | Pass 2026-10-28 |
| TC-JOIN-07 | User journey steps 1–5 | Seeded UAT data: Feed → filter `sport` → detail → "เข้าร่วมกิจกรรม" → tick consent → "ยืนยันเข้าร่วม" | "เข้าร่วมสำเร็จ" shows title, time, meeting point; detail shows "เข้าร่วมแล้ว" and the updated count | L2 | core-journey.spec.js — "2.4 LR1 — core journey: filter, open an activity, join with consent"; also "2.4 — a full activity cannot be joined" | Pass 2026-10-28 |

### 4.5 Safety, privacy and PDPA (LR2, LR3, LR5, rule.md; backlog 5.3, 7.3, 8.2)

| ID | Requirement | Steps / test data | Expected result | Level | Evidence | Result |
| --- | --- | --- | --- | --- | --- | --- |
| TC-SAFE-01 | rule.md CCA | Report a post with reason `spam`; send an empty or self report | Record has reporter, reported user, reason, time; bad reports refused | L1 | account.test.js — "reports are stored with reporter…" | Pass 2026-10-28 |
| TC-SAFE-02 | rule.md CCA | Block and unblock | Blocked author's posts hidden from the blocker only; record kept after unblock | L1 | account.test.js — "blocking hides the blocked author…" | Pass 2026-10-28 |
| TC-SAFE-03 | LR1 | Withdraw participation consent | Future joins need consent again; past history kept | L1 | account.test.js — "withdrawing the participation consent…" | Pass 2026-10-28 |
| TC-SAFE-04 | rule.md PDPA "Download My Data" | Download data with a chosen password; open with the right and a wrong password | AES-encrypted ZIP with JSON; opens only with the chosen password | L1 + manual | account.test.js. Manual: open in 7-Zip on Windows and a phone unzip app — not done yet. | L1 pass 2026-10-28; manual not run |
| TC-SAFE-05 | LR2, rule.md CCA | Delete account; run maintenance after 90 days (clock moved) | Hidden at once; encrypted email archived 90 days, then purged; friendships ended | L1 | account.test.js — "deleting an account hides it at once…"; social.test.js — "account deletion ends friendships…" | Pass 2026-10-28 |
| TC-SAFE-06 | rule.md PDPA (encryption) | Save year 2, interests sport, a bio; read the database file | Stored only as `*_enc` ciphertext; returned in clear to allowed viewers | L1 | profile-crypto.test.js (2 tests) | Pass 2026-10-28 |
| TC-SAFE-07 | LR5 | Inspect every form, API payload and table | No national ID, home address or religion field | L4 | Inspection checklist (§4.8) | Not run |
| TC-SAFE-08 | rule.md ETA (meeting strangers) | Open an activity detail and the join panel | Safety guidance shown; no wording that email verification or recommendations guarantee identity or safety | L2 | Manual / planned E2E text check | Not run |
| TC-SAFE-09 | rule.md ETA (human review) | Moderator dismisses, removes, suspends with a reason; user appeals | Reason shown to user; suspended user can still read, change settings, download data, delete account and appeal | L1 | social.test.js — "moderators review reports, suspend with a reason…" | Pass 2026-10-28 |
| TC-SAFE-10 | Security | Read response headers; check the DATABASE_URL setting | Security headers present; production requires DATABASE_URL (backups are the hosting provider's since 2026-10-29 and are not tested) | L1 | social.test.js — "security headers are set and the database setting is validated" | Pass 2026-10-29 (PGlite) |
| TC-SAFE-11 | Security | Send a write request with a foreign `Origin` | Refused | L1 | auth.test.js — "posting requires a signed-in account; foreign origins…" | Pass 2026-10-28 |

### 4.6 Access control (who can do what)

The method deck's rule of thumb: the "Cannot" column matters most, and it must be enforced at the server, not by hiding buttons. Because the L1 tests call the API directly, they already prove the server refuses these actions even if the UI is bypassed.

| Role | Can | Cannot | Test | Result |
| --- | --- | --- | --- | --- |
| Visitor (signed out) | Read public posts and public profile fields | Post, join, report, see year/interests, see participant names | TC-ACL-01: auth.test.js, participation.test.js (signed-out refused) | Pass 2026-10-28 |
| Student (signed in) | Post, join, leave, report, block, befriend, set privacy | Edit or delete others' posts; see participants of activities they are not in; see history hidden by F5 | TC-ACL-02: account.test.js (edit by others), participation.test.js, social.test.js (F5) | Pass 2026-10-28 |
| Host | Edit or cancel own activity, see participants | Leave own activity; reduce capacity below members | TC-ACL-03: participation.test.js, account.test.js | Pass 2026-10-28 |
| Blocked person | Use the app normally | Send friend requests to the blocker; be seen by the blocker | TC-ACL-04: social.test.js — "a block ends the friendship…" | Pass 2026-10-28 |
| Suspended user | Read, settings, download data, delete account, appeal | Post, join | TC-ACL-05: social.test.js (moderators test) | Pass 2026-10-28 |
| Moderator | Review reports, remove posts, suspend, lift on appeal | — (actions are logged) | TC-ACL-06: social.test.js — non-moderator gets 403 on `/api/mod/reports` | Pass 2026-10-28 |

### 4.7 Social, notifications, recommendations (F4, F5, F6, LR4; backlog 4.1, 4.2, 5.1, 5.2, 6.1–6.3)

| ID | Requirement | Steps / test data | Expected result | Level | Evidence | Result |
| --- | --- | --- | --- | --- | --- | --- |
| TC-SOC-01 | 5.1, 5.2, rule.md CCA | Send, accept, list, remove a friend | Each step logged with IP and notified | L1 | social.test.js — "friend requests: send, accept…" | Pass 2026-10-28 |
| TC-SOC-02 | F5 | New account (default), then set history to friends / only me / everyone | Default is only me; other users see history only as allowed | L1 | social.test.js — "activity history follows the owner privacy setting (F5)" | Pass 2026-10-28 |
| TC-NOT-01 | F4, 4.2 | Lead time 60 min; activity starting in 70 min; run the minute job | Reminder sent once at the chosen time; completed activities logged | L1 | social.test.js — "reminders follow each person settings…" | Pass 2026-10-28 |
| TC-NOT-02 | F4 | Join; edit; cancel | Host told about joins; members told about edits and cancels | L1 | social.test.js — "joining notifies the host…" | Pass 2026-10-28 |
| TC-NOT-03 | F4 | Android app: join an activity starting in 70 min with 60 min lead time, close the app | Phone notification appears about 60 min before start with the app closed | L5 | Manual on 2 Android phones — app not built yet | Not run |
| TC-AI-01 | F6, LR4, rule.md | Turn recommendations on with interest `sport` | Needs its own consent with an AI-limitations acknowledgement; each card labelled "แนะนำโดยระบบ AI" with every factor and its points; "less of this" feedback works | L1 + L2 | social.test.js — "recommendations need their own consent…"; planned E2E for the label and factors | L1 pass 2026-10-28; L2 not run |
| TC-AI-02 | LR5 | Watch network traffic while using recommendations | No request to an external LLM or third-party API with user data | L4 | Inspection of `server/recommend.js` + DevTools network log | Not run |
| TC-AI-03 | rule.md ETA (bias) | Run `npm run bias-report` on the anonymised UAT database | Report reviewed by the AI Lead; any group that gets clearly fewer recommendations is written down with a reason | L4 | — | Not run |

### 4.8 Non-functional and compliance inspection

| ID | Requirement | Steps / test data | Expected result | Level | Result |
| --- | --- | --- | --- | --- | --- |
| TC-NFR-04 | NFR4 | `npm run perf -- --url <host> --users 1000 --seconds 60` from a separate machine against the deployed host | p95 response ≤ 3 s, error rate < 1 % | L3 (on a laptop the result is indicative only; the real run waits for hosting, step 7) | Not run |
| TC-NFR-05 | Security | Exceed per-action limits (posts 30/h, joins 60/h) | 429 with a Thai message | L3 | Not run |
| TC-CMP-01 | rule.md, whole | Walk through every `rule.md` rule with the [legal traceability](../01-requirements/01-spec/20260908-02-legal-traceability.md) table: record the test ID, or "gap" | Every rule has a test ID or a listed gap | L4 | Not run |
| TC-DEV-01 | NFR1, layout | Core journey on 2 Android phones (app and Chrome) and 1 iPhone (Safari) | Journey completes; no clipped buttons; text readable at default font size | L5 | Not run |

## 5. User acceptance testing (UAT) with real users

### 5.1 Design

- **At least 10 completed sessions; plan for 12** (U01–U12) plus 2 reserves (U13–U14), so no-shows do not drop the count below 10. One pilot session (U00) with someone outside the sample is not counted.
- **Moderated, one participant per session, about 30–35 minutes**, in person on campus. A Moderator gives the tasks and a Note-taker times and records. The participant thinks aloud; the moderator says "we are testing the system, not you" and never helps or points. A task stuck past its time limit counts as failed.
- **Two rounds**, as the course deck suggests (test 5 → fix → test 5 more): Round 1 (U01–U06) on **Wed 4 Nov**, fix the serious problems, Round 2 (U07–U12) on 7–8 Nov. Problems found in Round 1 should not recur in Round 2.
- **Before vs after** is a within-subject comparison: each participant first does the core tasks **their current way** (a chat group, "before"), then **with JoinGun** ("after"), as the course deck asks (old way first, for the baseline time). The two conditions use different but equivalent scenarios (Set A: badminton for "before", Set B: futsal for "after") so participants do not remember answers. The fixed order is a limitation (§11).

### 5.2 Participants

| Criterion | Source |
| --- | --- |
| Enrolled student with an `.ac.th` email, **aged 20 or over** (the Thai age of majority, so participants can consent for themselves) | App accepts only `.ac.th` (F1); age decided by the Tech Lead on 2026-10-28 |
| Not taking 1305493 (no classmates) | Course deck *Post-Midterm Plan*: "recruit users from your real target group, not classmates" |
| Not a JoinGun team member | Course deck W5: users who are your own teammates do not count |

No quotas for year, faculty, phone type or activity habits (decision 2026-10-28, DECISIONS.md #38). Year and faculty are still asked in the pre-session questionnaire, only to describe the participants in the report.

Recruitment: posts in club and faculty groups, with a short screener that only checks the criteria above and books a time. Eligible applicants are booked in sign-up order (12 + 2 reserves) for 4 Nov and 7–8 Nov. The incentive, if any, is a team decision.

### 5.3 Ethics and personal data of participants

- Informed consent (PDPA) before each session: a participant information sheet and consent form in Thai giving the purpose, what is recorded, how long it is kept, and the right to stop at any time. Ask separately before recording audio or video.
- Participants are known only by code (U01…). Names, contact details and screener answers stay in a separate sign-up sheet that only QA can open.
- Record **screen video and voice only**: no faces and no photos of participants. This screen recording is the "photos or video of testing" evidence the *Post-Midterm Plan* deck asks for. Questionnaires collect no name or email.
- No raw recordings or identifiable notes go into the Git repository; only aggregated results go into `test-report.md`.
- **Deletion date.** The deck asks teams to keep consent forms, the raw Excel sheet and photos or video for the instructor to check. Names, contact details, screener answers, screen and audio recordings and signed consent forms are therefore kept until the instructor has checked them, then deleted by **31 Dec 2026** (31 ธ.ค. 2569), the same date written in the consent form (part A) and screener (part G) of [uat-materials-th.md](uat-materials-th.md). The raw Excel sheet holds no names or contact details and is not deleted.
- Until JoinGun runs on HTTPS (delivery step 7), participants **do not enter their own email or personal data**. They use test accounts prepared by the team on a team phone, and any sign-up task uses a team-controlled `.ac.th` test address (the moderator reads the code). Once HTTPS hosting is approved by the Tech Lead, participants may use their own email on their own phone. The UAT database is separate from any pilot database and is wiped after analysis.

### 5.4 Environment and test data

| Item | Plan |
| --- | --- |
| Server | Local server on a team laptop on the same Wi-Fi, opened from a team Android phone (hosting is not decided, step 7). If a deployed HTTPS host is ready before 4 Nov, it may be used instead. Which one was used is written in the report, because NFR1/NFR3 results differ. |
| Data | A UAT database with 12 activities over the next 7 days written by the team (categories, times, places, places left), created through the UI or `npm run seed` plus team posts. Never on the pilot database. |
| "Before" kit | A LINE OpenChat (or Facebook group) made by team accounts, containing the **same 12 activities** written as ordinary chat posts, plus some off-topic chatter, as students see today. The participant uses it on the team phone together with Google Maps and the phone calendar. |
| Recording | Screen recording on the phone, a stopwatch, and an observation sheet per task (success, time, errors, where stuck, key quotes). Results go into one Excel sheet, one row per user, the same day. |

### 5.5 Session script (about 30–35 minutes)

Follows the course deck's session format (intro 3', old way 5', tasks and think-aloud 10–15', questionnaires 3–6', interview 5'). The T1–T4 limits add up to 5 minutes per condition (§5.6), so the old-way block stays within 5 minutes, and the JoinGun block spends at most 5 minutes on T1–T4 and the rest on T5–T10.

| Time | Step |
| --- | --- |
| 0–3 | Intro and consent: "we are testing the system, not you"; information sheet, consent form, recording permission |
| 3–8 | Old way (baseline): tasks T1–T4 with the "before" kit (Set A) |
| 8–23 | Tasks with JoinGun and think-aloud: T1–T4 (Set B); then T5–T10 only if time allows |
| 23–29 | Questionnaires: SUS immediately after the tasks, then TAM |
| 29–34 | Interview, 3 questions: What did you like? Where did you get stuck? Would you keep using it, and why? |

A short pre-session questionnaire (year, faculty, current ways to find activity partners, how often it fails) is filled in when the user books, not during the session.

### 5.6 UAT tasks

Time limits are for scoring only; the participant is not told. A task is **successful** when the success criterion is met without help. Tasks are written as scenarios, not button instructions.

**Required tasks T1–T4 (core workflow; before = chat group, after = JoinGun)**

| Task | Scenario given to the participant (Set A shown) | Success criterion | Limit | Traces to |
| --- | --- | --- | --- | --- |
| T1 Find | "You want to play badminton this Saturday after 17:00. Find a game that still has places." | Correct activity identified | 2 min | F3, 7.2, pain "missed opportunities" |
| T2 Join | "Join that game and tell me how many places are left after you." | Before: message sent to the organiser and correct count stated. After: joined (status "เข้าร่วมแล้ว") and correct count stated | 1 min | 2.4, LR1, pain "difficult coordination" |
| T3 Locate | "Show me exactly where you will meet and how you would get there." | Meeting point shown on a map and a route opened | 1 min | F2, 3.1, 3.2, pain "can't find meeting location" |
| T4 Remember | "Make sure you will be reminded one hour before it starts." | A reminder for the right time is set (JoinGun reminder setting or calendar entry) | 1 min | F4, 4.1, 4.2 |

The T1–T4 limits total 5 minutes and are the same in both conditions, matching the deck's 5-minute old-way block. The short limits may cause more timeouts in the "before" condition, so timeouts are counted per condition and noted as a limitation in the report (§11).

**Optional tasks T5–T10 (JoinGun only; only if time allows, not counted in the targets)**

These features are covered by the team's system tests (§4); in a session they add usability notes only.

| Task | Scenario | Success criterion | Limit | Traces to |
| --- | --- | --- | --- | --- |
| T5 Sign up | "Create an account with this university email." | Signed in with terms accepted and a profile name | 4 min | F1, 1.1–1.3 |
| T6 Host | "Post a study group for tomorrow 13:00, 4 people, and pin the library entrance on the map." | Post appears in the feed with correct time, capacity and pin; location consent given knowingly | 4 min | F2, 2.1, 3.1, LR1 |
| T7 Privacy | "Make it so only your friends can see which activities you joined." | History visibility set to friends only (the default is only me) | 2 min | F5, 7.3 |
| T8 Safety | "A post looks like a scam. Report it, then make sure you never see this person's posts." | Report sent with a reason and author blocked | 3 min | 5.3, rule.md |
| T9 Recommendations | "Turn on recommendations and tell me why the first one was suggested to you." | Consent given; participant states at least one factor shown on the card | 3 min | F6, LR4 |
| T10 Your data | "Download a copy of your data." | ZIP downloaded with a password chosen | 3 min | rule.md PDPA |

If T9 is done, also ask: "Who made this suggestion?" — the answer should mention the AI/points label (checks LR4 understanding).

## 6. Metrics

### 6.1 Task results, before and after (required)

Measured per participant and task:

| Metric | How | Reported as |
| --- | --- | --- |
| Task success | Success / failure (assisted or over the limit = failure) | Success rate per task and condition, with a 95 % adjusted-Wald interval |
| Time on task | From the end of reading the scenario to the success criterion (successful tasks only) | Mean and median per condition; before vs after time; % change |
| Errors | Wrong paths, wrong activity chosen, wrong count or time | Mean per task per condition |
| Single Ease Question (SEQ) | "Overall, this task was…" 1 (very difficult) – 7 (very easy) | Median per task per condition |

Analysis of before vs after (T1–T4): paired differences per participant; Wilcoxon signed-rank test on time on task and SEQ (n ≥ 10); success compared descriptively (and McNemar's test if n allows). With about 12 people the results are a signal, not proof; the report says so.

Round 1 vs Round 2: for each Round 1 problem that was fixed, compare its occurrence and the affected task's success in Round 2 (descriptive only, different people).

### 6.2 SUS (System Usability Scale, optional in the course; used)

The standard 10-item SUS (Brooke, 1996), 5-point scale from strongly disagree (1) to strongly agree (5), in a Thai translation prepared by the team (translated, then back-translated by a second team member, then checked in the pilot session). Given immediately after the tasks, about JoinGun only.

1. I think that I would like to use this system frequently.
2. I found the system unnecessarily complex.
3. I thought the system was easy to use.
4. I think that I would need the support of a technical person to be able to use this system.
5. I found the various functions in this system were well integrated.
6. I thought there was too much inconsistency in this system.
7. I would imagine that most people would learn to use this system very quickly.
8. I found the system very cumbersome to use.
9. I felt very confident using the system.
10. I needed to learn a lot of things before I could get going with this system.

Scoring: odd items (score − 1), even items (5 − score), sum × 2.5 = 0–100 per user. Report the mean and SD across users and the grade against the average of 68 (Sauro & Lewis: ≥ 80.8 = A, < 51.7 = F). SUS is not a percentage.

### 6.3 TAM (Technology Acceptance Model, optional in the course; used)

**Choice: TAM, not UTAUT2.** UTAUT2's Habit and Price Value cannot be measured meaningfully in one session of a free app, and its ~28 items would add fatigue. TAM's three core constructs answer the question this test asks: is JoinGun useful, easy, and would students use it. UTAUT2 can be reconsidered for a multi-week field pilot (delivery step 8). This choice is for the QA lead and Product Owner to confirm.

Items adapted from Davis (1989) for JoinGun, 5-point scale (1 strongly disagree – 5 strongly agree), Thai translation as for SUS, given after the SUS:

| Construct | Item |
| --- | --- |
| Perceived usefulness (PU) | PU1 Using JoinGun would help me find people to do activities with more quickly. |
| | PU2 Using JoinGun would make agreeing on a time and meeting place easier. |
| | PU3 Using JoinGun would increase my chances of joining activities I am interested in. |
| | PU4 Overall, I find JoinGun useful for finding activity partners. |
| Perceived ease of use (PEOU) | PEOU1 Learning to use JoinGun is easy for me. |
| | PEOU2 It is easy to get JoinGun to do what I want. |
| | PEOU3 My interaction with JoinGun is clear and understandable. |
| | PEOU4 Overall, I find JoinGun easy to use. |
| Behavioural intention (BI) | BI1 If JoinGun were available at my university, I would use it. |
| | BI2 I would use JoinGun to find activity partners in the next month. |
| | BI3 I would recommend JoinGun to my friends. |
| Optional extension: perceived safety (not part of standard TAM; reported separately) | SAFE1 I would feel comfortable meeting someone I found through JoinGun. |
| | SAFE2 JoinGun makes clear what email verification does and does not guarantee. |

Report the mean ± SD per construct. Cronbach's alpha per construct is supporting information only (unstable at n ≈ 12). No causal claims between PU, PEOU and BI; the sample is too small for a structural model.

### 6.4 Targets (proposed — Product Owner to confirm)

| Metric | Target |
| --- | --- |
| Core tasks T1–T3 success rate with JoinGun | ≥ 80 % each |
| Time on T1–T3 with JoinGun vs before | Mean at least 30 % lower |
| SEQ for T1–T4 with JoinGun | Median ≥ 5 and not lower than before |
| SUS | Mean ≥ 68; aim ≥ 75 |
| TAM PU, PEOU, BI | Construct mean ≥ 3.5 of 5 |
| Problems | No open severity-4 problem at exit |

## 7. Defects and usability problems

Severity follows Nielsen's 0–4 scale, as the course deck asks:

| Severity | Meaning | Rule |
| --- | --- | --- |
| 4 Catastrophe | Blocks the core journey, loses data, leaks personal data, or breaks a `rule.md` record | Must fix before release; stop UAT until fixed |
| 3 Major | Task fails or needs help for ≥ 2 participants; wrong data shown | Fix before Round 2 |
| 2 Minor | Slows people down or confuses, workaround exists | Fix if time allows |
| 1 Cosmetic | Wording, alignment | Backlog |
| 0 Not a problem | Observed but not a usability problem | Note only |

Each problem is filed as a GitHub issue with: test case or task ID, steps, expected vs actual, severity, participant codes affected (no names), screenshot without personal data. The Product Owner decides which severity-3 and severity-2 items are fixed between rounds; architecture changes go to the Tech Lead.

## 8. Entry, suspension and exit criteria

**Entry to UAT Round 1 (4 Nov)**

- `npm test` green on CI for the build under test; core journey (TC-JOIN-07) passes in E2E or by hand.
- No open severity-4 problem; NFR and compliance checks in §4.8 run and recorded (pass or listed gap).
- UAT environment chosen (§5.4) and seeded; Android app installed on the team phones, or the web is used and this is recorded.
- Thai SUS, TAM, consent form and observation sheet checked in the pilot session (U00).
- Product Owner has confirmed the targets in §6.4.

**Suspend** a session or round if a severity-4 problem appears, if a participant's personal data is exposed, or if the server is unavailable for more than 15 minutes. Resume after the fix and a regression run.

**Exit**

- At least 10 completed sessions analysed (a session counts if T1–T4 in both conditions and the SUS/TAM are complete).
- No open severity-4 problem; severity-3 problems fixed or accepted in writing by the Product Owner.
- `test-report.md` written (§10) and reviewed by the team; the Product Owner signs off UAT.

## 9. Schedule

Dates follow the course *Post-Midterm Plan*. The final presentation is on 11 Nov (teams 1–10) or 18 Nov (teams 11–20); the schedule finishes the report before 11 Nov so it works for either date.

| Phase | Dates (2026) | Work | Owner (proposed) | Output |
| --- | --- | --- | --- | --- |
| 0. Review and submit | Wed 28 Oct | Team reviews this plan and the AI-drafted parts (§12); submit the Test Plan (one per team) | QA, PO, Tech Lead | Submitted plan |
| 1. Preparation | Thu 29 Oct – Tue 3 Nov | Thai SUS/TAM/consent, observation sheet, "before" kit, UAT data; recruit 12 + 2 and book times; Tech Lead decides Playwright and the UAT environment. Sat 31 Oct is the guest lecture (E4614). | QA, Designer, Tech Lead | Materials and participant timetable |
| 2. System testing | Thu 29 Oct – Tue 3 Nov | L1 on CI, L2 core journey (E2E or by hand), NFR checks, access control, compliance walk-through, Android build on 2 phones, bias report on test data | Tech Lead, QA, AI Lead | Results in the test log |
| 3. Pilot session | Mon 2 Nov | U00 session; fix the script and timings | QA | Final script |
| 4. UAT Round 1 | **Wed 4 Nov** | U01–U06 (the course testing day) | QA (moderator), Designer (note-taker) | Session data, Excel sheet |
| 5. Fix and regression | Thu 5 Nov – Fri 6 Nov | Triage, fix severity 4 and 3, `npm test` + core journey again | Tech Lead, PO | Fixed build |
| 6. UAT Round 2 | Sat 7 Nov – Sun 8 Nov | U07–U12 (and reserves if fewer than 10 complete) | QA, Designer | Session data, Excel sheet |
| 7. Analysis and report | Mon 9 Nov – Tue 10 Nov | Metrics, before/after comparison, SUS/TAM, `test-report.md`, P3 and P4 for the portfolio; PO sign-off | QA, PO | Test report, P3, P4 |
| 8. Final presentation | Wed 11 or 18 Nov | Present the results (teams 1–10 on 11 Nov, 11–20 on 18 Nov) | Whole team | Presentation |

Dependencies: real-email sign-up by participants and the final NFR1/NFR3/NFR4 numbers need a deployed HTTPS host (delivery step 7). Hosting is not decided, so UAT uses the local fallback in §5.4 and the NFR runs on a host are repeated later.

## 10. Deliverables

| File | Content | When |
| --- | --- | --- |
| `.docs/03-testing/test-plan.md` | This plan | 28 Oct |
| `.docs/03-testing/test-report.md` | Per test case: what it checks, pass/fail, date run, environment, the acceptance criterion it maps to; NFR measurements; UAT results (before/after, SUS, TAM), problems found and fixed; known gaps | 10 Nov |
| P3 User Evidence Log (portfolio) | Who was tested with (U-codes, year, faculty), when, and what was found; links to the evidence below | 10 Nov |
| P4 Impact Metrics (portfolio) | Before/after task results, SUS, TAM; plus one metric on AI's impact on the team's SDLC | 10 Nov |
| Raw evidence (outside Git if it contains personal data) | Signed consent forms, the raw Excel sheet (one row per user), observation sheets, interview notes, screen and audio recordings taken with permission | Kept for the instructor to check, then identifiable items deleted by 31 Dec 2026 (§5.3) |
| UAT materials | Consent form, screener, observation sheet, SUS/TAM forms, "before" kit description ([uat-materials-th.md](uat-materials-th.md)) | Phase 1 |
| `tests/e2e/*.spec.js` | Playwright tests, each title starting with its requirement ID (e.g. `2.4 LR1 — core journey…`) | Exists since 2026-10-28 (6 tests) |

## 11. Risks, gaps and assumptions

| Item | Effect | Handling |
| --- | --- | --- |
| The spec and backlog have **no acceptance criteria** and no Pain IDs | Pass/fail is defined by this plan's expected results | PO confirms §4 expected results and §6.4 targets as the acceptance criteria |
| Joining/leaving has **no F-ID** (backlog 2.4 only) | The core journey traces to the backlog and user journey, not a requirement | Listed as a gap; PO may add a requirement |
| Hosting not decided (step 7) | NFR1, NFR3, NFR4 final numbers and real-email UAT wait | Local fallback; repeat on a host |
| Android app never built on a device | TC-NOT-03 and app sessions may fail | Build in phase 2; if it fails, UAT runs on the phone browser and this is recorded |
| F4 has no server-sent push | Reminders reach a closed app only through phone-scheduled notifications | Tested as built; push listed as a known gap |
| Short preparation (29 Oct – 3 Nov) for a 4 Nov round | Recruitment or materials may not be ready | Book users from 28 Oct; pilot on 2 Nov; Round 2 on 7–8 Nov can absorb no-shows |
| Small sample (10–12) | Statistics are indicative | Report means, medians, intervals and qualitative findings together |
| Short time limits (T1–T4 total 5 min, per the deck) | "Before" tasks may time out more than in real life, overstating the before/after difference | Same limits in both conditions; timeouts reported per condition; limits checked in the pilot session (U00) |
| Fixed order: old way first, then JoinGun | Learning effect may make JoinGun look faster | Two equivalent scenario sets; noted as a limitation in the report |
| "Before" kit is staged, not the participant's own groups | Baseline may be easier or harder than real life | Pre-session questionnaire on real habits; noted as a limitation |
| Moderator is a team member | Bias towards JoinGun | Fixed script, no hints, a second person takes notes |
| Gmail limit of 500 messages a day | Many sign-ups in one day could fail | Test accounts in the local fallback |
| `npm audit` issues (DECISIONS.md #33) | Possible security weakness during UAT | Tech Lead decides whether to update before UAT |

## 12. Use of AI

The course allows AI to draft test cases, as long as the team reviews every case and the plan says where AI was used.

| What | AI involvement |
| --- | --- |
| Version 0.2 of this plan (2026-10-28) | Revised by Claude Code (an AI coding agent) from the course *Post-Midterm Plan* slides and version 0.1: schedule, session format, task list, severity scale, Testing Pyramid mapping, Result column and this section |
| Version 0.1 (2026-10-27) | _Team to state whether and how AI was used_ |
| Test cases in §4 | Drafted from the spec, backlog and the existing automated tests; the L1 results come from a real `npm test` run, not from AI |
| UAT tasks, scenarios and the TAM items | Drafted with AI; TAM items adapted from Davis (1989); SUS items are the standard wording (Brooke, 1996) |
| Test results | **Not produced by AI.** Every session and result must come from real people; nothing is filled in before it happens |

Team review of the AI-drafted parts (fill in before submission):

| Section | Reviewed by | Date | Changes made |
| --- | --- | --- | --- |
| §2 Scope | | | |
| §4 Test cases | | | |
| §5 UAT design, participants, tasks | | | |
| §6 Metrics and targets | | | |
| §9 Schedule | | | |
