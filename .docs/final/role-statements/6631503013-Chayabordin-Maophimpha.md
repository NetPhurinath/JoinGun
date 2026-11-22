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

## Reflection

Building JoinGun with AI taught me that software engineering requires judgment throughout requirements, design, coding, testing, quality, security, and teamwork. One improvement was organizing project knowledge. The agent guidance and Claude instructions helped express requirements and design context for development and team review. However, one thing became harder: keeping expectations aligned with implementation. Our planned AI recommendation feature remained a points-based recommender, while evaluation was incomplete. I learned to check generated code and documentation against requirements and treat test plans as work that still needs execution. Security requires checking consent and personal-data handling alongside functionality.

The proposed SVD experiment helped me understand what a recommendation model would require. Its workflow starts with user, activity, and preference-rating data, cleaned with Python and pandas using coded identifiers. Earlier records would train the Surprise SVD model, and later records would test it. Predictions would rank eligible activities after filtering unavailable events. Comparing MAE, RMSE, Precision@5, and response time with the rule-based approach would help assess suitability. This remains an experimental plan. The existing evidence records unfinished model evaluation and bias checking. My lesson is to define the data, baseline, and evaluation method before promising an intelligent feature.

Today, I see myself as a developing software engineer who can use AI for assistance and needs stronger skills in independently verifying its output. I want my value to come from understanding user needs, explaining decisions, and collaborating responsibly. Next year, I plan to strengthen Python, databases, testing, security, and recommendation-system fundamentals, then complete a reproducible experiment with clearly labelled data and documented results. In five years, I aim to be an engineer who can take responsibility for AI-assisted features from requirements through deployment and evaluation. I want to make evidence-based technical choices and explain their limitations clearly to teammates and users.
