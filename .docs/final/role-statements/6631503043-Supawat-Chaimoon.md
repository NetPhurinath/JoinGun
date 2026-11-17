# Supawat Chaimoon — Tech Lead

## What I owned

I was responsible for the backend, deployment work, and preparation of the test plan. The backend is built with Node.js and Express and contains the API, database access, authentication, activity posting and participation, moderation, notifications, and recommendation endpoints. The [server guide](../../../server/README.md) documents its routes, data behavior, configuration, and known limitations. Deployment configuration is represented by [render.yaml](../../../render.yaml), alongside the [project setup guide](../../../README.md) and Capacitor settings. I also prepared the test plan that maps requirements to test cases and records the testing approach, environments, results, and gaps. The test plan documents a 47/47 API and database test run and 6/6 browser end-to-end checks from 2026-10-28; those are project results and should be distinguished from my individual contribution to preparing the plan and backend. Deployment configuration and a supplied live URL do not by themselves prove uptime or production readiness. I documented remaining limits so the team can separate verified local behavior from work that still needs deployment or device-level checks.

## Evidence

- [Backend and API guide](../../../server/README.md)
- [Backend application](../../../server/app.js)
- [Database implementation](../../../server/database.js)
- [Render deployment configuration](../../../render.yaml)
- [Test plan](../../03-testing/test-plan.md)
- [Testing summary](../../03-testing/no-real-user-test.md)

## AI disclosure

The test plan records Claude Code assistance with drafting and revising testing materials. AI may assist with code or documentation, but backend behavior, deployment configuration, and reported test results must be checked against the repository and actual run evidence. I remain responsible for the backend and deployment work I owned.
