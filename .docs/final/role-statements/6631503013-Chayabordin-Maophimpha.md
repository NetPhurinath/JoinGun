# Chayabordin Maophimpha — AI Lead

## What I owned

I worked on the AI-related parts of JoinGun: the agent guidance files, the Claude Code project instructions, and the system's activity recommendation feature. I also contributed to using AI tools during project development, including support for drafting and improving project materials. The repository contains [CLAUDE.md](../../../CLAUDE.md), the [requirement-writer agent](../../../.claude/agents/requirement-writer.md), and a [backlog-audit agent](../../../.claude/agents/backlog-auditor.md). These files describe how AI agents should use project context and rules. For recommendations, I worked on the feature documented in [recommend.js](../../../server/recommend.js) and the team's [AI logic and evaluation notes](../ai-logic.md). My intended AI recommendation work was not fully completed: the current implementation is a points-based recommender, not a trained model, and the planned bias report has not been run according to the [test plan](../../03-testing/test-plan.md). I will present that as an unfinished evaluation and scope limitation, not as a completed intelligent model. My contribution helped the team apply AI across project planning and implementation while documenting where human review and further evaluation are still needed.

## Evidence

- [CLAUDE.md](../../../CLAUDE.md)
- [Requirement-writer agent](../../../.claude/agents/requirement-writer.md)
- [Backlog-auditor agent](../../../.claude/agents/backlog-auditor.md)
- [Recommendation implementation](../../../server/recommend.js)
- [AI logic and evaluation](../ai-logic.md)
- [AI test cases and use disclosure](../../03-testing/test-plan.md)

## AI disclosure

AI use was part of my project responsibility: I prepared agent and Claude project guidance and worked on the recommendation feature, while AI tools also assisted with project and test documentation. The project's test plan names Claude Code as a drafting assistant. Recommendation outputs themselves come from server-side points and rules, not an external LLM. Bias evaluation remains incomplete.
