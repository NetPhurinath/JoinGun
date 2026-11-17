# JoinGun case study

## Problem

University students can have trouble finding peers for activities at a suitable time, coordinating a meeting point, and deciding whether it feels safe to meet someone new. The initial discovery questionnaire was small: five fourth-year respondents in September 2026. It found that 4/5 usually contacted friends directly, 4/5 reported discomfort meeting strangers, and 3/5 named not finding enough participants as their primary problem. This is early directional evidence, not a representative study. See the [evidence log](../01-requirements/evidence-log.md) and [testing summary](../03-testing/no-real-user-test.md).

## Process

The team translated the problem into requirements F1–F7 and NFR1–NFR4, a 22-item backlog, a five-step core journey, then a working web application and Android wrapper. The selected core journey is discovering an activity in the feed and joining it. The current build (0.3.0) uses Node.js, Express and SQLite/PostgreSQL-compatible storage, with a plain JavaScript web UI and Capacitor Android wrapper. The recommender is a deterministic points table; it is not a trained model or external LLM.

Validation combined automated checks, local performance measurements, early problem research, secondary research, and a proxy evaluation. The documented technical run on 2026-10-28 reports 47/47 API/database tests and 6/6 browser end-to-end tests passing. A proxy evaluation completed 2026-11-17 reports SUS 57.66 (below the 68 target), usefulness 4.08/5, ease 3.97/5, and behavioral intention 3.81/5 (each above the 3.5 target). Paired overall satisfaction was 4.10 usual method vs 4.20 JoinGun, n=10, Wilcoxon p=0.564. In controlled task-effort evaluation (Scenario Set A vs. Set B, n=16, PROXY), JoinGun reduced median task completion time by 42.8% to 58.1% across MUST tasks T1–T4 (T1: 44.0s vs 113.0s; T2: 26.0s vs 46.0s; T3: 28.0s vs 47.0s; T4: 28.5s vs 48.0s) and lifted task success rates to 87.5%–100.0% (all recorded in [JoinGun - Testing.xlsx](../03-testing/JoinGun%20-%20Testing.xlsx)). These are proxy impressions and walkthroughs, not a real-user deployed trial.

## Outcome

The result is a locally runnable pilot build with activity posting, feed, join/leave, consent handling, reminders, friends, privacy controls, reports/blocks, data export/deletion, moderation, and transparent opt-in recommendations. Documented evidence supports technical functionality and promising perceived usefulness, while usability remains a clear improvement area. No moderated REAL user sessions on a deployed HTTPS service have been run to date.

**Live URL:** [https://joingun.onrender.com](https://joingun.onrender.com) (provided by the project team). This document records the supplied URL; it does not claim an independent availability, deployment, or production-readiness check.

### Evidence and trace

- Problem evidence: [evidence log](../01-requirements/evidence-log.md), [competitor research](../01-requirements/competitor-research.md).
- Requirements and backlog: [specification](../01-requirements/01-spec/20260908-01-joingun.md), [backlog](../01-requirements/backlog.md). Joining is backlog item 2.4 and the user journey, but still lacks a dedicated approved F requirement and acceptance criteria.
- Design and implementation: [user journey](../02-design/user-journey.md), [server guide](../../server/README.md), [test plan](../03-testing/test-plan.md).
- Measured results and limitations: [testing summary](../03-testing/no-real-user-test.md).

### AI disclosure

AI tools assisted with drafting project and test documentation. The in-product recommendation feature is a rule-based points model, described in [ai-logic.md](ai-logic.md). It does not call an LLM or send recommendation inputs to an external service. Team review of AI-assisted project materials should be recorded by the team; this document does not assert an undocumented review.
