# JoinGun — Traceability Matrix

| Item | Value |
| --- | --- |
| Status | Draft, 2026-10-28, drawn from the files in the repository (build 0.3.0). Needs team review. |
| Chain | Pain evidence → requirement (F / NFR / LR / rule.md) → backlog → diagram → screen and code → test |
| Evidence used | Questionnaire, 5 responses ([evidence-log.md](evidence-log.md) §4, codes `EL-Qn`) and Path B research ([competitor-research.md](competitor-research.md) §5, codes `CR-n`). **No interviews exist**, so no row has a direct student quote of the pain. |
| Diagrams | [diagrams.md](../02-design/diagrams.md) D1–D4, a draft not yet reviewed by the team. The PNGs are older and not used here. |
| Tests | IDs from [test-plan.md](../03-testing/test-plan.md) §4; "Pass" there means `npm test` / `npm run test:e2e` on 2026-10-28. |
| F8 | Proposed, not in the spec: [20261028-03-f8-join-leave-draft.md](01-spec/20261028-03-f8-join-leave-draft.md). |

## Evidence codes

| Code | Finding | Count / source |
| --- | --- | --- |
| EL-Q5 | Main problem is not finding people to join | 3/5 |
| EL-Q2 | Find partners today by messaging friends | 4/5 |
| EL-Q4 | Uncomfortable with strangers; want a friend along | 4/5 |
| EL-Q9 | Want fewer steps when posting | 4/5 |
| EL-Q10 | Want some reminder before the activity | 5/5 |
| EL-Q11 | Will share location for safety 4/5; usage history for recommendations 2/5; nothing beyond email 1/5 | 5 |
| EL-Q12 | Activity history visible to "only me" | 5/5 |
| CR-1 … CR-11 | Findings 1–11 in competitor-research.md §5 (no reply in general forums, need a friend, campus scope, harassment and scams, bans without review, late notifications, deletion not working, login failures, data not encrypted, no capacity shown, meet-ups misread and banned) | Public pages read 2026-10-28 |

## Matrix: backlog items

| Backlog | Requirement | Pain evidence | Diagram | Screen | Code | Tests | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 Sign-up with university email | F1 | CR-3, CR-4, CR-8 | D1, D2 Sign up / sign in | `#/welcome` sign-up sheet | `server/auth.js`, `server/accounts.js`, `web/js/auth-ui.js` | TC-ACC-01, 02, 08; E2E F1 | F1 widened to any `.ac.th` on 2026-10-10, still waiting for PO confirmation |
| 1.2 Email verification | F1, NFR3 | CR-8 | D1 (Gmail SMTP), D2 | Code entry in the sign-up sheet | `server/auth.js`, `server/mailer.js` | TC-ACC-03, 04, 06, 07 | NFR3 (2 minutes) not measured with real Gmail |
| 1.3 Profile creation and management | No F-ID (Scope step 2); rule.md PDPA encryption | — | D2 (part of sign-up) | `#/settings`, `#/u/<username>` | `server/accounts.js`, `server/profile-crypto.js`, `web/js/settings.js`, `web/js/profile.js` | TC-SAFE-06 | No functional requirement; no pain evidence |
| 2.1 Post new activity | F2 | EL-Q5, EL-Q9, CR-1, CR-10, CR-11 | D2 Post an activity | `#/` composer (สร้าง tab) | `server/app.js`, `server/validation.js`, `web/js/create.js` | TC-POST-01 … 07; E2E F2 F3 | — |
| 2.2 Activity feed | F3, NFR1 | EL-Q5, CR-1 | D2 Browse | `#/` (Home) | `web/js/feed.js`, `web/js/posts.js` | TC-FEED-01, 04, 05, 06 | NFR1 not measured on 4G; questionnaire 3/5 prefer a list, spec says cards |
| 2.3 Activity details | F3 (support) | CR-10 | D2 View details, D4 | `#/activity/<id>` | `web/js/detail.js` | TC-FEED-03 | No F-ID of its own |
| 2.4 Join / leave | **F8 (proposed)**, LR1, LR3 | EL-Q5, CR-1, CR-2, CR-10 | D2 ★ Join, Leave, See participants; D4, D4b | `#/activity/<id>`, `#/activities` | `server/participation.js`, `web/js/detail.js`, `web/js/activities.js` | TC-JOIN-01 … 07; E2E core journey, full activity | Core journey has no spec requirement until the PO accepts F8 |
| 3.1 Map and location pin | F2, NFR2, LR1 | EL-Q11 (location 4/5), CR-9 | D1 (OpenStreetMap), D2 Pin, Location consent | Composer map, detail map | `web/js/map.js`, `server/validation.js` | TC-POST-05, 08; E2E LR1 | NFR2 (10 m) not checked on a real phone |
| 3.2 Location search and navigation | F2 (support) | — | D2 Pin / search a place | Composer search, detail "navigate" | `web/js/map.js`, `web/js/detail.js` | TC-POST-09 | Navigation has no requirement |
| 4.1 Reminders and notifications | F4 | EL-Q10, CR-6 | D2 Get reminders | `#/notifications`, phone notifications | `server/notifications.js`, `server/maintenance.js`, `web/js/native.js` | TC-NOT-02, 03 | F4 says push; server push not built (in-app, email, phone local reminders instead). Android not run on a device |
| 4.2 Notification settings | F4 (support) | EL-Q10 | D2 Get reminders | `#/settings` | `server/notifications.js`, `web/js/settings.js` | TC-NOT-01 | No F-ID of its own |
| 5.1 Add friends | No F-ID (proposal §4); rule.md CCA friend log | EL-Q4, CR-2 | D2 Add and manage friends | `#/friends?tab=find` | `server/social.js`, `web/js/friends.js` | TC-SOC-01 | No functional requirement |
| 5.2 Manage friends | No F-ID (proposal §4) | EL-Q4, CR-2 | D2 Add and manage friends | `#/friends` | `server/social.js`, `web/js/friends.js` | TC-SOC-01 | No functional requirement |
| 5.3 Block and report | No F-ID; rule.md CCA report/block records | CR-4, CR-11 | D2 Report / block | ⋯ menu on posts, `#/settings` | `server/moderation.js`, `web/js/post-actions.js` | TC-SAFE-01, 02 | No functional requirement |
| 6.1 Recommendation engine | F6 (Could), LR4, LR5 | EL-Q11 (history 2/5) | D2 Get recommendations, AI consent | `#/` tab สำหรับคุณ | `server/recommend.js` | TC-AI-01, 02, 03 | Built ahead of Should items; a points model, not a trained model |
| 6.2 Personalized feed | F6, LR4 | EL-Q11 | D2 Get recommendations | `#/` tab สำหรับคุณ | `web/js/feed.js` | TC-AI-01 | As 6.1 |
| 6.3 Interest-based content | F6 | — | D2 Get recommendations | Interests in `#/settings` | `server/recommend.js` | TC-AI-01 | No evidence |
| 7.1 Home screen | F3 (support) | — | D3 (web browser) | `#/` | `web/js/main.js`, `web/js/shell.js`, `web/js/feed.js` | TC-DEV-01, TC-ACC-09 | — |
| 7.2 Search and filters | F3 (support), Scope step 4 | CR-1, CR-3 | D2 Browse, search and filter | `#/explore?q=`, Home filters | `server/app.js` (`/api/posts` filters), `web/js/feed.js` | TC-FEED-02; E2E core journey | No F-ID of its own |
| 7.3 Settings and account | F5, LR2 | EL-Q12, CR-7 | D2 Set history privacy, Download / delete | `#/settings` | `server/account-data.js`, `server/social.js`, `web/js/settings.js` | TC-SOC-02, TC-SAFE-04, 05 | Retention schedule for records kept after purge not written (PO) |
| 8.1 Privacy policy and consent | LR1; rule.md CCA terms records | EL-Q11, CR-9 | D2 Location consent, Participation consent, AI consent | `#/terms`, `#/privacy`, consent boxes | `server/auth.js`, `server/config.js`, `web/js/auth.js` | TC-ACC-03, 05, TC-POST-05, TC-JOIN-01 | Terms texts are drafts, no legal review; terms records have no LR ID |
| 8.2 Security and data protection | LR2, LR3, LR5; rule.md PDPA encryption | CR-9 | D3 (security middleware, SQLite) | — | `server/security.js`, `server/app.js`, `server/profile-crypto.js`, `server/maintenance.js` | TC-SAFE-06, 07, 10, 11, TC-NFR-05 | Log retention schedule and disk encryption open; TC-SAFE-07 not run |

## Matrix: built or required with no backlog item

| Item | Requirement | Pain evidence | Diagram | Screen | Code | Tests | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Moderation: review reports, remove, suspend, appeals | rule.md ETA human review; CCA report records | CR-5 | D2 Review reports, Suspend, Decide appeals, Appeal | `#/mod`, appeal in `#/settings` | `server/moderator.js` | TC-SAFE-09, TC-ACL-06 | No backlog item, no LR ID |
| Download my data | rule.md PDPA "Download My Data" | — | D2 Download my data | `#/settings` | `server/account-data.js` | TC-SAFE-04 | No backlog item, no LR ID; manual 7-Zip check not run |
| Safety guidance for meeting strangers | rule.md ETA | EL-Q4, CR-4 | — | Detail and join panel, `#/safety` | `web/js/detail.js` | TC-SAFE-08 | Not run; no LR ID |
| Activity completion log | Scope step 6 | — | — | — | `server/maintenance.js` | — | No backlog item, no test case |
| Android app | NFR1 (phone layout), Tech Lead decision 2026-10-26 | — | D3 (Capacitor) | Whole app | `android/`, `web/js/native.js` | TC-DEV-01 (not run on a device) | No backlog item; not built or run yet |
| Load test, bias report | NFR4; rule.md ETA bias | — | — | — | `server/scripts/perf.js`, `server/scripts/bias-report.js` | TC-NFR-04, TC-AI-03 | NFR4 has no backlog item |

## Requirements with no backlog item

| Requirement | Status |
| --- | --- |
| NFR4 (1,000 concurrent users) | Measured on one laptop only (`npm run perf`); no backlog item |
| F7 private chat | Won't; correctly absent |

## Summary of gaps

1. No row has interview evidence or a direct quote; the strongest pain support is EL-Q5 (3/5) and CR-1.
2. Ten backlog items have no functional requirement ID of their own: 1.3, 2.3, 2.4, 3.2, 4.2, 5.1, 5.2, 5.3, 7.1, 7.2; 8.1 and 8.2 trace to LR only. 2.4 is covered once the PO accepts F8.
3. Six built areas have no backlog item (table above).
4. Rule.md provisions without an LR ID: terms records, data download, report/block records, safety guidance, human review, encryption (see [legal traceability](01-spec/20260908-02-legal-traceability.md)).
5. Diagrams are a draft; every "Diagram" cell depends on team review of `diagrams.md`.
