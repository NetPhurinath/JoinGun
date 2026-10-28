# CLAUDE.md — JoinGun

This file is loaded automatically by Claude Code. The shared rules for all coding agents live in `AGENTS.md`, imported below. If anything here conflicts with `AGENTS.md` or `rule.md`, stop and ask the user.

@AGENTS.md

## Claude-specific notes

### Mandatory reading
- Before writing or changing anything that touches user data or user actions, read the full `rule.md` (see "Mandatory compliance" in `AGENTS.md`). Do not skip this because `AGENTS.md` summarizes it.

### Team and roles (from the proposal)
| Name | Role |
| --- | --- |
| Chayabordin Maophimpha | AI Lead |
| Chawin Thachai | Product Owner |
| Phurinath Janjirahpoonpon | Designer |
| Supawat Chaimoon | Tech Lead |
| Parinya Chotchungtakul | QA/Test |

Scope or requirement changes go through the Product Owner; architecture and stack decisions go through the Tech Lead. Do not make those decisions on their behalf.

### Current state
- Stage: local posting MVP after the W4 design. `server/` runs Node.js 22.13+, Express 5 and PostgreSQL (`pg`; PGlite for development and tests, since 2026-10-29) and serves the web UI from `web/`. See `server/README.md` for the API, schema and limits.
- Implemented: text and activity posts, a paged newest-first feed with server-side search and filters, activity details, an optional map pin with separate location consent, and consent and audit records for post creation.
- Accounts: passwordless email-code sign-in for any `.ac.th` address, sent through Gmail SMTP with an App Password via nodemailer (console output in development without a key); terms acceptance records, auth logs, encrypted email storage, and posts tied to the signed-in user. See `server/README.md` and `.env.example`.
- Joining (core journey): join with a one-time participation-history consent, leave before the start, host counted in capacity, participant names visible only to the host and members (decisions 2026-10-15), join/leave audit logs. See `server/README.md`.
- Safety and PDPA minimum (step 5): edit and delete own posts (deleting an activity cancels it), report posts, block users (hides their posts only), withdraw participation consent (stops future joins only), password-protected AES ZIP data download via `@zip.js/zip.js`, and account deletion that hides the account at once, archives the encrypted email for 90 days, then purges it in a daily maintenance job (decisions 2026-10-15). See `server/README.md`.
- Pilot build 0.2.0 (2026-10-16): friends, profile pages with history privacy (F5), in-app notifications and reminders with optional email (F4), explainable points-based recommendations behind their own consent (F6), a moderator screen with suspensions and appeals, place search and navigation links, an X/Facebook-style UI, and step 6 hardening (headers, rate limits, daily backup, GitHub Actions). Choices made without a team decision are in `DECISIONS.md`. See `server/README.md`, "Pilot build additions".
- Build 0.3.0 (2026-10-26): Android app with Capacitor (`android/`, `capacitor.config.json`, loads the server through `server.url`), phone-app layout on every screen with a เมนู tab, reminders scheduled on the phone (Local Notifications), encrypted year/interests/bio, `npm run perf` and `npm run bias-report`. Capacitor was chosen by the Tech Lead on 2026-10-26.
- Not implemented: server-sent push (needs Firebase), whole-database encryption, a written retention schedule, iOS. The Android app has not been built or run on a device yet. The server binds to `127.0.0.1` by default. Do not use it with real personal data until it is deployed with HTTPS.
- Technology stack: Node.js and Express were confirmed by the user for the posting MVP, and the UI uses Leaflet with OpenStreetMap. On 2026-10-29 the Tech Lead chose Railway hosting with Railway PostgreSQL (no data migrated; test data only) and the code was ported from SQLite (decisions 42–45 in `DECISIONS.md`); the same day Railway sign-ups were closed, so hosting moved to Render with Render PostgreSQL on free plans (`render.yaml`, decision 49), not yet deployed. Proposal sections 5.2, 5.3 and 7 are still empty. Email: Gmail SMTP with an App Password via nodemailer, chosen by the Tech Lead on 2026-10-14 because the team has no domain (Brevo and Resend were tried first and removed). Hosting and any other framework, database or map-provider change still need the Tech Lead's decision.
- Ownership: this developer builds both the backend (`server/`) and the frontend. Frontend work goes in the root `web/` folder (plain ES modules, no build step) served by Express; root `index.html` only redirects to it. `.docs/02-design/prototype/` stays as the design reference and is no longer served.
- Out of scope: payments, real-time in-app chat.

### Delivery plan and progress
Read this first in a new session to know where the work stands. The full plan (in Thai) is the Claude Doc "JoinGun — สถานะโปรเจคและแผนสู่การใช้งานจริง" (https://claude.ai/code/artifact/637f3d76-dec0-4584-94e0-7cd80275e8c0); its status table dates from 2026-10-10 and is older than this list. Update this list whenever a step finishes.

| Step | Goal | Status |
| --- | --- | --- |
| 1. Repo ready | Commit pending work, pick one Git remote, fix README status, fill the proposal's stack sections | Partly done. Commit `8064aab` (pilot build 0.3.0, 2026-10-27) is on `origin/main` and `origin/pilot-0.3.0` (`origin` = `NetPhurinath/JoinGun`). Not yet committed: `.docs/03-testing/` and the slides moved to `เอกสาร/slide/`. Open: the team still has to confirm the remote (README used to name `maefahluang-uni/Join-Gun`) and fill proposal sections 5.2, 5.3 and 7; `.docs/02-design/diagrams.md` (D1–D4 in Mermaid, drafted from the code on 2026-10-28) needs team review; the four PNGs are older and need redrawing. README status fixed 2026-10-28. |
| 2. Own frontend in `web/` | Move feed, create, filters, detail and map out of the prototype | Done |
| 3. Accounts | Email-code sign-in, sessions, terms records, auth logs | Done (any `.ac.th` address, Gmail SMTP; tested with a real send by the user on 2026-10-14) |
| 4. Join and leave | Participants, capacity in one transaction, participation consent, audit logs | Done |
| 5. Safety and PDPA minimum | Edit/delete posts, report/block, consent withdrawal, data download, account deletion with 90-day archive | Done 2026-10-15. `npm test` on the Tech Lead's machine: 33 pass, 1 skipped until `npm install` adds `@zip.js/zip.js`. Not checked: opening the ZIP in 7-Zip, maps when editing, real phones. |
| 6. Production readiness | helmet/security headers, rate limits, env config, binding 0.0.0.0, log retention, daily SQLite backup, disk or field encryption, GitHub Actions running `npm test`, full test on a real phone | Mostly done 2026-10-16: headers (no helmet), rate limits, config checks, `HOST=0.0.0.0` support, daily `VACUUM INTO` backup, GitHub Actions. `npm test`: 47 pass (2026-10-26). Field encryption for year/interests/bio added 2026-10-26; `npm run perf` added. Playwright browser tests (`npm run test:e2e`, CI job `e2e`) added 2026-10-28: 6 pass, after fixing the welcome page that was wider than a phone screen (TC-ACC-09, CSS fix in `web/css/app.css`). Open: log retention schedule (PO), disk encryption (with hosting), real-phone test. |
| 7. Deploy | Hosting with a persistent database, HTTPS, domain | Railway chosen 2026-10-29, then replaced the same day by Render + Render PostgreSQL (Railway sign-ups closed). Code ported, `render.yaml` added on free plans (see `server/README.md`, "Deploy on Render"); not yet deployed. Open: domain, budget and paid plans before the pilot (free database expires after ~30 days, no backups), what Render backs up. |
| 8. Pilot | Small group test, QA on real phones, collect feedback as pain-point evidence | Not started. Android project ready (`npm run cap:open`); needs Android Studio to build. |
| 9. Next features | Reminders (F4), friends, AI recommendations (F6, with LR4/LR5) | Built early on 2026-10-16 (see `DECISIONS.md`); needs team review and pilot feedback. Web Push not built. |

Open questions: where to host and the monthly budget (Tech Lead); whether the first public release stops at step 7 (Product Owner). Also missing: team review of `DECISIONS.md`, and a written retention schedule for records kept after an account is purged.

### Working style
- Reply to the user in Thai unless asked otherwise; keep code, identifiers, commit messages and project documents in English.
- Keep answers concise and step by step.
- Use Plan mode for any change touching more than one file, and show the plan before editing.
- When reporting work, separate: inspected / actually tested / simulated / not verified (as `AGENTS.md` requires).

### Files Claude must not edit without asking
- `rule.md`
- Everything under `เอกสาร/` (original records and course material)
- The backlog point totals (117 vs 113 — see known gaps in `AGENTS.md`)

### Not yet present
- `.claude/agents/requirement-writer.md`
- `.claude/skills/audit-backlog/SKILL.md`
- Interview records. The evidence log (`.docs/01-requirements/evidence-log.md`) holds only a 5-response questionnaire from 2026-09-07/08; no interviews, direct pain quotes or Path B research are logged yet.

Do not reference these as if they exist. Offer to create them only when the user asks.
