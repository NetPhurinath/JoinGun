# Backlog audit — 2026-10-28

| Item | Value |
| --- | --- |
| Method | The `audit-backlog` skill (`.claude/skills/audit-backlog/SKILL.md`), run by Claude in the session that created it. The checks were run directly in that session, not by a separate `backlog-auditor` subagent, because new agent files load only in a new session. |
| Inputs | `backlog.md`, spec `20260908-01-joingun.md`, draft F8 `20261028-03-f8-join-leave-draft.md`, `rule.md`, `evidence-log.md`, `competitor-research.md`, `traceability.md`, `diagrams.md`, `server/README.md`, `DECISIONS.md`, `test-plan.md`, original `เอกสาร/JoinGun Backlog.md.pdf` (read only) |
| Changes made | None to the backlog, spec or rule.md. Findings only. |

## Results

| # | Check | Result | Details |
| --- | --- | --- | --- |
| 1 | Counts | **Finding** | 22 items in 8 features, same rows and points in `backlog.md` and the PDF. Rows add up to **117** (16 High = 93, 6 Medium = 24). The PDF's summary line says 113 (High 92, Medium 21). The PDF's own feature breakdown counts 16 High and 6 Medium tasks, matching the rows. The summary line is the error, not a row. |
| 2 | IDs | Pass | 1.1–8.2, all unique. |
| 3 | Requirement coverage | **Finding** | Every F1–F6 and LR1–LR5 has an item. **NFR4** (1,000 concurrent users) has none. F5 is covered only inside 7.3. F7 (Won't) correctly has none. |
| 4 | Priority match | **Finding** | 4.1 is High but F4 is Should. 6.1 and 6.2 are High but F6 is Could. 7.3 is Medium but carries LR2 (legal). 5.1, 5.2, 5.3 trace to no F, so their priority has no spec basis. |
| 5 | Evidence | **Finding** | `backlog.md` cites no pain ID on any of the 22 items. Using `traceability.md`, 18 items link to questionnaire (`EL-`) or Path B (`CR-`) findings; 4 have none (1.3, 3.2, 6.3, 7.1). No item has interview evidence. |
| 6 | Acceptance criteria | **Finding** | None of the 22 items has acceptance criteria in the backlog. Only 2.4 has drafted criteria (F8 draft). The test plan's expected results partly fill this but are not acceptance criteria agreed by the PO. |
| 7 | Status | **Finding** | All 22 rows say "Backlog". `server/README.md` describes all 22 as built in pilot build 0.3.0 (4.1 without server push; 6.1 as a points model). |
| 8 | Built but not in backlog | **Finding** | Moderation (review, remove, suspend, appeals), Download My Data, safety guidance page, activity completion log, Android app, `perf` and `bias-report` scripts, add-to-calendar. |
| 9 | rule.md coverage | **Finding** | Provisions built without a backlog item or LR: data download, human review of suspensions, safety guidance for meeting strangers, report/block retention, terms acceptance records (only via 8.1). Host approval: not built, so not applicable. |
| 10 | Tests | Pass with gaps | Every built item has at least one test case. Not run: TC-SAFE-07 (no ID/address/religion fields), TC-SAFE-08 (safety text), manual part of TC-SAFE-04 (7-Zip), all real-phone checks; NFR1 on 4G, NFR2 (10 m) and NFR3 (real Gmail) not measured. |

## Findings ranked by impact

1. **The core journey has no requirement.** 2.4 traces to "Scope workflow 4" only. Fix: PO accepts or changes draft F8.
2. **No acceptance criteria and no pain IDs in the backlog.** The W3/W5 trace chain breaks at the backlog for 22/22 items. `traceability.md` supplies evidence links outside the backlog; the backlog itself is unchanged.
3. **Status column is stale.** Every item reads "Backlog" although built.
4. **Priorities disagree with MoSCoW** for 4.1, 6.1, 6.2, 7.3; F6 (Could) was built before it was needed.
5. **Point total 117 vs 113.** The rows and the PDF's task counts both support 117.
6. **Built work outside the backlog** (finding 8) and **NFR4 without an item.**

## Decisions needed

| Decision | Who | Audit's suggestion |
| --- | --- | --- |
| Accept F8 for join/leave | Product Owner | Accept as Must; it only writes down built behaviour |
| Point total | Product Owner | 117: the rows are the same in both copies and the PDF's own task counts match them |
| Replace High/Medium with MoSCoW | Product Owner | Use the spec's MoSCoW per item; mark 6.x Could, 4.x Should |
| Update the Status column | Product Owner | "Built (pilot 0.3.0)" with a note for 4.1 and 6.1 |
| Add backlog items for finding 8 and NFR4 | Product Owner | Add as items with IDs 8.3+ / 9.x; mark them "built ahead" |
| Keep or hide F4–F6 until the pilot | Product Owner | Keep, labelled "built ahead of priority" |

## Not checked

- Whether the original PDF's 113 was a deliberate change to a row that the PDF table does not show.
- Story-point sizes themselves (no velocity data).
- Diagram correctness: `diagrams.md` is a draft not yet reviewed by the team.
- Anything on a real phone.
