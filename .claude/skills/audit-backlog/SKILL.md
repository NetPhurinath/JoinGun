---
name: audit-backlog
description: Checklist for auditing the JoinGun backlog against the spec, rule.md, evidence, design and code, with results written to .docs/05-log/. Use when asked to audit, check or review the backlog.
---

# Audit the backlog

Inputs: `.docs/01-requirements/backlog.md`, the spec in `01-spec/`, `rule.md`, `evidence-log.md`, `competitor-research.md`, `traceability.md`, `.docs/02-design/diagrams.md`, `server/README.md`, `DECISIONS.md`, `.docs/03-testing/test-plan.md`, and the original `เอกสาร/JoinGun Backlog.md.pdf` (read only).

Run every check and record pass / finding / not checked:

1. **Counts.** Number of items and features; sum of points per priority and overall; compare with the summary in the original PDF. Report differences, do not correct them.
2. **IDs.** Every item has a unique ID; every trace cites an F/NFR/LR or says it has none.
3. **Requirement coverage.** Every F, NFR and LR in the spec has at least one backlog item (F7 Won't excepted).
4. **Priority match.** Compare each item's High/Medium with the MoSCoW priority of the requirement it traces to.
5. **Evidence.** Each item links to a logged pain (`EL-`, `CR-`, interview code). Count items with none.
6. **Acceptance criteria.** Each item has testable acceptance criteria, in the backlog or in a requirement draft.
7. **Status.** The Status column matches what `server/README.md` says is built.
8. **Built but not in the backlog.** Features in `server/README.md` or `DECISIONS.md` with no backlog item.
9. **rule.md coverage.** Each rule.md provision that applies to a built feature has a backlog item or LR.
10. **Tests.** Each built item has at least one test case in the test plan.

Write `.docs/05-log/YYYY-MM-DD-backlog-audit.md` with: scope and inputs, a results table (check, result, details), findings ranked by impact, decisions needed (with the role who decides), and what was not checked.
