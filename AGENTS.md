# JoinGun project guide for coding agents

Place this file at the repository root, beside `README.md` and `rule.md`. These instructions apply throughout the JoinGun project. Follow the links below before changing a related file. Links describe document relationships; Markdown links do not import files into the application.

## Permission rule

- Do only the work the user has explicitly requested. That request authorizes the steps needed to complete it, including reading relevant files.
- Before any additional work or change of scope, describe the proposed action and ask the user first. Wait for an explicit answer; silence is not approval.
- In particular, ask before editing or deleting other files, running the app or tests, installing packages, changing requirements, creating new deliverables, or committing, pushing, or publishing. When an action is already explicitly requested, proceed within that scope.
- Never invent interview evidence, completed tests, legal compliance, or production functionality. Surface unknowns and disagreements between documents to the user.

## Mandatory compliance with rule.md

**Read the complete root [rule.md](rule.md) before writing or changing code that handles user data or user actions. Follow every applicable rule. A link to the file or an LR reference alone is not evidence that the rule has been implemented.**

- Treat root `rule.md` as the project's compliance source. Use the specification and legal traceability document to connect its obligations to implementation; do not rely only on LR1–LR5 because the traceability document identifies rules not yet covered by those IDs.
- The checklist below summarizes the current project rules. Always read the current `rule.md`; if it changes or conflicts with this guide, a requirement, or another document, explain the conflict and ask the user before the affected implementation. Do not silently weaken or rewrite the rules.
- These are the project's stated requirements. Do not claim that this guide, the prototype, or a completed checklist establishes legal compliance. In particular, request clarification of conflicting deletion/retention requirements rather than assuming all personal data must be retained.

### Privacy and data handling

Before implementing a relevant feature, check all applicable conditions from the PDPA section of `rule.md`:

1. Obtain separate, clear opt-in consent before collecting or using location data, including a meeting-location pin, or activity participation history. Do not bundle location, participation history, and AI purposes into one implied consent.
2. Encrypt stored profile data and separate location/activity history from direct personal identifiers.
3. Support deletion or anonymization of activity history, location logs, and friend connections within the required retention period. Resolve the interaction with retained records before implementing deletion.
4. Support a secure, password-protected JSON or CSV export for a user's personal data and participation history when implementing “Download My Data.”
5. Remove identifiers before supplying training or fine-tuning data to external LLMs or third-party APIs; do not send raw names or unnecessary personal information.
6. Exclude unnecessary fields from forms, API payloads, and database schemas, including national ID, home address, and religion.
7. Do not retain plaintext university email alongside activity history longer than needed for verification and account recovery.

### Logs, consent evidence, and retention

Follow the record requirements stated in `rule.md` when implementing the corresponding actions:

1. Log activity posting, joining/leaving, and sending/accepting friend requests with `user_id`, exact timestamp, `ip_address`, and action type. The project rule specifies access/traffic-log retention of at least 90 days tied to the user.
2. Store a secure acceptance record for Terms of Service, Privacy Policy, and AI consent with `user_id`, exact timestamp, `ip_address`, and `terms_version`.
3. Require review and acceptance of materially updated terms when renewed acceptance is required.
4. Communicate AI limitations and disclaimers and record acknowledgement where required.
5. Preserve a reliable, unalterable record of who electronically approves or confirms a participant, if host approval is implemented. Do not add approval to the core journey solely because this conditional rule exists.
6. Log login, logout, and API token requests with `user_id`, UTC/ISO-8601 timestamp, `source_ip`, and `auth_status`.
7. On account erasure, mark the profile deleted for user-facing features and apply the source rule's archive requirement of at least 90 days after termination, once the data categories and deletion/retention conflict have been clarified.
8. Retain report/block records with reporter, reported user, reason, and timestamp for at least 90 days as stated in the project rule.

### AI transparency and user safety

When the corresponding feature is in scope:

1. Explain the main factors behind an AI recommendation or match score.
2. Show clear safety guidance for meeting strangers. Never present email verification or AI matching as a guarantee of identity, intentions, or safety.
3. Allow feedback on, dismissal of, or override of recommendations.
4. Evaluate training data and model outputs for bias across relevant groups when training, testing, or updating a recommendation model.
5. Label AI-generated recommendations that may significantly influence decisions and provide an appropriate route to human review.
6. Provide human review of automated account verification, suspension, or flagging decisions.

### Before reporting a change as complete

- Identify the relevant `rule.md` provisions, requirement IDs, and backlog items. If no ID or acceptance criterion exists, report the gap rather than inventing one.
- Within the authorized scope, verify the relevant consent states, data fields, records, access restrictions, and user-facing behavior. Ask before expanding into additional implementation, tests, or infrastructure.
- Distinguish what was inspected, what was actually tested, what remains simulated, and what could not be verified. A browser checkbox does not prove a stored consent record, and an in-memory action does not prove a retained server log.
- Do not deploy the posting MVP publicly or enable real personal-data collection without the user's explicit authorization.

## Project at a glance

JoinGun helps university students discover, create, and join shared activities. The selected core journey is **join an activity from the feed**. The current application is a local posting MVP: an Express and SQLite server in `server/` serves the web UI in `web/` and stores text and activity posts, with location-consent and post-creation audit records, by the signed-in user (see `server/README.md`). Accounts use email-code sign-in for `.ac.th` addresses, sent through Gmail SMTP (nodemailer). Joining and leaving activities work with a separate participation-history consent and join/leave audit logs. Authors can edit and delete posts; users can report posts, block users, withdraw participation consent, download a password-protected copy of their data and delete their account (90-day archive, then purge). Since 2026-10-16 the pilot build adds friends, profile history privacy, notifications and reminders, points-based recommendations behind a separate consent, and a moderator screen (see `DECISIONS.md`); Since 2026-10-26 it also runs as a Capacitor Android app with phone-scheduled reminders and encrypted optional profile fields; server-sent push (Firebase) and a trained AI model are not implemented.

## Start here: document chain

1. Read the [README](README.md) for repository layout and known outstanding work.
2. Read the [proposal](.docs/00-proposal/JoinGun%20Proposal.md) for the problem, users, scope, and team. Its architecture, stack, and timeline sections remain incomplete.
3. Read the [requirement specification](.docs/01-requirements/01-spec/20260908-01-joingun.md) for F1–F7, NFR1–NFR4, LR1–LR5, and scope. Check [legal traceability](.docs/01-requirements/01-spec/20260908-02-legal-traceability.md) against the [project rules](rule.md).
4. Follow requirement IDs into the [product backlog](.docs/01-requirements/backlog.md). The backlog records 22 items; its original High/Medium priorities do not always match the specification's MoSCoW priorities.
5. Follow the selected workflow through the [feature list](.docs/02-design/feature-list.md), [five-step user journey](.docs/02-design/user-journey.md), [design system](.docs/02-design/design-system.md), and [prototype guide](.docs/02-design/prototype.md).
6. Inspect the [web UI](web/index.html) and its `web/js/` modules for actual behavior; the [prototype](.docs/02-design/prototype/index.html) is the earlier design reference and is no longer served. The [root index](index.html) redirects to `web/` when opened as a file. The map depends on Leaflet and OpenStreetMap network assets.

Trace each proposed change as **problem/evidence → F/NFR/LR → backlog item → design/journey → prototype**, and say where a link is missing. Do not treat an item that appears only in a diagram or the proposal as implemented.

## File map

| Area | Files | Purpose |
| --- | --- | --- |
| Repository guidance | [README.md](README.md), this `AGENTS.md` | Status and navigation; no additional agent entry file is required. |
| Proposal | [JoinGun Proposal.md](.docs/00-proposal/JoinGun%20Proposal.md) | Working proposal and target users. |
| Requirements | [spec](.docs/01-requirements/01-spec/20260908-01-joingun.md), [legal traceability](.docs/01-requirements/01-spec/20260908-02-legal-traceability.md), [backlog](.docs/01-requirements/backlog.md), [rule.md](rule.md) | Requirements, mapping, planned work, and project rules. |
| Design | [feature list](.docs/02-design/feature-list.md), [user journey](.docs/02-design/user-journey.md), [design system](.docs/02-design/design-system.md), [prototype guide](.docs/02-design/prototype.md) | Intended core flow and UI conventions. |
| Server | [server/](server/README.md), [package.json](package.json) | Express 5 and SQLite posting MVP: API, schema, validation and integration tests. |
| UI | [web/](web/index.html), [tokens](web/css/tokens.css), [root entry](index.html) | Current UI, plain ES modules served by Express; posting and the paged feed use the SQLite-backed API. |
| Prototype | [HTML](.docs/02-design/prototype/index.html), [CSS](.docs/02-design/prototype/styles.css), [JS](.docs/02-design/prototype/app.js) | Earlier design reference; not served. |
| Diagrams | [diagrams.md](.docs/02-design/diagrams.md), [context](.docs/02-design/diagrams/JoinGun%20Context%20Diagram.png), [use cases](.docs/02-design/diagrams/JoinGun%20Use%20Cases%20Diagram.png), [architecture](.docs/02-design/diagrams/JoinGun%20Architecture%20Diagram.png), [activity](.docs/02-design/diagrams/JoinGun%20Activity%20Diagram.png) | Mermaid source of D1–D4 drawn from the code (draft); the PNGs are older conceptual drawings and the architecture PNG is not an implementation inventory. |
| Original records | [original rules](%E0%B9%80%E0%B8%AD%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3/Join%20gun%20rule.md), [English spec](%E0%B9%80%E0%B8%AD%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3/Requirement_Spec_EN.md), [proposal PDF](%E0%B9%80%E0%B8%AD%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3/JoinGun%20proposal.pdf), [earlier proposal PDF](%E0%B9%80%E0%B8%AD%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3/proposal.pdf), [backlog PDF](%E0%B9%80%E0%B8%AD%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3/JoinGun%20Backlog.md.pdf) | Original/reference copies; edit working files under `.docs/` and root `rule.md` only after asking. |
| Course guidance | [submission checklist](%E0%B9%80%E0%B8%AD%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3/joingun.pdf), [M1](%E0%B9%80%E0%B8%AD%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3/slide/M1-choosing-your-problem.pdf), [W2](%E0%B9%80%E0%B8%AD%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3/slide/Week%202%20%E2%80%94%20AI%20Ethics%2C%20PDPA%20%26%20IT%20Law%20%E2%80%94%201305493.pdf), [W3](%E0%B9%80%E0%B8%AD%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3/slide/Week%203%20%E2%80%94%20Requirements%20%E2%86%92%20Backlog%20with%20AI%20Agents%20%26%20Skills%20%E2%80%94%201305493.pdf), [W4](%E0%B9%80%E0%B8%AD%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3/slide/W4%20%E2%80%94%20Design%20with%20Agents%20%E2%80%94%20Case%20Study%20%E2%80%94%201305493.pdf), [W5 gate](%E0%B9%80%E0%B8%AD%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3/slide/W5-Class-2569.pdf), [W6 build](%E0%B9%80%E0%B8%AD%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3/slide/W6-Class-2569%20%281%29.pdf), [spec to MVP](%E0%B9%80%E0%B8%AD%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3/slide/CoffeeAI-Spec-to-MVP-2569.pdf) | Assignment instructions and slides, not implementation evidence. |

## Known gaps and conflicts in the supplied project

Recheck these observations against the repository before acting; they describe the supplied project snapshot.

- `.docs/02-design/diagrams.md` holds D1–D4 as editable Mermaid, drafted from build 0.3.0 on 2026-10-28 and not yet reviewed by the team. The four PNGs in `.docs/02-design/diagrams/` are older and disagree with it (for example Google Maps, an external AI engine, an admin who posts activities); redraw them from `diagrams.md`.
- The proposal leaves the technical stack unspecified, although the posting MVP uses Node.js, Express and SQLite. The context diagram mentions Google Maps, while the UI uses Leaflet and OpenStreetMap; confirm the target before editing an architecture description.
- Backlog item 2.4 (joining and leaving) is implemented, but the specification still has no separate join/leave functional requirement or acceptance criteria; the behaviour follows the user journey and team decisions recorded in `server/README.md`.
- The backlog preserves 22 row estimates totaling **117 points**; its original PDF summary says **113 points**. Do not silently change either number.
- The [evidence log](.docs/01-requirements/evidence-log.md) holds only a 5-response questionnaire (2026-09-07/08); no interviews are logged. `.claude/agents/requirement-writer.md` and `.claude/skills/audit-backlog/SKILL.md` are not in this archive. Do not claim an interview or backlog audit happened.
- Posts, location consent, post-creation audit entries, terms acceptance records and login/logout logs are stored per signed-in user; posts from before accounts existed belong to `demo-student`. Account deletion, data export and a daily purge of deleted-account archives exist, but whole-database encryption, a written retention schedule, Web Push, a trained AI model, and legal compliance are not provided (recommendations are a transparent points model). Email verification shows control of an `.ac.th` address, not a person's identity. Treat `rule.md` as project guidance requiring verification, not a legal opinion.

## Local viewing

When the user authorizes running it, use Node.js 22.13+ and run `npm ci` then `npm start` from the repository root, and open `http://127.0.0.1:3000`. Run `npm install` after pulling (nodemailer and `@zip.js/zip.js` are dependencies). Fill `GMAIL_USER` and `GMAIL_APP_PASSWORD` in `.env` for real email; without it, sign-in codes print to the server console. `npm test` runs the API and database integration tests. Opening the HTML file directly has no backend and shows a connection message. Saved posts persist in `data/joingun.sqlite`. Map tiles require access to external Leaflet/OpenStreetMap resources.
