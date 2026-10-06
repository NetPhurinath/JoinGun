# JoinGun Posting MVP

Scope authorized on 2026-10-07: create **text posts** and **activity posts**, and read them in a newest-first feed. Node.js + Express + SQLite (database choice confirmed by the user). The application uses the existing JoinGun UI in `.docs/02-design/prototype/`, opened through the root `index.html`.

## Run

Requires Node.js 22.13 or newer. The built-in `node:sqlite` module may print an experimental warning on Node 22.

```sh
npm ci
npm start
```

Open `http://127.0.0.1:3000`. The server creates `data/joingun.sqlite` and its tables automatically. Posts survive server restarts. Use `npm run dev` for automatic restarts and `npm test` for integration tests. Run commands from the repository root.

Optional environment variables: `PORT` (default 3000), `DATABASE_PATH` (default project-root `data/joingun.sqlite`). A relative database path is resolved from the current working directory. Database files and dependencies are excluded from Git.

## API

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/health` | Server/database readiness |
| POST | `/api/posts` | Create a post; 201 with the saved record and Location header |
| GET | `/api/posts?limit=20&before=123` | `{items, nextCursor}`; maximum 100 items; omit before for the first page |
| GET | `/api/posts/:id` | One post, or 404 |

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

Optional activity fields: `category` (`sport`, `study`, `cafe`; default `sport`), `meeting` (1–1000 characters when supplied), and numeric `lat`/`lng` (must be supplied together within geographic bounds). Existing SQLite databases are migrated additively without deleting posts.

Content: 1–5000 characters. Activity title: 1–120; location: 1–300; capacity: integer 2–1000 including the host. Activity timestamps must be future ISO timestamps with a timezone and are stored as UTC. The web form interprets the selected time as Asia/Bangkok and displays timestamps in that timezone. Text posts cannot include activity fields or location consent.

## Database

- `posts`: stable UUID, ordering sequence, demo author ID, type, content and UTC creation time.
- `activities`: activity details in a one-to-one relationship with a post.
- `consent_records`: activity location opt-in, post ID, demo user ID, timestamp, source IP and `location-v1` notice version.
- `audit_logs`: post creation with actor, source IP and timestamp. No deletion or automatic pruning is implemented.

Post, activity, consent and audit inserts are one transaction. Foreign keys, checks, prepared statements and cursor pagination protect data integrity. Audit and consent records are not exposed by the feed API. The server explicitly serves the root `index.html` and the three existing UI assets under `.docs/02-design/prototype/`, never the database or other repository files.

## MVP boundaries

This is a **local development demo**, bound to `127.0.0.1`, using a single server-assigned `demo-student` actor. It does not authenticate or verify a real student. Do not expose it publicly or use real personal data yet. No signup, passwords, likes, comments, joining, editing/deleting posts, media uploads, AI or notifications are included.

Meeting locations require a separate explicit opt-in on each activity post under the existing project rules; GPS is not collected. The app stores plain text posts and escapes all user content before placing it in HTML. Map markers do not render user HTML. The database is not encrypted. Real-user identity, access control, encrypted storage, retention/deletion policy, consent withdrawal and other production compliance work remain outstanding; the demo audit actor is not proof of a real user's identity. This implementation does not claim complete compliance with `rule.md` or the earlier production NFRs.

## Verification

`npm test` uses real HTTP requests to Express and real SQLite databases. Tests cover both post types, persistence after reopening, consent validation, malformed requests, field limits, SQL-like input, pagination under new inserts, private-file access and transactional rollback. Tests also cover original UI asset routes, optional map/category fields and migration of a database created by the earlier MVP. Browser checks confirmed that the original feed displays existing SQLite posts and the composer switches between text and activity fields. Publishing was tested through real HTTP integration tests; a full browser submission flow and real mobile devices have not been verified.

Implementation references: [Express API](https://expressjs.com/en/api/) and [Node.js SQLite API](https://nodejs.org/api/sqlite.html).

## Existing UI integration

Start Express and open `http://127.0.0.1:3000`. The root index opens the existing JoinGun interface. Create either post type in its existing dialog. Search, category/date filters and activity details use API data; refresh retains saved posts. Leaflet and map tiles still require internet; posting a textual meeting location works if maps are unavailable. A map pin is optional and is saved only after location consent. The header identifies the fixed demo actor; obsolete simulated login/join controls are no longer shown. Opening HTML directly or through GitHub Pages cannot run the backend and displays a server connection message.
