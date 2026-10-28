# JoinGun Posting MVP

Scope authorized on 2026-10-07: create **text posts** and **activity posts**, and read them in a newest-first feed. Node.js + Express + PostgreSQL (Render; SQLite until 2026-10-29, Railway planned on 2026-10-29 but never deployed). The UI lives in `web/` and is served by Express at `/`. `.docs/02-design/prototype/` is kept only as the design reference and is no longer served.

## Run

Requires Node.js 22.13 or newer.

```sh
npm ci
npm start
```

Open `http://127.0.0.1:3000`. With no `DATABASE_URL` the server uses a local PGlite database (PostgreSQL in WebAssembly) in `data/pglite/` and creates its tables automatically; with `DATABASE_URL` set it uses that PostgreSQL database. Posts survive server restarts. Use `npm run dev` for automatic restarts and `npm test` for integration tests (PGlite, in memory). Run commands from the repository root.

Environment variables: see [`.env.example`](../.env.example) and "Accounts and sign-in" below. `PORT` (default 3000), `HOST` (default 127.0.0.1) and `DATABASE_URL` (`postgres://…`; required when `NODE_ENV=production`). TLS to the database is on unless the host is local or has no dot (Render's internal database address); `DATABASE_SSL=false` or `true` overrides. Database files and dependencies are excluded from Git.

### Deploy on Render

1. On Render choose **New → Blueprint** and pick this repository. `render.yaml` creates the web service `joingun` and the PostgreSQL 17 database `joingun-db`, both in Singapore, and links `DATABASE_URL` to the database's internal URL. The database accepts no connections from the internet (`ipAllowList: []`).
2. Render generates `APP_SECRET` once (never change it afterwards) and sets `NODE_ENV=production`, `HOST=0.0.0.0`, `TRUST_PROXY=true` and `PORT`. Fill `GMAIL_USER`, `GMAIL_APP_PASSWORD` and optionally `MODERATOR_EMAILS` when the Blueprint asks.
3. The service builds with `npm ci` (no dev dependencies, since `NODE_ENV=production`), starts with `npm start` and checks `/api/health` (which queries the database). Tables are created on first start.
4. Run one instance: rate limits and the minute and daily jobs live in the process.
5. Point the Android app's `server.url` in `capacitor.config.json` at the `…onrender.com` address, then `npm run cap:sync`.
6. Free plans (chosen for the first test): the web service sleeps after about 15 idle minutes, so reminders and the daily purge run only while it is awake, and the first request after sleep is slow; the free database expires about 30 days after creation and has no backups. Check Render's current pricing page before relying on these numbers, and move to paid plans before the pilot.

## API

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/health` | Server/database readiness |
| POST | `/api/posts` | Create a post; 201 with the saved record and Location header |
| GET | `/api/posts?limit=20&before=123&category=sport&date=2026-10-20&q=badminton` | `{items, nextCursor, total}`; maximum 100 items; omit before for the first page. Optional filters: `category` (`all`, `text`, `sport`, `study`, `cafe`), `date` (a calendar day in Asia/Bangkok; activities match on start time, text posts on creation time) and `q` (up to 100 characters, matched in content, title, location and meeting details). `total` counts every post that matches the filters |
| GET | `/api/posts/:id` | One post, or 404. Deleted posts and posts by deleted accounts return 404, except a cancelled activity stays readable to its host and members |
| PUT | `/api/posts/:id` | Edit your own post (same body as POST); see "Editing, reports and blocks" |
| DELETE | `/api/posts/:id` | Delete your own post; 204 |

Requests use `Content-Type: application/json`. Unknown properties are rejected. Errors use `{ "error": "message" }` with 400 for validation/JSON, 413 for bodies above 32kb, 415 for unsupported content type, and 500 for database errors without internal details.

Text post:

```json
{"type":"text","content":"Anyone studying at the library today?"}
```

Activity post (replace the example timestamp with a future date):

```json
{
  "type": "activity",
  "content": "Beginners welcome. Bring a racket and water.",
  "activity": {
    "title": "Badminton after class",
    "startsAt": "2099-10-08T17:00:00+07:00",
    "location": "Campus sports hall entrance",
    "capacity": 8
  },
  "locationConsent": true
}
```

Optional activity fields: `category` (`sport`, `study`, `cafe`; default `sport`), `meeting` (1–1000 characters when supplied), and numeric `lat`/`lng` (must be supplied together within geographic bounds).
Content: 1–5000 characters. Activity title: 1–120; location: 1–300; capacity: integer 2–50 including the host (posts saved earlier with a larger capacity remain readable). Activity timestamps must be future ISO timestamps with a timezone and are stored as UTC. The web form interprets the selected time as Asia/Bangkok and displays timestamps in that timezone. Text posts cannot include activity fields or location consent.

## Database

- `posts`: stable UUID, ordering sequence, demo author ID, type, content and UTC creation time.
- `activities`: activity details in a one-to-one relationship with a post.
- `consent_records`: activity location opt-in, post ID, demo user ID, timestamp, source IP and `location-v1` notice version.
- `audit_logs`: post create, update and delete, activity join and leave, consent withdrawal, data export and account deletion, with actor, source IP and timestamp. Audit rows are never deleted.

Post, activity, consent and audit inserts are one transaction. Foreign keys, checks, prepared statements and cursor pagination protect data integrity. Audit and consent records are not exposed by the feed API. The server serves static files only from `web/` (dotfiles ignored), never the database, `.docs`, `server/` or other repository files.

## MVP boundaries

This is a **pilot build** for a small group test, bound to `127.0.0.1` by default. Accounts use email-code sign-in (see below); posting needs a finished account and is recorded under that user. Do not expose it publicly or collect real personal data until hosting, HTTPS and the remaining compliance work are in place. No passwords, likes, comments, media uploads or chat are included; notifications, friends and recommendations are described in "Pilot build additions" below.

Meeting locations require a separate explicit opt-in on each activity post under the existing project rules; GPS is not collected. The app stores plain text posts and escapes all user content before placing it in HTML. Map markers do not render user HTML. The database is not encrypted. Whole-database encryption, a moderator review screen, backups and other production compliance work remain outstanding; the demo audit actor is not proof of a real user's identity. This implementation does not claim complete compliance with `rule.md` or the earlier production NFRs.

## Verification

`npm test` uses real HTTP requests to Express and in-memory PGlite databases (real PostgreSQL SQL, not the Render server itself). Tests cover both post types, persistence after reopening, consent validation, malformed requests, field limits, SQL-like input, pagination under new inserts, private-file access and transactional rollback. Tests also cover `web/` routes and hidden private paths, optional map/category fields, SQL-side category/date/search filters with totals and the 2–50 capacity limit. Since the move to PostgreSQL (2026-10-29) the suite has been ported but its result on that engine is recorded in the project log, not here; a smoke test on a Render deploy is still needed. Real mobile devices have not been verified.

`npm run test:e2e` (Playwright, added 2026-10-28) drives the real UI in Chromium on a phone-size screen against `tests/e2e/server.js`, a separate server with an in-memory database and seed activities that never opens `data/`. First run: `npx playwright install chromium`. It covers the core journey (filter, open, join with consent), a full activity, the unticked location consent, reload persistence and delete-with-confirm (cancel), sign-up through the UI, and that the welcome page fits a phone screen. On 2026-10-28 all 6 pass, after fixing the welcome page that was wider than a phone screen (test plan TC-ACC-09).

Implementation references: [Express API](https://expressjs.com/en/api/), [node-postgres](https://node-postgres.com/) and [PGlite](https://pglite.dev/).

## Web UI (`web/`)

Start Express and open `http://127.0.0.1:3000`. Plain ES modules, no build step. Phone-app layout on every screen size (see "Mobile layout" below): one 480px column, an app bar per page and a bottom tab bar (home, explore, create, notifications, menu). Light and dark themes follow the device setting. Tokens live in `web/css/tokens.css` (design-system values plus shell tokens), styles in `web/css/app.css`.

Modules in `web/js/`: `main.js` (hash router, pull to refresh), `shell.js` (tab bar, badges, browser notifications), `menu.js` (เมนู tab), `native.js` (Android app features), `feed.js` (home tabs ล่าสุด / สำหรับคุณ / เพื่อน, explore), `posts.js` (post rows and the activity event card), `detail.js` (activity page, join and leave, calendar file, map and directions), `create.js` and `map.js` (composer, pin, place search), `profile.js`, `friends.js`, `notifications.js`, `activities.js` (my activities), `settings.js`, `mod.js`, `auth-ui.js` and `auth.js` (welcome page, sign-up sheet, policies), `post-actions.js` (the ⋯ menu), `api.js`, `dom.js`, `format.js`, `icons.js`.

Routes: `#/welcome`, `#/` (home), `#/menu`, `#/explore?q=`, `#/activity/<id>`, `#/u/<username>`, `#/notifications`, `#/friends?tab=friends|requests|sent|find`, `#/activities`, `#/settings#<section>`, `#/mod`, `#/terms`, `#/privacy`, `#/safety`.

Activity cards keep the design-system order (title, category, date and time, place, places taken, "ดูรายละเอียด") inside a Facebook-style event card with a category banner and a date badge; joining happens only on the detail page. Leaflet loads from unpkg and tiles from OpenStreetMap; place search calls OpenStreetMap Nominatim from the browser with only the typed words. Without them the form and detail page fall back to text. Fonts use the system font (Noto Sans Thai is not bundled).

## Accounts and sign-in

Passwordless sign-in with a 6-digit code sent by email through Gmail SMTP with an [App Password](https://support.google.com/accounts/answer/185833), using [Nodemailer](https://nodemailer.com/guides/using-gmail). Only addresses ending in `ALLOWED_EMAIL_SUFFIX` (default `ac.th`, Thai educational institutions) are accepted. Creating a post requires a finished account; reading the feed does not. Requirements: F1, NFR3, LR3, LR5 and the `rule.md` provisions on terms acceptance records and login/logout logs.

Configuration comes from environment variables or a `.env` file in the repository root (see [`.env.example`](../.env.example)). Without `APP_SECRET`, development generates one in `data/dev-secret.txt`. Without `GMAIL_USER` and `GMAIL_APP_PASSWORD`, development prints each code to the server console instead of emailing it. `NODE_ENV=production` refuses to start without all three and marks the session cookie `Secure`.

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| POST | `/api/auth/request-code` | `{email}` | 202 `{resendAfter: 60, expiresInMinutes: 10}` (seconds until another code may be requested; minutes the code stays valid), the same whether or not an account exists. 400 `{error, field: "email"}` for a non-`.ac.th` address; 429 when asked again within 60 seconds, more than 5 times an hour per address or 20 an hour per IP; 503 if Gmail refuses or cannot be reached. |
| POST | `/api/auth/verify` | `{email, code}` | Sets the `jg_session` cookie (HttpOnly, SameSite=Lax, 30 days). `{status: "signed-in", user}`, `{status: "needs-terms"}` or `{status: "needs-profile"}`. 400 `{error, field: "code"}` on a wrong, expired or locked code. |
| POST | `/api/auth/terms` | `{termsVersion, privacyVersion}` | 204 and an acceptance record. 409 if the versions are not the current ones. Needs a session. |
| GET | `/api/me` | — | `{id, displayName, username, year, interests, needs}` where `needs` is `"terms"`, `"profile"` or null. 401 without a session. |
| PUT | `/api/me` | `{displayName, username, year?, interests?}` | The user. 403 before terms; 409 `{field: "username"}` when taken. Display name 1–50 characters; username `^[a-z0-9_]{3,20}$` (stored lowercase); year `1`–`4`, `other` or null; interests from `sport`, `study`, `cafe`. Unknown fields are rejected. |
| POST | `/api/auth/logout` | — | 204; deletes the session and clears the cookie. |

Auth error messages are Thai because the UI shows them directly. Codes expire after 10 minutes, are single-use and lock after 5 wrong attempts. State-changing API calls must be JSON, and a request whose `Origin` is another site is refused (403).

Tables: `users` (profile and status), `user_emails` (HMAC-SHA256 lookup hash and an AES-256-GCM encrypted copy for account recovery; the email is never stored in plain text or next to posts), `login_codes` (hashed codes), `sessions` (SHA-256 of the token), `terms_acceptances` (user, both versions, UTC time, IP; insert-only) and `auth_logs` (code requests, sign-up, login success and failure, terms, profile and logout with `user_id` when known, UTC time, source IP and outcome; not pruned). Keys are derived from `APP_SECRET` with HKDF, one per purpose. Posts created before accounts existed still show as Demo Student.

Not done yet: encryption of the whole database file, Google sign-in (the UI button stays hidden), and rate limits shared across several server processes (the current counters are in memory). Gmail sending is tested with a substitute transport that checks the settings and message; a real send must be checked with a real App Password. Personal Gmail allows about 500 recipients per 24 hours, may block sign-ins from servers in unexpected countries (approve them under the account's Recent activity), and is not meant for high-volume automated mail; move to a provider with your own domain if usage grows.

## Joining activities

Backlog 2.4 and user journey steps 3–5. The host is the first participant, so an activity with capacity 8 has 7 places for others. Posts include `activity.joinedCount` and `activity.viewerStatus` (`"host"`, `"joined"` or null for the signed-in viewer; null when signed out).

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| POST | `/api/activities/:id/join` | `{}` or `{participationConsent: true}` | The updated post. The first join needs `participationConsent: true` (409 `code: "consent-required"` otherwise); after that the consent is remembered. 409 `full` or `started`; 404 for unknown ids and text posts. Joining twice changes nothing. |
| POST | `/api/activities/:id/leave` | — | The updated post. Allowed until the start time; 409 `host` (the host cannot leave), `not-joined` or `started`. |
| GET | `/api/activities/:id/participants` | — | `{items: [{role, displayName, username}]}`, host first. Only the host and current members may see it (403 otherwise); no email addresses. |

All three need a finished account (401/403 otherwise). The place check and the insert run in one `BEGIN IMMEDIATE` transaction, so two people cannot take the last place. Each join and leave writes `audit_logs` (`activity.join`, `activity.leave`) with user, UTC time and IP. The participation-history consent (`participation-history`, version `participation-v1`) is stored in the insert-only `user_consents` table with user, time and IP, separately from location and terms consent (LR1); `GET /api/me` returns `participationConsent`. Rows in `participants` keep `status = 'left'` instead of being deleted. Activities created before this table existed get their author as host when the database opens. Withdrawing the consent and cancelling an activity are described below. Not done yet: host approval and reminders.

## Editing, reports and blocks

Step 5 of the delivery plan (safety minimum): backlog 5.3 (report/block), F7 and the `rule.md` provisions on report/block records and action logs. The "⋯" button on each card and on the detail page opens a menu: the author can edit or delete, anyone else can report the post or block its author.

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| PUT | `/api/posts/:id` | Same as POST | The updated post. 403 `not-owner`, 400 `type-change`, 409 `started` (an activity that has started cannot be edited) or `capacity-below-joined`. A meeting location needs a fresh `locationConsent: true`, stored as a new consent record. Logged as `post.update`. |
| DELETE | `/api/posts/:id` | — | 204. Sets `deleted_at` instead of removing the row and logs `post.delete`. Deleting an activity cancels it: it leaves the feed, members still see it with a cancelled banner, and nobody can join. |
| POST | `/api/reports` | `{postId, reason, details?}` | 201. `reason` is `spam`, `harassment`, `unsafe`, `fake`, `inappropriate` or `other`; details up to 1000 characters. You cannot report your own post. At most 10 reports an hour per user. |
| GET | `/api/me/blocks` | — | `{items: [{id, displayName, username, blockedAt}]}` |
| POST | `/api/me/blocks` | `{userId}` | 204. Blocking twice changes nothing. |
| DELETE | `/api/me/blocks/:userId` | — | 204, or 404 `not-blocked`. |

Decision 2026-10-15 (Tech Lead): a block only hides the blocked person's posts from the blocker's feed. The blocked person is not told and can still see the blocker's posts and join the same activities. Unblocking sets `removed_at`, so `blocks` keeps who blocked whom and when. `reports` keeps reporter, reported user, post, reason, details, UTC time and IP; the reported person is never told who reported them. There is no moderator screen yet, so reports must be reviewed directly in the database.

## Account, consents, data download and deletion

Backlog 1.2/1.3 and the `rule.md` PDPA provisions on consent withdrawal, data portability and erasure. The UI is the "บัญชีของฉัน" page (`#/account`).

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| GET | `/api/me/consents` | — | `{terms: {termsVersion, privacyVersion, acceptedAt}, participation: {active, grantedAt, withdrawnAt}}`. |
| POST | `/api/me/consents/participation/withdraw` | — | The new consent state; 409 `not-granted` if it is not active. Stored in the insert-only `consent_withdrawals` table and logged as `consent.withdraw`. |
| POST | `/api/me/export` | `{password}` | A ZIP file (`joingun-my-data-YYYY-MM-DD.zip`, Asia/Bangkok date) containing `joingun-my-data.json`, encrypted with AES-256 under the chosen password (8–128 characters; the server does not keep it). At most 5 an hour. 503 `zip-missing` if `@zip.js/zip.js` is not installed. Logged as `data.export`. |
| POST | `/api/me/delete` | `{confirmUsername}` | 204 and the session cookie is cleared. 400 `confirm` if the username does not match. |

Decision 2026-10-15 (Tech Lead): withdrawing the participation consent stops future joins only. Activities the person already joined stay as they are, and the next join asks for consent again.

The download holds the profile with the decrypted email, consents and withdrawals, the person's posts (including deleted ones), participation, reports they sent, blocks they made, their own action log and their sign-in log. It never includes other people's emails or who reported them. Windows Explorer and macOS Archive Utility cannot open AES ZIP files; the page tells users to use 7-Zip, Keka or The Unarchiver.

Account deletion, decision 2026-10-15 (Tech Lead): the account disappears from every screen at once and a 90-day archive is kept, as `rule.md` asks, then purged. In one transaction the server copies the encrypted email into `deleted_accounts` with `purge_after` set 90 days ahead and deletes the `user_emails` row, so the same address can sign up again as a new account. It clears the profile and marks the user `deleted`, ends every session, removes the person's blocks, cancels upcoming activities they host and takes them out of upcoming activities they joined. Their posts stop appearing; where a post is still visible to members of a past activity, the author shows as "บัญชีที่ถูกลบ". Logged as `account.delete`.

Maintenance (`server/maintenance.js`) runs when the server starts and then once a day. For archives past `purge_after` it deletes the archived email, removes the email hash from `auth_logs`, replaces post text and activity title, place and pin with `[ลบแล้ว]` or empty values, and clears the details of reports the person sent. Rows in `audit_logs`, `consent_records`, `user_consents`, `terms_acceptances` and `reports` stay, tied to the user id only, as the action and consent record. It also deletes expired sign-in codes and sessions.

Not done yet: a moderator review screen for reports, notifying members by message when an activity is cancelled, and a written retention schedule agreed with the Product Owner for the records kept after the purge.

## Pilot build additions (2026-10-16)

Added together for the "complete version for real testing" request. Choices made without a team decision are listed in [DECISIONS.md](../DECISIONS.md).

### Friends and profiles (backlog 1.3, 5.1, 5.2; F5)

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| GET | `/api/users?q=` | — | Up to 20 active accounts whose username or display name contains `q`, with `relation`. Needs an account. Email is never searchable. |
| GET | `/api/users/:username` | — | Profile: name, username, bio, year and interests (signed-in viewers only), join date, stats, `relation` (`self`, `friends`, `incoming`, `outgoing`, `none`), `requestId`, `blockedByMe`, `historyVisible`. |
| GET | `/api/users/:username/posts` | — | That person's posts, same paging and filters as `/api/posts`. |
| GET | `/api/users/:username/history` | — | Activities the person joined or hosts. 403 `history-hidden` unless the owner's `historyVisibility` allows the viewer: `public` (any signed-in user), `friends` or `private` (default for accounts created since 2026-10-28). |
| PUT | `/api/me/privacy` | `{historyVisibility}` | The new setting. |
| PUT | `/api/me` | adds optional `bio` (up to 160 characters) | |
| GET | `/api/friends` | — | `{items, incoming, outgoing}`. |
| GET | `/api/friends/suggestions` | — | Up to 5 people from mutual friends, shared activities, then shared interests; never blocked people. |
| POST | `/api/friends/requests` | `{userId}` | 201 `{status, requestId}`. Sending to someone who already asked you accepts. 409 `blocked` / `unavailable` when either side blocked the other. 50 a day. |
| POST | `/api/friends/requests/:id/accept`, `/decline`, `/cancel` | — | The new relation. |
| DELETE | `/api/friends/:userId` | — | Ends the friendship. |

`friendships` keeps requester, addressee, status, times and IP. Each request, accept, decline, cancel and removal writes `action_logs` (user, action, target, UTC time, IP), as `rule.md` asks for sending and accepting friend requests. Blocking someone also ends a friendship or pending request. Account deletion ends all friendships at once; the purge 90 days later deletes the rows.

### Notifications and reminders (F4; backlog 4.1, 4.2)

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| GET | `/api/notifications?before=` | — | `{items, nextCursor, unread}`; 30 per page. |
| GET | `/api/notifications/unread-count` | — | `{unread}` (the UI polls it every 30 seconds). |
| POST | `/api/notifications/read` | `{all: true}` or `{ids: [...]}` | `{unread}`. |
| GET, PUT | `/api/me/notification-settings` | `{reminders, email, reminderMinutes}` | Reminder lead time 15, 30, 60 (default), 120 or 1440 minutes. Email reminders are off by default. |

Types: `activity.reminder`, `friend.request`, `friend.accept`, `activity.join` and `activity.leave` (to the host), `activity.updated` and `activity.cancelled` (to members), `report.reviewed` (to the reporter), `post.removed`, `account.suspended`, `account.restored`, `account.appeal-upheld`. A job runs every minute: it creates one reminder per person and activity inside each person's lead time, emails it when that person turned email on (Gmail; skipped with the console mailer), and marks activities `completedAt` three hours after the start with an `activity.complete` row in `action_logs` (Scope workflow step 6). The browser shows a system notification for new items while the tab is open and the person allowed it. Notifications are deleted after 180 days. Push notifications to a closed browser (Web Push) are not built; email covers that case.

### Recommendations (F6; backlog 6.1–6.3; LR4, LR5)

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| POST | `/api/me/consents/ai` | `{accept: true, acknowledgeLimitations: true}` | Grants the separate `ai-recommendation` consent (version `ai-v1`, stored in `user_consents` with time and IP). |
| POST | `/api/me/consents/ai/withdraw` | — | Stops recommendations at once. |
| GET | `/api/recommendations` | — | `{consent: false, items: []}` without consent; otherwise `{consent, method: "points", disclaimer, items: [{post, score, factors: [{key, points, label}]}]}`. |
| POST | `/api/recommendations/feedback` | `{postId?, kind, details?}` | `dismiss` hides one activity, `less-category` lowers a category, `review-request` (details required) goes to the moderator screen. |
| POST | `/api/recommendations/reset` | — | Clears dismiss and less-category feedback. |

The model is a transparent points table, not a trained or language model: interest match +40, own participation in the category in the last 180 days +10 each (up to 30), friends joined +15 each (up to 30), host is a friend +15, starts within 48 hours +10, "less of this category" −25 each. Only upcoming, open activities the person has not joined, from people they have not blocked, are scored. No year, faculty, gender, location or other trait is used, and nothing leaves the server. The UI labels each item "แนะนำโดยระบบ AI", lists every factor with its points and offers dismiss, less-of-this and human review.

### Moderation (rule.md: report records, human review of suspensions)

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| GET | `/api/mod/summary` | — | Open reports, appeals and recommendation reviews. |
| GET | `/api/mod/reports?status=open` (`reviewed`, `all`) | — | Reports with reporter, reported user, post text and earlier decisions. |
| POST | `/api/mod/reports/:id/review` | `{action, note?}` | `dismiss`, `remove-post` (sets `deleted_at`, logs `post.moderator-remove`, tells the author and members) or `suspend-user` (a reason is required and shown to the user; moderators cannot be suspended). The reporter is told the outcome. |
| GET, POST | `/api/mod/appeals?status=`, `/api/mod/appeals/:id/resolve` | `{outcome: "lifted" or "upheld", note?}` | Appeals against suspensions. |
| GET, POST | `/api/mod/recommendation-reviews?status=`, `/:id/close` | — | Requests to review recommendations. |
| POST, GET | `/api/me/appeal` | `{message}` | A suspended user asks for human review (one open appeal at a time). |

All need the `moderator` role: emails listed in `MODERATOR_EMAILS` get it on sign-in, or run `npm run moderator -- <username>` (`--remove` to take it away). Decisions go to `report_reviews` and `action_logs`. A suspended account can read, change settings, download data, delete itself and appeal, but cannot post, edit, join or send friend requests (403).

### Production readiness (delivery step 6)

- Security headers on every response: CSP (now also allows Nominatim for place search), `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `Permissions-Policy` (no geolocation, camera or microphone), `Referrer-Policy`, `nosniff`, and HSTS when `NODE_ENV=production`. Written by hand, without helmet, so no new dependency.
- Rate limits (in memory, one process): 300 writes per IP per 15 minutes overall; posts 30 an hour, join and leave 60 an hour, friend requests 50 a day, recommendation feedback 60 an hour, appeals 5 a day, plus the earlier sign-in, report and export limits.
- Backups: the app makes none since 2026-10-29 (the `VACUUM INTO` job was SQLite-only); the Render PostgreSQL service keeps them (none on the free plan). Backups contain personal data.
- Configuration checks at start: `HOST`, `DATABASE_URL`, `MODERATOR_EMAILS`; see `.env.example`. Bind `HOST=0.0.0.0` behind the host's HTTPS proxy with `TRUST_PROXY=true` and `NODE_ENV=production`.
- GitHub Actions (`.github/workflows/test.yml`) runs `npm ci` and `npm test` on Node 22 for every push and pull request.
- Logs (`audit_logs`, `auth_logs`, `action_logs`, consent and report tables) are still never pruned; a retention schedule is an open Product Owner decision.
- Terms and privacy versions moved to `terms-draft-1` and `privacy-draft-1` because the policies now cover friends, notifications and recommendations; existing accounts are asked to accept again at their next visit.

Still not done: whole-database or disk encryption (depends on the hosting choice), Web Push, shared rate limits for several processes, a written retention schedule, and testing on real phones.

## Mobile app and remaining functions (0.3.0, 2026-10-26)

### Android app (Capacitor)

The Tech Lead chose Capacitor on 2026-10-26. `capacitor.config.json` points the app at this server with `server.url`, so the app shows the same `web/` pages and uses the same cookies and API. `android/` is the generated Android Studio project (plugins: `@capacitor/app`, `@capacitor/local-notifications`, `@capacitor/status-bar`; versions are pinned in `package.json`).

1. Run the server reachable from the phone: `HOST=0.0.0.0` in `.env`, then `npm start`.
2. Set `server.url` in `capacitor.config.json`: `http://10.0.2.2:3000` for the Android emulator (the default), `http://<PC LAN IP>:3000` for a phone on the same Wi-Fi, or the HTTPS address after deployment (then remove `"cleartext": true`).
3. `npm run cap:sync`, then `npm run cap:open` (needs Android Studio with an SDK and JDK) and press Run, or build an APK from Android Studio.

The app adds `JoinGunApp` to its User-Agent; for those requests the server allows inline scripts in the CSP so Capacitor can inject its native bridge into server-loaded pages. Browsers keep the strict policy. `web/js/native.js` handles the Android back button (close a sheet, go back, leave the app from the home screen), the status-bar colour and reminders; in a browser it does nothing. iOS is not set up (needs macOS and Xcode).

### Reminders on the phone (F4)

In the app, reminders are scheduled on the phone with Local Notifications, so they arrive with the app closed: one per upcoming activity the person hosts or joined, at the start time minus their lead time (`/api/me/notification-settings`). The schedule is rebuilt after sign-in, app start and resume, join, leave, creating or editing a post, and changing notification settings, and is cleared on sign-out. Tapping a notification opens the activity. Pushes sent by the server (friend requests and other events while the app is closed) need Firebase Cloud Messaging and a Firebase project, and are not built; in-app notifications and optional email remain.

### Encrypted profile fields (rule.md PDPA)

`year`, `interests` and `bio` are stored AES-256-GCM encrypted in `users.year_enc`, `interests_enc` and `bio_enc` (`server/profile-crypto.js`, keys from `APP_SECRET`); the old plain columns stay empty. Rows written before this are encrypted when the server starts. Display name and username stay readable because they appear on every post, are searched and must be unique. The email was already encrypted. Whole-disk encryption still belongs to the hosting choice.

### Measuring NFR1/NFR4 and checking bias

- `npm run perf -- --url http://127.0.0.1:3000 --users 200 --seconds 20` runs concurrent virtual users against `/api/posts` and `/api/posts/:id` and prints p50/p95/max against the 2 s (NFR1) and 3 s (NFR4) targets. On the Tech Lead's laptop on 2026-10-26 with the small preview database: 100 users p95 about 62 ms; 1,000 users p95 about 505 ms, max 1.45 s, no errors. These are server-side numbers on one machine with few posts; 4G time and a real data set must be measured on the deployed host.
- `npm run bias-report` runs the recommender for everyone who turned recommendations on and compares the share of recommended activities by host year and category with what was available (rule.md bias evaluation). Gender and faculty are not collected, so they cannot be checked.

### Mobile layout

Every screen size now uses the phone layout: one 480px column (a phone frame with a shadow on wide screens), an app bar per page and a bottom tab bar: หน้าแรก, สำรวจ, สร้าง (+), แจ้งเตือน, เมนู. The side navigation and side panel are gone: upcoming activities are a swipeable strip at the top of Home, people suggestions are in Friends, and the เมนู tab (`#/menu`, `web/js/menu.js`) holds the profile card, shortcuts (my activities, friends, settings, moderator screen), policies and sign-out. Pages slide in, sheets always open from the bottom, and lists support pull to refresh.
