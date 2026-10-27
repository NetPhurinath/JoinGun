# JoinGun — Existing UI with Posting Backend

The existing mobile-first design, activity cards, create dialog and map presentation now use the Express/SQLite posting MVP. Root `index.html` opens this interface.

## File responsibilities

There is one frontend implementation, not two:

| File | Responsibility |
| --- | --- |
| Root `index.html` | Entry point that redirects to the existing UI; contains no duplicate application UI |
| `prototype/index.html` | Page shell and post/filter dialogs |
| `prototype/app.js` | Browser UI rendering and requests to `/api/posts` |
| `prototype/styles.css` | Shared styles for the active posting UI |
| `prototype.md` (this file) | Documentation, not another application |
| `server/app.js` | Express API and explicit UI asset routes; not browser code |

Run and edit the frontend in `prototype/`. Do not copy it into `server/public/` or duplicate the page into root `index.html`. The `.docs/02-design/` path is retained for the course deliverable structure.

## Run and verify manually

1. Run `npm ci` and `npm start` from the repository root. Open `http://127.0.0.1:3000`.
2. Select **สร้างโพสต์**, choose **ข้อความทั่วไป**, enter content and publish. The saved post appears in the feed.
3. Create another post, choose **กิจกรรม**, and enter content, title, category, future date/time, location, meeting details and capacity. Optionally click the map to choose a pin.
4. Select the separate location consent checkbox and publish. Open **ดูรายละเอียด** to inspect saved activity fields and the selected pin.
5. Reload the browser and confirm both posts remain. Search and filter by category/date; clear filters to show all posts.

Failure checks: publishing without required fields or consent must not save a post; server validation errors retain the form; unavailable backend shows a retry message. Internet is required for Leaflet/tiles, but a text-only meeting location can still be posted without a map pin. Dates are interpreted/displayed in Asia/Bangkok.

## Scope

Only posting and viewing are connected to the backend. The fixed actor is **Demo Student**, not a verified real account. Simulated auth, join and reminder flows from the previous prototype are no longer displayed in this posting MVP. No signup, likes, comments or joining have been added.

The original design tokens and layout remain in `prototype/styles.css`. UI assets are served explicitly by Express; other `.docs` files and the database are not public. HTML opened directly or via GitHub Pages has no backend; use the local server URL.

See [server documentation](../../server/README.md) for schema, validation, API and tests, and [design system](design-system.md) for the UI style. Earlier [user journey](user-journey.md) describes the joining design, whereas the user's current MVP scope is posting.
