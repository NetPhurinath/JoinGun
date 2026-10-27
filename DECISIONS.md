# Decisions made without a team decision (2026-10-16)

The user (Tech Lead) asked for a complete, testable version and said to pick the most reasonable option at each open point and record it here instead of stopping to ask. Each item below is a working choice, not a Product Owner or legal decision. Review them before the pilot; most can be changed in one place.

## Scope and process

| # | Decision | Why | Where to change |
| --- | --- | --- | --- |
| 1 | Built F4, F5, F6, friends (5.1–5.2), a moderator screen, location search and navigation (3.2), activity completion (Scope step 6) and step 6 production hardening in one pass, without Plan mode approval. | The request explicitly said not to stop and ask. CLAUDE.md normally asks for Plan mode on multi-file changes. | — |
| 2 | Nothing was committed or pushed, and nothing was deployed. | CLAUDE.md: the user commits on their own call; deployment waits for the hosting decision (step 7). | — |
| 3 | F7 (private chat) stays out. | Spec marks it Won't; Scope excludes chat. | — |

## Product behaviour

| # | Decision | Why | Where to change |
| --- | --- | --- | --- |
| 4 | Recommendations ("AI", F6) are a transparent points model run on the server, labelled "แนะนำโดยระบบ AI", with every factor and its points shown. No trained model and no external LLM. | LR4/LR5 and rule.md ask for explainable factors and no raw data to third parties; there is no training data or budget yet. Calling it "AI" follows the spec wording; the UI and policy say it is a points system. | `server/recommend.js` |
| 5 | Recommendations need their own opt-in consent (`ai-recommendation`, `ai-v1`) with an acknowledgement of limitations, and are off by default. | rule.md: separate consent per purpose; record acknowledgement of AI limitations. | `server/recommend.js`, `web/js/feed.js`, `web/js/settings.js` |
| 6 | Factors used: chosen interests, own participation by category in the last 180 days, friends joined, host is a friend, starts within 48 hours, "less of this category" feedback. Not used: year, gender, faculty, location. | Fewer personal traits, less bias risk (rule.md bias evaluation); no viewer location exists. A bias evaluation report is still needed before any trained model. | `server/recommend.js` |
| 7 | Reminders: in-app notifications plus optional email; browser system notifications only while the tab is open. No Web Push. Default lead time 60 minutes; email off by default. | Web Push needs VAPID keys, a service worker and an HTTPS host; email reaches people with the app closed. Email off by default avoids surprise mail and the Gmail 500/day limit. | `server/notifications.js`, `server/maintenance.js` |
| 8 | History visibility (F5) choices: everyone signed in, friends only, only me. The default was friends only until 2026-10-28; it is now only me (decision 34). Participant lists of a shared activity stay visible to its members regardless. | Default to the more private useful option; participant lists were already decided on 2026-10-15. | `server/social.js` |
| 9 | Profiles are public to signed-out visitors (name, username, bio, posts) but year and interests show only to signed-in users. | Posts are already public; optional profile fields get a little more protection. | `server/social.js` `profile()` |
| 10 | Added an optional 160-character bio. No profile photos. | Profile pages need a line of text; photos add storage, moderation and personal-data risk (LR5). | `server/auth.js`, `web/js/settings.js` |
| 11 | Friend requests: sending to someone who already asked you accepts it; blocking ends a friendship or request; a blocked person gets a neutral "cannot send" message. | Usual social-app behaviour; the blocked person is not told (consistent with the 2026-10-15 block decision). | `server/social.js` |
| 12 | An activity counts as completed three hours after its start; the completion is logged with the host as actor and IP "system". | Scope workflow step 6 says the system logs completion; there is no check-in feature. | `server/maintenance.js` `COMPLETE_AFTER_HOURS` |
| 13 | Moderators: named by `MODERATOR_EMAILS` or `npm run moderator`. Actions: dismiss, remove post, suspend (reason required and shown). Suspended users can still read, change settings, download data, delete the account and appeal. | rule.md asks for human review and report records; keeping data rights during a suspension follows PDPA. | `server/moderator.js` |
| 14 | Terms and privacy texts updated and versions bumped to `terms-draft-1` / `privacy-draft-1`; existing accounts must accept again. | The policies now describe friends, notifications and recommendations (rule.md: renewed acceptance after material updates). The texts are still drafts, not legal advice. | `server/config.js`, `web/js/auth.js`, `web/js/auth-ui.js` |
| 15 | Notifications are deleted after 180 days. Logs and consent records are still never pruned. | Notifications are messages, not the traffic log rule.md protects. Log retention needs the Product Owner's written schedule. | `server/maintenance.js` |

## Design

| # | Decision | Why | Where to change |
| --- | --- | --- | --- |
| 16 | X-style shell (side navigation, feed column, side panel; bottom tab bar on phones) with Facebook-style composer and event cards; light and dark themes from the device setting. | The request asked for a look like X and Facebook; the design system already took X's flow as its reference. | `web/css/app.css`, `web/css/tokens.css` |
| 17 | The feed column is 600px wide on large screens, wider than the 480px `layout-content-max` token; dialogs are up to 560px. | A three-column desktop layout needs a wider middle column; phones still use one column. The design-system document was not edited. | `web/css/tokens.css` (`--layout-feed`) |
| 18 | Activity cards show a category banner and a date badge before the title; the title → category → date → place → places → "ดูรายละเอียด" order is kept inside the card, and joining still happens only on the detail page. | Keeps the design-system rule while adding the event-card look. | `web/js/posts.js` |
| 19 | Added "add to calendar" (.ics made in the browser) and "navigate" links to Google Maps and OpenStreetMap on the detail page. | Backlog 3.2 (navigation) and fewer missed appointments; the links open external apps, JoinGun never reads the viewer's location. | `web/js/detail.js` |
| 20 | Place search uses OpenStreetMap Nominatim from the browser, results biased to the campus area, sending only the typed words. | Backlog 3.2; no API key; stays on the existing OpenStreetMap stack (the Google Maps question is still open). | `web/js/map.js`, CSP in `server/app.js` |

## Production readiness (step 6)

| # | Decision | Why | Where to change |
| --- | --- | --- | --- |
| 21 | Security headers written by hand instead of adding helmet. | No new dependency to review; the needed headers are few. | `server/app.js` |
| 22 | In-memory rate limits (overall 300 writes per IP per 15 minutes, plus per-action limits). | One server process for the pilot; a shared store is needed only with several processes. | `server/app.js` |
| 23 | Daily `VACUUM INTO` backup kept 7 days in `data/backups/`. | Consistent snapshot without stopping the server; 7 days keeps purged accounts out of backups within a week. | `BACKUP_KEEP_DAYS`, `BACKUP_DIR` |
| 24 | No disk or field encryption added beyond the existing encrypted email. | Display names and usernames must be searchable and unique; full-disk encryption belongs to the hosting choice (Tech Lead). | — |
| 25 | GitHub Actions workflow added, assuming the GitHub remote named in README. | README names `maefahluang-uni/Join-Gun`; the remote choice is still marked unconfirmed in CLAUDE.md. | `.github/workflows/test.yml` |
| 26 | `npm run seed` adds four sample accounts (no email, cannot sign in) and five activities; refuses to run in production. | Testers need content to look at on day one. Do not run it on the pilot database. | `server/scripts/seed.js` |

## Added 2026-10-26 (mobile app and remaining functions)

| # | Decision | Why | Where to change |
| --- | --- | --- | --- |
| 27 | Android app with Capacitor 8 (chosen by the Tech Lead), loading this server's pages through `server.url` instead of bundling them. | Keeps cookies, the CSRF Origin check and same-origin `/api` unchanged; one codebase for web and app. Needs the network, which the app needs anyway. | `capacitor.config.json` |
| 28 | For User-Agents containing `JoinGunApp` the CSP allows inline scripts. | Capacitor may inject its bridge inline into server-loaded pages; only the viewer's own app sends the marker. Not yet checked on a device. | `server/app.js` |
| 29 | F4 in the app uses Local Notifications scheduled on the phone; no Firebase push. | Works with the app closed and without a Firebase project, keys or Google services file. Server events (friend requests) while closed still need FCM. | `web/js/native.js` |
| 30 | Encrypt `year`, `interests`, `bio` in new `*_enc` columns; keep display name and username readable. | rule.md asks to encrypt profile data; the two names are public, searched and unique. Existing rows are migrated at start. | `server/profile-crypto.js` |
| 31 | Phone layout on every screen: 480px column, bottom tab bar with a เมนู tab, no side navigation or side panel. | The Tech Lead chose a phone frame on desktop; one layout to design and test. This replaces decisions 16 and 17. | `web/css/app.css`, `web/js/shell.js`, `web/js/menu.js` |
| 32 | Pinned exact versions released at least two weeks earlier: core/cli/android 8.5.3, app 8.1.2, local-notifications 8.3.1, status-bar 8.0.4. | Reproducible builds; avoids versions too new to have known issues. | `package.json` |
| 33 | `npm audit` reports body-parser (high, DoS) and nodemailer (moderate) issues in existing dependencies, plus uuid via `@capacitor/cli` (dev only). Not fixed in this change. | Fixing changes express/nodemailer lock versions; worth a separate, tested update (`npm audit fix`). | `package-lock.json` |

## Decisions given by the user on 2026-10-28

The user (Tech Lead) gave these after reviewing the questionnaire in `.docs/01-requirements/evidence-log.md`. They change scope or product behaviour, so the Product Owner still has to confirm them.

| # | Decision | Why | Where to change |
| --- | --- | --- | --- |
| 34 | Activity history is visible to **only me** by default for new accounts. Existing accounts keep their current setting. | 5 of 5 questionnaire respondents chose "only me". Existing rows cannot tell a chosen "friends" from the old default. | `server/accounts.js` (new-account insert), `server/database.js`, `web/js/settings.js` |
| 35 | The proposal keeps meeting strangers as the main idea, and adds that students can bring a friend along (share the activity link, friends feed). No new feature was built. | 4 of 5 respondents need a friend to go along; the share button and friends feed already exist. | `.docs/00-proposal/JoinGun Proposal.md` |
| 36 | No points or rewards system (Won't for this build); listed as out of scope in the proposal. | 2 of 5 respondents asked for it, but it is not in the spec or backlog, and W6 scope lock says new requests go to Could or Won't. | `.docs/00-proposal/JoinGun Proposal.md` |
| 37 | Browser end-to-end tests with Playwright 1.64.0 (dev dependency, pinned; 1.64.1 was less than two weeks old), Chromium only, on a Pixel 7 phone screen, against a separate in-memory test server (`tests/e2e/server.js`) that never opens `data/`. Run with `npm run test:e2e`; GitHub Actions job `e2e`. Approved by the Tech Lead on 2026-10-28. Hosting is postponed. | Test plan L2 needs the core journey checked in a real browser; the course method deck uses Playwright. The separate server keeps test accounts out of the pilot database. | `playwright.config.js`, `tests/e2e/` |

## Still open (not decided here)

- Hosting, HTTPS, domain and monthly budget (Tech Lead), and therefore disk encryption.
- Whether to add Firebase Cloud Messaging for server-sent push in the app (needs a Firebase project).
- Building and testing the Android app on a real phone (needs Android Studio).
- A written retention schedule for logs and records kept after an account is purged (Product Owner).
- Whether the first public release stops at step 7 (Product Owner).
- Legal review of the draft terms and privacy policy.
- QA on real phones (QA/Test) and the pilot itself (step 8).
