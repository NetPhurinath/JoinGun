# JoinGun — Product Backlog

Transcribed from the [original backlog](<../../เอกสาร/JoinGun Backlog.md.pdf>), preserving task IDs, task names, priorities, story points, and statuses. All assignee fields in the source are blank.

The Trace column maps items to the [Requirement Spec](01-spec/20260908-01-joingun.md) and [rule.md](../../rule.md). These mappings document identified sources, not a completed audit: the supplied files contain no interview evidence log or Pain IDs.

## Backlog Items

| Feature | ID | Task | Original Priority | Points | Status | Trace / Gaps |
| --- | --- | --- | --- | --- | --- | --- |
| Auth & User Mgmt | 1.1 | User Sign-up with University Email | High | 5 | Backlog | F1 (changed 2026-10-10: any `.ac.th` email; task name kept from the source PDF) |
| Auth & User Mgmt | 1.2 | Email Verification Process | High | 3 | Backlog | F1, NFR3 |
| Auth & User Mgmt | 1.3 | User Profile Creation & Management | High | 5 | Backlog | Scope workflow 2; no separate functional requirement ID |
| Activity Management | 2.1 | Post New Activity | High | 8 | Backlog | F2 |
| Activity Management | 2.2 | View Activity Feed/Browse Activities | High | 5 | Backlog | F3, NFR1 |
| Activity Management | 2.3 | Activity Details Page | High | 5 | Backlog | Supports F3 and Scope workflow 4; no separate functional requirement ID |
| Activity Management | 2.4 | Join/Leave Activities | High | 5 | Backlog | Join: Scope workflow 4; Leave: only in backlog/rule; no separate functional requirement ID |
| Location & Maps | 3.1 | Map Integration & Location Pinning | High | 8 | Backlog | F2, NFR2, LR1 |
| Location & Maps | 3.2 | Location Search & Navigation | Medium | 5 | Backlog | Supports F2; navigation has no explicit functional requirement |
| Notifications | 4.1 | Activity Reminders & Notifications | High | 5 | Backlog | F4: Should |
| Notifications | 4.2 | Notification Settings & Preferences | Medium | 3 | Backlog | Supports F4; no separate functional requirement ID |
| Social Features | 5.1 | Friend System - Add Friends | Medium | 5 | Backlog | Proposal §4; no functional requirement ID |
| Social Features | 5.2 | Friend System - Manage Friends | Medium | 3 | Backlog | Proposal §4; no functional requirement ID |
| Social Features | 5.3 | User Blocking & Safety Reports | High | 5 | Backlog | rule: Computer Crime Act reporting/blocking provision; no functional requirement ID |
| AI Recommendations | 6.1 | Activity Recommendation Engine | High | 13 | Backlog | F6: Could, LR4–LR5 |
| AI Recommendations | 6.2 | Personalized Activity Feed | High | 5 | Backlog | F6: Could, LR4–LR5 |
| AI Recommendations | 6.3 | Interest-Based Content | Medium | 3 | Backlog | F6: Could |
| Platform Core | 7.1 | Home/Dashboard Screen | High | 5 | Backlog | Supports F3 |
| Platform Core | 7.2 | Search & Filtering System | High | 5 | Backlog | Scope workflow 4; no separate functional requirement ID |
| Platform Core | 7.3 | User Settings & Account Management | Medium | 5 | Backlog | F5, LR2; clarify privacy and deletion scope |
| Compliance & Security | 8.1 | Privacy Policy & Data Consent | High | 3 | Backlog | LR1; consent evidence in rule has no separate legal requirement ID |
| Compliance & Security | 8.2 | Security & Data Protection | High | 8 | Backlog | LR2–LR3, LR5; define acceptance criteria for logging, deletion, and security |

## Development Priorities and Outstanding Review Items

- Selected core workflow: **Join an activity from the feed**, referencing 2.2–2.4 and 7.1–7.2. Prerequisites include verified accounts, available activities, and meeting locations, with consent and logging as required by the project rules.
- Use the Spec's MoSCoW priorities for development sequencing: F1–F3 are Must, F4–F5 are Should, F6 is Could, and F7 is Won't. High/Medium values in the table are preserved from the PDF and have not yet been reconciled with the Spec.
- Before submission, add evidence-based user stories and requirement IDs for joining/leaving and items currently linked only to the Scope or Proposal. Do not treat F3 as a complete specification of joining/leaving behavior.
- Link every item to a Pain ID from an actual evidence log and add measurable acceptance criteria. The source PDF lists task names but does not provide full user stories or acceptance criteria.
- Review coverage of system-level NFR4 and the details of F5/LR2 in items 7.3 and 8.2. Adding a trace reference alone does not establish compliance or a passed audit.
- See [Legal traceability](01-spec/20260908-02-legal-traceability.md) for outstanding compliance gaps.
- The 22 items total **117 points (High 93, Medium 24)**, whereas the PDF summary states 113 points (High 92, Medium 21). This version preserves the original row values; the team must confirm whether individual rows or the summary need correction before submission.
