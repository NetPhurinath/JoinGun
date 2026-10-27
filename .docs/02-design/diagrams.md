# JoinGun — Diagrams (D1–D4)

| Item | Value |
| --- | --- |
| Status | Draft, 2026-10-28. Drawn from the code of build 0.3.0 (`server/`, `web/`, `capacitor.config.json`). Needs team review. |
| Core workflow | **Join an activity from the feed** ([user journey](user-journey.md), [feature list](feature-list.md)) |
| Inputs | [Requirement spec](../01-requirements/01-spec/20260908-01-joingun.md), [backlog](../01-requirements/backlog.md), [server README](../../server/README.md), [rule.md](../../rule.md) |
| Source format | Mermaid. Each diagram below is the editable source; GitHub and VS Code render it directly. |
| PNG files | The four PNGs in [diagrams/](diagrams/) are the earlier drawings. They disagree with the build in several places (see [Differences from the PNG diagrams](#differences-from-the-png-diagrams)) and should be redrawn from this file. |

Names used in every diagram:

- **Student** — a person signed in with a verified `.ac.th` email address.
- **Host** — the Student who created a given activity. Not a separate account type: the server stores it per activity (`participants.role = 'host'`).
- **Moderator** — an account with `users.role = 'moderator'`, given through `MODERATOR_EMAILS` or `npm run moderator`.

## D1 — System Context

The system as one box, with the people and outside systems it talks to. The database and the recommendation model are inside JoinGun, so they are not drawn here.

```mermaid
flowchart LR
    student["Student<br/>(Host when they post an activity)"]
    moderator["Moderator"]
    joingun["JoinGun<br/>web app and Android app"]
    gmail["Gmail SMTP<br/>(sends email)"]
    mailbox["Student's university mailbox<br/>(.ac.th)"]
    osm["OpenStreetMap tiles<br/>(map display via Leaflet)"]
    nominatim["OpenStreetMap Nominatim<br/>(place search)"]
    android["Android OS<br/>(local notifications)"]

    student -- "posts, browses, joins, leaves, reports" --> joingun
    joingun -- "feed, activity details, notifications" --> student
    moderator -- "reviews reports and appeals" --> joingun
    joingun -- "sign-in codes, optional reminder email" --> gmail
    gmail -- "delivers" --> mailbox
    mailbox -- "student reads the code" --> student
    joingun -- "loads map tiles" --> osm
    joingun -- "searches places" --> nominatim
    joingun -- "schedules activity reminders" --> android
    android -- "shows the reminder" --> student
```

## D2 — Use Cases

Mermaid has no use case diagram type, so this uses a flowchart with UML conventions: actors outside the system box, use cases as ovals inside it, a plain line between an actor and a use case, and dashed arrows for «include» and «extend». The core use case is marked ★.

```mermaid
flowchart LR
    student["Student"]
    host["Host<br/>(a Student who posted the activity)"]
    moderator["Moderator"]

    subgraph JoinGun
        direction TB
        signin(["Sign up / sign in with .ac.th email"])
        browse(["Browse, search and filter the feed"])
        details(["View activity details and map"])
        join(["★ Join an activity"])
        pconsent(["Give participation-history consent"])
        leave(["Leave an activity"])
        reminders(["Get reminders and notifications"])
        friends(["Add and manage friends"])
        privacy(["Set activity-history privacy"])
        report(["Report a post / block a user"])
        recommend(["Get activity recommendations"])
        aiconsent(["Give AI recommendation consent"])
        mydata(["Download my data / delete my account"])
        appeal(["Appeal a suspension"])
        post(["Post an activity"])
        lconsent(["Give meeting-location consent"])
        pin(["Pin the meeting place / search a place"])
        manage(["Edit or cancel own activity"])
        participants(["See participants"])
        reviewreports(["Review reports"])
        suspend(["Suspend or restore an account"])
        appeals(["Decide appeals and review requests"])
    end

    student --- signin
    student --- browse
    student --- details
    student --- join
    student --- leave
    student --- reminders
    student --- friends
    student --- privacy
    student --- report
    student --- recommend
    student --- mydata
    student --- appeal

    host -- "is a" --> student
    host --- post
    host --- manage
    host --- participants

    moderator --- reviewreports
    moderator --- suspend
    moderator --- appeals

    join -. "«include» (first join only)" .-> pconsent
    recommend -. "«include»" .-> aiconsent
    post -. "«include»" .-> lconsent
    pin -. "«extend»" .-> post
```

| Use case | Requirement | Backlog | Code (entry point) |
| --- | --- | --- | --- |
| Sign up / sign in with .ac.th email | F1, NFR3 | 1.1, 1.2, 8.1 | `POST /api/auth/request-code`, `/api/auth/verify`, `/api/auth/terms` |
| Browse, search and filter the feed | F3, NFR1 | 2.2, 7.1, 7.2 | `GET /api/posts?category=&date=&q=` |
| View activity details and map | F3, F2 | 2.3, 3.1 | `GET /api/posts/:id`, `web/js/detail.js`, `web/js/map.js` |
| ★ Join an activity | Scope workflow 4, LR1 (no separate F-ID) | 2.4 | `POST /api/activities/:id/join` |
| Give participation-history consent | LR1 | 8.1 | `user_consents` (`participation-history`, `participation-v1`) |
| Leave an activity | No F-ID (backlog and `rule.md` only) | 2.4 | `POST /api/activities/:id/leave` |
| Get reminders and notifications | F4 | 4.1, 4.2 | `GET /api/notifications`, `/api/me/notification-settings`, `web/js/native.js` |
| Add and manage friends | No F-ID (proposal §4) | 5.1, 5.2 | `/api/friends`, `/api/friends/requests` |
| Set activity-history privacy | F5 | 7.3 | `PUT /api/me/privacy` |
| Report a post / block a user | `rule.md` (Computer Crime Act) | 5.3 | `POST /api/reports`, `/api/me/blocks` |
| Get activity recommendations | F6, LR4, LR5 | 6.1, 6.2, 6.3 | `GET /api/recommendations` |
| Give AI recommendation consent | LR1, LR4 | 8.1 | `POST /api/me/consents/ai` |
| Download my data / delete my account | LR2, `rule.md` PDPA | 7.3, 8.2 | `POST /api/me/export`, `/api/me/delete` |
| Appeal a suspension | `rule.md` (human review of automated decisions) | No backlog item | `POST /api/me/appeal` |
| Post an activity | F2 | 2.1 | `POST /api/posts` |
| Give meeting-location consent | LR1 | 3.1, 8.1 | `locationConsent: true` is required for every activity post (`server/validation.js`) |
| Pin the meeting place / search a place | F2, NFR2 | 3.1, 3.2 | `activity.lat`/`lng`, Nominatim search in `web/js/map.js` |
| Edit or cancel own activity | F2 | 2.1 | `PUT /api/posts/:id`, `DELETE /api/posts/:id` |
| See participants | No F-ID (team decision 2026-10-15) | 2.4 | `GET /api/activities/:id/participants` |
| Review reports | `rule.md` (report records) | No backlog item | `GET /api/mod/reports`, `POST /api/mod/reports/:id/review` |
| Suspend or restore an account | `rule.md` (human review) | No backlog item | `POST /api/mod/reports/:id/review` |
| Decide appeals and review requests | `rule.md`, LR4 (route to human review) | No backlog item | `/api/mod/appeals/:id/resolve` |

## D3 — High-level Architecture

The big parts and which way calls go. The duties from `rule.md` show up as their own data groups: consent records (PDPA, ETA) and logs (Computer Crime Act §26).

```mermaid
flowchart TB
    subgraph client["Client"]
        direction LR
        browser["Web browser<br/>web/ — plain ES modules, Leaflet"]
        app["Android app (Capacitor)<br/>WebView loads the same web/ pages via server.url<br/>+ Local Notifications plugin"]
    end

    subgraph server["Server — Node.js 22, Express 5 (server/)"]
        direction TB
        security["Security middleware<br/>headers, CSP, rate limits (app.js, security.js)"]
        subgraph modules["API modules"]
            direction LR
            auth["Auth and accounts<br/>auth.js, accounts.js, mailer.js"]
            posts["Posts and feed<br/>database.js, validation.js"]
            participation["Participation<br/>participation.js"]
            social["Friends, profiles, blocks<br/>social.js"]
            notifications["Notifications<br/>notifications.js"]
            recommend["Recommendations<br/>recommend.js (points model)"]
            moderation["Moderation<br/>moderation.js"]
            accountdata["Data download and deletion<br/>account-data.js, profile-crypto.js"]
        end
        jobs["Maintenance jobs (maintenance.js)<br/>every minute: reminders, completion<br/>daily: purge archived accounts, backup"]
        security --> modules
    end

    subgraph data["Data — one SQLite file, data/joingun.sqlite (node:sqlite)"]
        direction LR
        accounts[("Accounts<br/>users, user_emails, login_codes,<br/>sessions, deleted_accounts")]
        activities[("Activities<br/>posts, activities, participants")]
        consents[("Consent records<br/>terms_acceptances, consent_records,<br/>user_consents, consent_withdrawals")]
        logs[("Logs<br/>audit_logs, auth_logs, action_logs")]
        socialdata[("Social and notifications<br/>friendships, blocks, notifications,<br/>recommendation_feedback")]
        moddata[("Moderation<br/>reports, report_reviews, appeals")]
    end

    backup[("Daily backup<br/>VACUUM INTO")]

    subgraph external["External services"]
        direction LR
        gmail["Gmail SMTP"]
        osm["OpenStreetMap tiles"]
        nominatim["Nominatim"]
        unpkg["unpkg (Leaflet files)"]
    end

    browser -- "JSON over HTTP /api<br/>(HTTPS after deployment)" --> security
    app -- "JSON over HTTP /api" --> security
    modules -- "SQL, one transaction per action" --> data
    jobs --> data
    jobs -- "copies" --> backup
    auth -- "sign-in code" --> gmail
    jobs -- "reminder email (opt-in)" --> gmail
    browser -- "map tiles" --> osm
    browser -- "place search" --> nominatim
    browser -- "Leaflet script and CSS" --> unpkg

    classDef duty fill:#fff4d6,stroke:#b8860b
    class consents,logs duty
```

Notes:

- The server binds to `127.0.0.1` by default and serves only `web/`; it is not deployed yet, so there is no HTTPS (delivery step 7).
- Stored email addresses (`security.js`) and profile year, interests and bio (`profile-crypto.js`) are encrypted at field level. The database file as a whole is not encrypted.
- Server-sent push (Firebase) is not built. Reminders reach people as in-app notifications, optional email and, in the Android app, phone-scheduled local notifications.

## D4 — Activity: join an activity from the feed

The core workflow, step by step. It follows the five steps of the [user journey](user-journey.md) and the checks in `web/js/detail.js` and `participation.join` in `server/participation.js`. The Student is already signed in (the journey starts after sign-up); a signed-out visitor who taps join is sent to sign in first.

```mermaid
flowchart TD
    start((" ")) --> feed["Open the กิจกรรม feed<br/>(journey 1)"]
    feed --> filter["Tap ตัวกรอง, choose category and date,<br/>tap แสดงกิจกรรม (journey 2)"]
    filter --> details["Tap ดูรายละเอียด:<br/>host, date, places left, map (journey 3)"]
    details --> interested{"Interested?"}
    interested -- "[no]" --> feed
    interested -- "[yes]" --> state{"Join button<br/>available?"}
    state -- "[started, full, host or already joined]" --> blocked["Button disabled or not shown<br/>(status shown instead)"]
    state -- "[open]" --> tap["Tap เข้าร่วมกิจกรรม"]
    tap --> sheet["Sheet ยืนยันการเข้าร่วม:<br/>summary and safety notice (journey 4)"]
    sheet --> hasconsent{"Participation consent<br/>already given?"}
    hasconsent -- "[no]" --> tick["Tick ยินยอมให้เก็บประวัติการเข้าร่วม…"]
    hasconsent -- "[yes]" --> consentmerge{ }
    tick --> consentmerge
    consentmerge --> confirm["Tap ยืนยันเข้าร่วม"]
    confirm --> server["Server, one transaction:<br/>check started → consent → full"]
    server --> ok{"Accepted?"}
    ok -- "[409 started / full / consent-required]" --> error["Show the error message,<br/>refresh the detail"]
    ok -- "[yes]" --> save["Save participant row, audit log activity.join,<br/>consent record if newly given; notify the Host"]
    save --> success["Show เข้าร่วมสำเร็จ, schedule phone reminders;<br/>detail shows เข้าร่วมแล้ว (journey 5)"]
    blocked --> endmerge{ }
    error --> endmerge
    success --> endmerge
    endmerge --> finish(((" ")))
```

### D4b — Sequence: the join request

The same core step as message order between the parts in D3. Solid arrows are calls, dashed arrows are returns.

```mermaid
sequenceDiagram
    actor Student
    participant UI as web/js/detail.js
    participant API as Express<br/>POST /api/activities/:id/join
    participant P as participation.join<br/>(participation.js)
    participant DB as SQLite
    participant N as notifier<br/>(notifications.js)

    Student->>UI: Tap ยืนยันเข้าร่วม (consent ticked if asked)
    UI->>API: POST {participationConsent: true} or {}
    API->>API: requireAccount, requireActive, rate limit
    API->>P: join(activityId, userId, ip, body)
    P->>DB: BEGIN IMMEDIATE
    P->>DB: read activity, membership, consent, joined count
    alt started, consent missing or full
        P->>DB: ROLLBACK
        P-->>API: ActivityError 409 (started / consent-required / full)
        API-->>UI: 409 {error, code}
        UI-->>Student: Error message, detail refreshed
    else accepted
        P->>DB: INSERT user_consents (first join only)
        P->>DB: INSERT or UPDATE participants
        P->>DB: INSERT audit_logs (activity.join, user, time, IP)
        P->>DB: COMMIT
        P-->>API: updated post
        API->>N: notify Host (activity.join)
        API-->>UI: 200 updated post
        UI-->>Student: เข้าร่วมสำเร็จ, status เข้าร่วมแล้ว
    end
```

## Consistency check

| Check | Result |
| --- | --- |
| Every actor in D1 appears in D2 | Student and Moderator appear in both; Host is shown in D2 as a kind of Student. |
| Every use case in D2 has a backlog item | All except Review reports, Suspend or restore, Decide appeals and Appeal a suspension, which come from `rule.md` (human review, report records) and have no backlog ID yet. |
| The core use case is central | ★ Join an activity in D2 is the workflow of D4 and D4b. |
| D4 follows the user journey | Journey steps 1–5 map to the D4 actions labelled (journey 1)–(journey 5), in the same order. |
| Every part D4/D4b calls is in D3 | Web browser (`web/`), security middleware, Participation, Notifications, SQLite tables `participants`, `user_consents`, `audit_logs` — all drawn in D3. |
| D3 matches the stack in use | Node.js, Express 5, SQLite, Leaflet/OpenStreetMap, Gmail SMTP and Capacitor, as recorded in `CLAUDE.md`. The proposal's stack section (5.3) is still empty. |

## Differences from the PNG diagrams

| PNG | This file (from the code) |
| --- | --- |
| Context: Google Maps location service | OpenStreetMap tiles through Leaflet, and Nominatim for place search. |
| Context: AI Recommendation Engine as an outside system | A points model inside the server (`recommend.js`); nothing leaves the server. |
| Context: Notification Service (Push/Email) | Gmail SMTP for email, in-app notifications and Android local notifications. There is no push service. |
| Context: Database Server as an outside system | SQLite inside JoinGun (D3). |
| Use cases: System Admin, who also posts new activities | Moderator, who reviews reports, suspensions and appeals. Posting is done by Students. |
| Use cases: Activity Host as a separate actor | A Student who created the activity. |
| Architecture: API Gateway, Admin Dashboard, Location Index, Activity Log & Cache | Not in the code. One Express server, a moderator screen inside `web/`, and one SQLite file. |
| Activity: one join step with no consent or full/started branches | Consent on first join, and the started/full checks the server makes. |

The PNGs are kept until the Designer redraws them; this file is the version to follow.
