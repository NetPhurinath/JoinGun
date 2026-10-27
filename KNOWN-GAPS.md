# JoinGun — Known Gaps

What pilot build 0.3.0 does **not** do, or has not proved, as of 2026-10-28. Collected from `CLAUDE.md`, `DECISIONS.md`, `server/README.md`, the test plan and the [backlog audit](.docs/05-log/2026-10-28-backlog-audit.md). Update this file when a gap closes.

## Not built

| Gap | Affects | Owner | Note |
| --- | --- | --- | --- |
| Server-sent push (Firebase Cloud Messaging) | F4 | Tech Lead | Reminders use in-app notifications, optional email and phone local notifications. Friend requests etc. do not reach a closed app. |
| Web Push for browsers | F4 | Tech Lead | Needs HTTPS, VAPID keys and a service worker. |
| Whole-database or disk encryption | rule.md PDPA | Tech Lead | Depends on hosting. Email, year, interests and bio are field-encrypted; display name and username are not. |
| Written retention schedule for logs and for records kept after an account purge | LR3, LR2, rule.md CCA | Product Owner | Logs are never pruned today. |
| Rate limits shared across several server processes | Security | Tech Lead | In-memory, one process only. |
| Trained recommendation model | F6 | AI Lead | A transparent points model is used and labelled. |
| iOS app | — | Tech Lead | Needs macOS and Xcode. |
| Google sign-in | F1 | — | Button hidden. |
| Host approval of participants | rule.md CCA (conditional) | Product Owner | Joining is instant, so the approval record rule does not apply yet. |
| Message to members when an activity is cancelled | — | — | In-app notification only. |
| Private chat | F7 | — | Won't, by the spec. |

## Built but not verified

| Gap | Test case | Note |
| --- | --- | --- |
| Android app built and run on a real phone | TC-DEV-01 | Android Studio project exists; not built yet. `gradle-wrapper.properties` has an uncommitted change to Gradle 9.7.1. |
| CSP exception for the Capacitor bridge works on a device | — | DECISIONS 28. |
| NFR1 feed in 2 s on 4G | TC-FEED-06 | Only server-side timings on a laptop. |
| NFR2 pin within 10 m | TC-POST-08 | Needs a real phone outdoors. |
| NFR3 code email within 2 minutes | TC-ACC-07 | One real send by the user on 2026-10-14; not timed. |
| NFR4 1,000 concurrent users | TC-NFR-04 | One laptop, small database (p95 ≈ 505 ms). |
| ZIP export opens in 7-Zip / a phone unzip app | TC-SAFE-04 (manual) | |
| No national ID, home address or religion field anywhere | TC-SAFE-07 | Inspection not run. |
| Safety guidance text, no "guarantee" wording | TC-SAFE-08 | Not run. |
| UAT with real students | test-plan §5 | Not started. |
| Gmail limits (about 500 recipients a day) | — | Not suitable if usage grows. |

## Requirements and documents

| Gap | Owner | Note |
| --- | --- | --- |
| Join/leave (core journey) has no spec requirement | Product Owner | Draft [F8](.docs/01-requirements/01-spec/20261028-03-f8-join-leave-draft.md). |
| F1 widened to any `.ac.th` on 2026-10-10 | Product Owner | Waiting for confirmation. |
| Backlog: no acceptance criteria, no pain IDs, stale Status, High/Medium vs MoSCoW, total 117 vs 113 | Product Owner | See the audit. |
| Built features with no backlog item (moderation, data download, safety page, completion log, Android, perf/bias scripts) and NFR4 with none | Product Owner | See the audit, finding 8. |
| F4–F6, friends and moderation built ahead of priority | Product Owner | Keep or hide until the pilot. |
| No interviews; evidence is a 5-response questionnaire and Path B research without screenshots | Product Owner, QA | The team decided on 2026-10-28 not to run phase 1 of the gap plan. |
| Diagrams: `diagrams.md` not reviewed; PNGs outdated (Google Maps) | Team, Designer | The team decided on 2026-10-28 not to run phase 3 of the gap plan. |
| `DECISIONS.md` not reviewed by the team | Team | |
| Terms and privacy texts are drafts without legal review | Product Owner | |
| Git remote not confirmed (`NetPhurinath/JoinGun` vs `maefahluang-uni/Join-Gun`) | Tech Lead | |
| Stale lines: `evidence-log.md` §4 says the F5 default is `friends` (now `private`, decision 34); `diagrams.md` consistency check says proposal 5.3 is empty (now filled); `CLAUDE.md` step 1 says `.docs/03-testing/` and slides are not committed (committed) | — | Not fixed yet. |
| `npm audit`: body-parser (high), nodemailer (moderate), uuid via Capacitor CLI (dev) | Tech Lead | DECISIONS 33. |

## Not allowed until deployed

- Real personal data: the server binds to `127.0.0.1` and has no HTTPS. Hosting, budget and domain wait for the Tech Lead (delivery step 7).
- Legal compliance is not claimed. `rule.md` is project guidance, not a legal opinion.
