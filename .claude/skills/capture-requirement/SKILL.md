---
name: capture-requirement
description: Steps for turning a JoinGun pain point or team request into a draft F/NFR/LR requirement with acceptance criteria and full trace. Use when someone asks to add, rewrite or split a requirement.
---

# Capture a requirement

1. **Find the source.** Look up the pain in `.docs/01-requirements/evidence-log.md` (codes `EL-Qn`, later interview codes `Rnn`) or `competitor-research.md` (`CR-n`). If it is a team request with no evidence, say so.
2. **Check it is new.** Search the spec for an F/NFR/LR that already covers it, and the backlog for an item. Prefer extending an existing requirement over adding one.
3. **Check the rules.** Read the whole `rule.md`. List every provision that applies (consent, logs, retention, AI transparency, safety guidance, data minimisation).
4. **Write the story.** `**Fn (Priority, proposed):** As a …, I want …, so that …`. Pick the next free ID. Propose a MoSCoW priority with one line of reason; W6 scope lock says new requests go to Could or Won't unless the PO says otherwise.
5. **Write acceptance criteria.** A table of Given / When / Then rows. Each row must be testable through the API or the UI; name the existing test case (`TC-…` in `.docs/03-testing/test-plan.md`) or write "new test needed".
6. **Add the trace.** Evidence → rule.md → backlog → user journey / `diagrams.md` → code files → tests. Mark each missing link.
7. **List decisions for the PO.** Accept or not, priority, wording, backlog change.
8. **Save** as `.docs/01-requirements/01-spec/YYYYMMDD-NN-<id>-draft.md`. Do not edit the spec or backlog.
