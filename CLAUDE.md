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
- Stage: design (W4). The only runnable code is the static prototype in `.docs/02-design/prototype/` (HTML/CSS/JS, no server, no database).
- Technology stack: **not decided** (proposal sections 5.2, 5.3 and 7 are empty). Do not choose a framework, database, or map provider without asking.
- Out of scope: payments, real-time in-app chat.

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
- Interview evidence log

Do not reference these as if they exist. Offer to create them only when the user asks.
