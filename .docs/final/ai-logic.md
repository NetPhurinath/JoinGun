# AI logic and evaluation

## Where

The feature called “AI recommendations” is in the activity discovery flow (F6; backlog 6.1–6.3). It is an explainable, deterministic points-based recommender in the server. It is not a trained machine-learning model, does not use a language model, and does not send data to an external AI provider. Recommendations are available only after separate opt-in consent (`ai-recommendation`, version `ai-v1`). Users can dismiss an activity, request less of a category, reset feedback, or request human review.

## How

For each eligible upcoming activity (open, not already joined, and not hosted by a blocked user), the system scores:

| Factor | Points |
| --- | ---: |
| Interest/category match | +40 |
| User participation in category in the last 180 days | +10 each, capped at +30 |
| Friends joined | +15 each, capped at +30 |
| Host is a friend | +15 |
| Starts within 48 hours | +10 |
| “Less of this category” feedback | −25 each |

The UI labels results “แนะนำโดยระบบ AI” and lists the contributing factors and points. It offers dismissal, category feedback, and moderator review. The project says year, faculty, gender, and location are not scoring features. Activity and participation history are personal data; consent is separate from location and other consent. See [server guide](../../server/README.md), [rule.md](../../rule.md), and [legal traceability](../01-requirements/01-spec/20260908-02-legal-traceability.md).

## Prove: test set, baseline, evaluation

The repository provides `npm run bias-report` (`server/scripts/bias-report.js`) to compare the share of recommendations by host year and category against the available activities for users who opted in. This is a descriptive check on the current dataset, not a model fairness certification. Gender and faculty are not collected and cannot be evaluated. The project documentation does not include a saved output/log from a completed bias report, its dataset size, or an AI-specific test set and measured result. Therefore no bias result is claimed here.

The automated test plan identifies AI-related checks (including TC-AI-03) and reports a 47/47 overall API/database test run on 2026-10-28; the summary does not break out the AI test case result. Do not interpret the total as proof that a specific AI acceptance criterion passed. A reproducible evaluation should preserve the test database/data description, command, date, script output, and any failure cases. These artifacts are not currently documented in the final-deliverable evidence reviewed.

**Baseline:** No prior recommender or no-recommendation baseline has been measured. The system's “before” usability comparison has not been run; the controlled task effort results are pending. No recommendation precision, recall, click-through, acceptance, or task-success lift is claimed.

## Measure, limitations, and failure handling

- Evaluation script available: `npm run bias-report`.
- Documented quantitative model evaluation result: none located; run output and sample details are missing.
- Known coverage limitation: year/category distribution can be compared; gender/faculty fairness cannot be assessed because those attributes are not collected.
- The points are hand-set weights, not learned from validated outcomes. Shared interests and social connections may narrow exposure; the distribution report can reveal some concentration but does not establish fairness.
- Consent withdrawal stops recommendations. A user can dismiss, adjust category feedback, or request moderator review. The feature must not be represented as a guarantee of compatibility, identity, intentions, or safety.

Relevant trace: F6; backlog 6.1–6.3; rule.md AI transparency, feedback/override, bias review and human review provisions. The legal traceability document should be consulted for coverage gaps; the backlog/spec do not provide a dedicated acceptance criterion for every rule.md AI obligation.
