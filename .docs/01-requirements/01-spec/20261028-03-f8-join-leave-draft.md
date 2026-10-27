# JoinGun — Draft F8: Join and leave an activity

| Item | Value |
| --- | --- |
| Status | **Draft, not in the spec.** Proposed 2026-10-28 for the Product Owner (Chawin Thachai) to accept, change or reject. The spec ([20260908-01-joingun.md](20260908-01-joingun.md)) is unchanged. |
| Why | Joining is the selected core journey ("join an activity from the feed") and is built (backlog 2.4), but the spec has no functional requirement or acceptance criteria for it. F3 covers browsing only. |
| Source of the criteria | Behaviour already built and tested, from [server/README.md](../../../server/README.md) "Joining activities" and the team decisions of 2026-10-15. Nothing new is proposed beyond writing it down. |

## Proposed requirement

**F8 (Must, proposed):** As a student, I want to join an activity from the feed and leave it before it starts, so that I can take part with other students and free my place if my plans change.

Proposed priority Must because it is the core journey; F2 and F3 only make sense if people can join.

## Acceptance criteria

| AC | Given | When | Then | Rule / test |
| --- | --- | --- | --- | --- |
| AC1 | A signed-in student with a finished account, an activity that has not started, is not cancelled and has places left | They press "เข้าร่วมกิจกรรม" on the activity page and confirm | They become a member, the places-taken count goes up by one, and the confirmation shows the title, time and meeting point | TC-JOIN-07 (E2E) |
| AC2 | The student has never given participation-history consent | They try to join | A separate consent box, unticked by default, must be ticked first; without it the join is refused (`consent-required`). The consent is stored with `user_id`, UTC time, IP and version `participation-v1`, apart from location and terms consent | LR1; TC-JOIN-01 |
| AC3 | An activity with capacity N | Members join | The host counts as the first participant, so N − 1 others can join; when two people try for the last place at once, only one gets it | TC-JOIN-02 |
| AC4 | The activity is full, has started, is cancelled, or is a text post | Anyone tries to join | The join is refused with a Thai message saying why | TC-JOIN-05; E2E "a full activity cannot be joined" |
| AC5 | A member, before the start time | They press leave | They are no longer a member and the place is free again. After the start, leaving is refused. The host cannot leave their own activity (they cancel it instead) | TC-JOIN-03 |
| AC6 | A member who left, with consent still active | They join again | No new consent is asked. If they withdrew the consent, the next join asks again; past joins stay as they are | TC-JOIN-03, TC-SAFE-03 |
| AC7 | Anyone who is not the host or a current member | They ask for the participant list | It is refused. Host and members see display name and username only, never email | rule.md PDPA; TC-JOIN-04 |
| AC8 | Any join or leave | It succeeds | An audit entry (`activity.join` / `activity.leave`) is written with `user_id`, exact UTC time, IP and action type, and is never deleted | LR3, rule.md CCA; TC-JOIN-06 |
| AC9 | A signed-out visitor or a suspended account | They try to join or leave | Refused (401 / 403) | TC-ACL-01, TC-ACL-05 |
| AC10 | A join or leave | It succeeds | The host gets an in-app notification | F4; TC-NOT-* |

## Out of scope for F8

- Host approval of participants. `rule.md` asks for an unalterable approval record **if** approval exists; joining is instant, so no approval step is added.
- Waiting lists, check-in at the meeting place, and chat with members (F7 Won't).

## Trace

| Link | Item |
| --- | --- |
| Pain evidence | Questionnaire Q5: 3/5 cannot find people to join ([evidence-log.md](../evidence-log.md) §4); competitor research findings 1, 2 and 10 ([competitor-research.md](../competitor-research.md) §5). No interview quote. |
| Rules | LR1, LR3; rule.md PDPA (participation consent), CCA (join/leave log, host approval is conditional) |
| Backlog | 2.4 Join/Leave Activities |
| Design | [User journey](../../02-design/user-journey.md) steps 3–5; [diagrams.md](../../02-design/diagrams.md) D2 ★ Join, Leave, See participants; D4, D4b |
| Code | `server/participation.js`; `web/js/detail.js` (route `#/activity/<id>`) |
| Tests | TC-JOIN-01 … TC-JOIN-07 in [test-plan.md](../../03-testing/test-plan.md) |

## For the Product Owner to decide

1. Accept F8 as written, change it, or reject it.
2. If accepted, add it to the spec as F8 and replace "Join: Scope workflow 4; no separate functional requirement ID" in backlog 2.4 with F8.
3. Confirm the priority (Must proposed).
