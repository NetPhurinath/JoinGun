# JoinGun — Access Control (ACL)

Who can do what in pilot build 0.3.0, taken from `server/README.md`, `DECISIONS.md` and [test-plan.md](.docs/03-testing/test-plan.md) §4.6. Every "Cannot" is enforced by the server, not only by hiding a button: the L1 tests call the API directly. Checked 2026-10-28 by reading the code and the test plan; the "Test" column says where it was tested.

## Roles

| Role | Who |
| --- | --- |
| Visitor | Not signed in |
| Student | Signed in with an `.ac.th` email code, terms accepted and profile finished |
| Member | A student who joined a given activity |
| Host | The student who posted a given activity (counted as its first participant) |
| Blocked person | A student someone else blocked (relative to the blocker) |
| Suspended user | A student suspended by a moderator |
| Moderator | A student named in `MODERATOR_EMAILS` or by `npm run moderator` |

## Table

| Role | Can | Cannot | Test |
| --- | --- | --- | --- |
| Visitor | Read the feed and activity details; read public profile fields (name, username, bio, posts); read terms, privacy and safety pages; request a sign-in code | Post, join, leave, report, block, befriend; see year, interests or activity history; see participant names | TC-ACL-01 |
| Student (account not finished) | Accept terms, finish the profile, sign out | Anything that needs a finished account (403 before terms or profile) | TC-ACC-03, 05 |
| Student | Post text and activities; edit and delete own posts; join and leave; report posts; block and unblock; send, accept, decline and cancel friend requests; set history visibility; turn recommendations on or off; download own data; delete own account | Edit or delete other people's posts; report own post; see participants of activities they are not in; see history the owner hid (F5); see anyone's email | TC-ACL-02 |
| Member | Everything a student can; see the participant list (names and usernames, no email); see a cancelled activity they belonged to; leave before the start | Leave after the start; join a full, started or cancelled activity | TC-JOIN-03, 04, 05 |
| Host | Edit or cancel own activity before it starts; see participants; get join and leave notifications | Leave own activity; reduce capacity below the current members; edit after the start; change the post type | TC-ACL-03 |
| Blocked person | Use the app normally; still see the blocker's posts and join the same activities (decision 2026-10-15) | Send friend requests to the blocker; appear in the blocker's feed; learn that they were blocked | TC-ACL-04 |
| Suspended user | Read; change settings; download data; delete the account; send one appeal at a time | Post, edit, join, leave, send friend requests | TC-ACL-05 |
| Moderator | Everything a student can; review reports; dismiss, remove a post or suspend with a reason shown to the user; lift or uphold appeals; close recommendation reviews | See emails; be suspended by another moderator; act without a record (every decision goes to `report_reviews` and `action_logs`) | TC-ACL-06, TC-SAFE-09 |

## Data no role can see through the app

- Email addresses of other users (stored encrypted; only in the owner's own data download).
- Who reported a post (never shown to the reported person).
- Audit, consent and login logs (not exposed by any API except the owner's own entries in their data download).

## Not covered

- No admin role beyond moderator; database access on the server is outside the app's control.
- Access on a real phone (Android app) has not been tested.
