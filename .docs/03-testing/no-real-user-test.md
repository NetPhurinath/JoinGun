# JoinGun — Testing Summary & Real-User Test Plan

| Item | Value |
| :--- | :--- |
| **Status** | **PROXY Testing Complete (Data recorded in UAT document `JoinGun - Testing.xlsx`). REAL UAT Incomplete / No Evidence Yet.** No moderated session with real users (`REAL`) on a deployed HTTPS server has been conducted. |
| **Build under test** | 0.3.0 (Web UI `web/`, Express `server/`, Capacitor Android `android/`) |
| **Date** | 2026-11-17 |
| **Related Files** | [Test Plan](../.docs/03-testing/test-plan.md), [UAT Materials (TH)](../.docs/03-testing/uat-materials-th.md), [UAT Document (JoinGun - Testing.xlsx)](JoinGun%20-%20Testing.xlsx), [SUS & TAM Responses (XLSX)](JoinGun%20%E2%80%94%20%E0%B9%81%E0%B8%9A%E0%B8%9A%E0%B8%AA%E0%B8%AD%E0%B8%9A%E0%B8%96%E0%B8%B2%E0%B8%A1%20SUS%20%E0%B9%81%E0%B8%A5%E0%B8%B0%20TAM%20%28Responses%29.xlsx), [Evidence Log](../.docs/01-requirements/evidence-log.md), [Competitor Research](../.docs/01-requirements/competitor-research.md), [KNOWN-GAPS.md](../KNOWN-GAPS.md) |

### Evidence Labels & Environment Overview
Every metric in this document carries an explicit label so readers can distinguish internal/proxy checks from verified real-user sessions:

| Label | Definition | Execution Environment | Status |
| :--- | :--- | :--- | :--- |
| **TEAM** | Executed or measured directly by the JoinGun development team. | **Local Server (`127.0.0.1`) + Test Data** | **Completed** |
| **PROXY** | Evaluated by external respondents/students outside a controlled HTTPS UAT session (codes `PX01–PX16`; student IDs omitted for privacy). **This testing is COMPLETE, and data from this PROXY test has been recorded in the UAT document (`JoinGun - Testing.xlsx`).** | **Local Server (`127.0.0.1`) + Test Data** | **Completed (Data in `JoinGun - Testing.xlsx`)** |
| **PRELIMINARY SURVEY** | Early problem-discovery questionnaire collected directly by the team (`n = 5`). | N/A (Survey) | **Completed** |
| **SECONDARY** | Public store reviews, community forums, and competitor analysis. | N/A (Public Data) | **Completed** |
| **REAL** | Enrolled university students (`.ac.th` email, age 20+, external to team/course) in moderated UAT sessions. | **Deployed URL + HTTPS** | **Incomplete / No Evidence Yet (0 sessions run)** |

---

## 1. Overview & Current Testing Status (PROXY vs. REAL UAT)

### 1.1 Why No Real-User Test Has Been Run Yet
JoinGun is an activity-invitation app where students post an activity (time, location, and available spots) for others to join.

1. **External Variables Prevent Fair Invitation-Time Measurement:** The initial plan to measure total invitation time (from sending an invite on LINE/Facebook until friends reply and attend) cannot serve as a valid app performance metric. Reply latency and attendance depend on external factors outside the app's control—such as whether friends see the message, free time, exams, weather, and mood—causing the same invite to take anywhere from 2 minutes to 2 days. The team therefore pivoted to measuring **Paired Satisfaction (Usual Way vs. JoinGun), UAT Task Completion, Usability (SUS), Technology Acceptance (TAM), and Controlled Active Task Effort**.
2. **Infrastructure & Privacy Boundaries:** Per `AGENTS.md` and `KNOWN-GAPS.md`, the backend currently runs on a **Local Server (`127.0.0.1`) without HTTPS** and has not been publicly deployed. Consequently, **Local Server + Test Data** is restricted strictly to **TEAM** and **PROXY** testing, while **REAL** user testing with live personal data is deferred until a **Deployed URL + HTTPS** environment is available.

### 1.2 Current Testing Evidence Status (PROXY in UAT vs. REAL UAT)
* **PROXY Test is COMPLETE (`การทดสอบ PROXY เสร็จแล้ว`):**
  * The team conducted empirical testing with a proxy sample (`n = 16`, anonymized respondent codes `PX01–PX16`).
  * Evaluation covered Scenario Set B tasks, System Usability Scale (SUS), Technology Acceptance Model (TAM), and Paired Overall Satisfaction (`n = 10`).
  * **Data Integration into UAT Records:** Data from this PROXY evaluation has been transferred and recorded directly into the project's primary UAT documentation workbook ([JoinGun - Testing.xlsx](JoinGun%20-%20Testing.xlsx)). Note that the separate `uat-record.xlsx` file serves only as a template and contains no test data; readers examining the empirical UAT records should refer to `JoinGun - Testing.xlsx` for the verified PROXY dataset.
* **REAL UAT is INCOMPLETE / NO EVIDENCE (`REAL UAT ยังไม่เสร็จ / ยังไม่มีหลักฐาน`):**
  * Moderated sessions with real university students on a public HTTPS server have **not** been run.
  * There are currently **no session recordings, no moderator observation sheets, no real participant rosters, and no signed consent forms** for REAL user sessions.
  * Any real-user UAT must not be claimed until the live HTTPS environment is active and complete evidence (session dates, methodology, participant codes/counts, and empirical results) is formally gathered.

---

## 2. Alternative Testing Methods

To validate technical correctness, user demand, and perceived usability prior to HTTPS deployment, the team executed the following methods:

| Method | Label | Scope | Status (2026-11-17) |
| :--- | :--- | :--- | :--- |
| **Automated API & E2E Tests** | TEAM | Backend integration (`47` tests) and Playwright mobile browser E2E (`6` tests) | **Completed** (2026-10-28) |
| **Preliminary User Survey** | PRELIMINARY SURVEY | Early pain-point questionnaire with 4th-year students (`n = 5`) | **Completed** (2026-09-08) |
| **Competitor & Community Research** | SECONDARY | Review of Pantip threads, YelloTalk Google Play reviews, and social platforms | **Completed** (2026-10-28) |
| **Heuristic Usability Review** | TEAM | Evaluation against Jakob Nielsen's 10 Usability Heuristics on build 0.3.0 mobile UI | **Completed** (2026-10-28) |
| **SUS, TAM & Overall Satisfaction Survey** | PROXY | Google Form evaluation (`n = 16` for SUS/TAM; `n = 10` for paired overall satisfaction) + Scenario Set B task evaluation. **Data entered into UAT document (`JoinGun - Testing.xlsx`).** | **Completed (`เสร็จแล้ว`)** |
| **Controlled Before/After Task Effort** | PROXY / TEAM | Active time, success rate, and SEQ across 4 MUST tasks (`n = 16`, Scenario Set A vs. Set B). Recorded in `JoinGun - Testing.xlsx`. | **Completed (`เสร็จแล้ว`)** |
| **Real-User UAT Sessions** | REAL | Moderated 25-minute sessions on Deployed URL + HTTPS (`n = 12`) | **Incomplete / No Evidence Yet (`ยังไม่เสร็จ/ยังไม่มีหลักฐาน`)** |

---

## 3. Testing Results

### 3.1 Automated Technical & Performance Tests (TEAM)
Documented in [test-plan.md](../.docs/03-testing/test-plan.md) (executed 2026-10-28):

| Level | Test Scope | Documented Result | Source |
| :--- | :--- | :--- | :--- |
| **L1: API & DB Integration** | Input validation, access control, consent logs, transactions, encryption, join/leave, moderation | **47/47 passed** (0 fail, 0 skipped; Node 22.21.0) | `server/test/*.test.js` |
| **L2: Browser E2E** | Sign-up, create activity, feed filter, join with consent, delete confirmation, reload persistence (Playwright, Pixel 7 viewport) | **6/6 passed** (after fixing `ISS-01` / `TC-ACC-09`) | `tests/e2e/core-journey.spec.js` |
| **L3: Server Latency** | Feed and API response time on a local laptop with a small dataset | **p95 ~505 ms** (not tested under 1,000 concurrent users) | `KNOWN-GAPS.md` |

**Unverified Technical Gaps (`KNOWN-GAPS.md`):** Physical Android build execution (`TC-DEV-01`, `TC-NOT-03`), cold feed load $< 2\text{ s}$ on 4G (`TC-FEED-06`), GPS pin accuracy $\le 10\text{ m}$ (`TC-POST-08`), OTP delivery $< 2\text{ min}$ (`TC-ACC-07`), and manual UI checks for safety disclaimers (`TC-SAFE-08`) and restricted fields (`TC-SAFE-07`).

### 3.2 Problem Validation: Preliminary Survey & Secondary Evidence

* **Preliminary Team Survey (`PRELIMINARY SURVEY`, 2026-09-07/08, `n = 5`, 4th-year students):**
  * **5/5** want activity history visible to "Only Me".
  * **4/5** currently find partners by messaging friends directly, feel uncomfortable meeting strangers without a friend, and want fewer steps when posting an activity.
  * **3/5** cite failing to find enough people to join as their primary problem.
* **Competitor & Community Research (`SECONDARY`, 2026-10-28):**
  * **8/10** Pantip badminton-partner posts on the first search page received zero replies (`S06`, `P02–P11`).
  * **YelloTalk (Google Play, 2.1★ from ~3.1K reviews; 140 sampled):** 29 reviews mention unappealable bans, 19 mention missing/late notifications, and 13 mention no admin contact (`S01`).
  * **0 platforms** reviewed (YelloTalk, Facebook, X) display a real-time remaining-spots counter (`S01–S03`, `S07–S09`).

### 3.3 Usability (SUS), Acceptance (TAM) & Satisfaction Results (PROXY)

**Data Recording in UAT Documents:** The metrics below represent the completed **PROXY** evaluation (`PX01–PX16`, `n = 16`). This dataset has been transferred into the project's primary UAT documentation ([JoinGun - Testing.xlsx](JoinGun%20-%20Testing.xlsx)) as primary empirical evidence while awaiting live deployment. Note that `uat-record.xlsx` is a template containing no data; all actual test records are in `JoinGun - Testing.xlsx`.

**Instruments Used:**
* **UAT Tasks:** Evaluated via Scenario Set B (find activity, join & check spots, locate meeting point, set reminder).
* **SUS (10 items):** Odd items $(\text{score} - 1)$, even items $(5 - \text{score})$, sum $\times 2.5$ (range 0–100; benchmark $\ge 68.0$).
* **TAM (13 items, 1–5 scale):** Measures Perceived Usefulness (items 1–4), Perceived Ease of Use (items 5–8), Behavioral Intention (items 9–11), and Perceived Safety/Transparency (items 12–13, reported separately).
* **Exclusion of UTAUT2:** **UTAUT2 is explicitly excluded** because its *Habit* and *Price Value* constructs cannot be meaningfully measured in a single short session with a free student application.

| Metric / Construct | Sample (`n`) | Mean | SD | Median | Min–Max | Target | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **SUS Score** (0–100) | 16 (`PROXY`) | **57.66** | 13.18 | 52.50 | 42.50–90.00 | $\ge 68.0$ | **Below target** (4/16 scored 70–90) |
| **TAM: Perceived Usefulness (PU)** | 16 (`PROXY`) | **4.08** | 0.48 | 4.00 | 3.25–5.00 | $\ge 3.50$ | **Passed** |
| **TAM: Perceived Ease of Use (PEOU)** | 16 (`PROXY`) | **3.97** | 0.59 | 4.00 | 3.00–5.00 | $\ge 3.50$ | **Passed** |
| **TAM: Behavioral Intention (BI)** | 16 (`PROXY`) | **3.81** | 0.58 | 4.00 | 3.00–5.00 | $\ge 3.50$ | **Passed** |
| **TAM: Perceived Safety (Items 12–13)** | 16 (`PROXY`) | **3.66** | 0.77 | 4.00 | 2.50–5.00 | $\ge 3.50$ | **Passed** |
| **Overall Satisfaction: Usual Way** | 10 (`PROXY`) | **4.10** | 0.99 | 4.50 | 3.00–5.00 | — | Baseline |
| **Overall Satisfaction: JoinGun** | 10 (`PROXY`) | **4.20** | 0.92 | 4.50 | 3.00–5.00 | $\ge$ Usual Way | **Passed** ($\Delta = +0.10$, Wilcoxon $p = 0.564$) |

**Diagnostic Note on SUS vs. TAM:** While TAM constructs strongly exceeded the `3.50` threshold (led by overall usefulness at `4.19` and clarity at `4.06`), the SUS mean (`57.66`) was pulled down by **4 respondents (25%) who straight-lined `4` across all 10 SUS items**—which yields an automatic score of `50.0` due to SUS's alternating positive/negative wording—as well as higher perceived complexity/inconsistency scores on negative items (`Q6 = 3.44`, `Q10 = 3.38`). Note also that the online form captured single-item overall satisfaction (`n = 10`), whereas the granular 9-item paired satisfaction items (`S1–S9`) remain reserved for the moderated UAT sessions.

### 3.4 Issue Log (TEAM & PROXY)

All issues logged from Playwright tests and proxy user sessions (`JoinGun - Testing.xlsx` *Issues* sheet), categorized by Nielsen severity (0–4):

| ID | Found By / Task | Description & Root Cause | Severity (0–4) | Fix Commit / Status & Retest |
| :--- | :--- | :--- | :---: | :--- |
| **ISS-01** | Playwright (`TC-ACC-09`) | Welcome page rendered at `958 px` width on a `412 px` phone screen, pushing the "ถัดไป" sign-up button off-screen. **Cause:** Hidden labels inside sample cards overflowed the horizontal scroller. | **3** (Major) | **Fixed** (`position: relative` on `.welcome-art .collage` in `web/css/app.css`). **Passed** retest on 2026-10-28. |
| **ISS-02** | PROXY (`U00, U03`, Task T4) | Reminder configuration menu discoverability: Users expected the reminder toggle inside the activity detail screen, but it was located under the navigation drawer settings. | **2** (Minor) | **Open** (Scheduled for UI enhancement; logged in `JoinGun - Testing.xlsx` Issues sheet row 2–3). |
| **ISS-03** | PROXY (`U06`, Task T1) | Category filter active state feedback: Selected filter chip did not clearly display a highlighted/pressed visual state, causing users to tap repeatedly to verify. | **2** (Minor) | **Open** (Backlog UI fix: add distinct `.active` chip background and border styling). |
| **ISS-04** | PROXY (`U09`, Task T3) | Meeting point map pin touch target: The Leaflet pin icon on mobile was too small, leading to accidental mis-taps on surrounding map tiles. | **3** (Major) | **Open** (Scheduled fix: increase Leaflet marker clickable area and add callout popup). |
| **ISS-05** | PROXY (`U12`, Task T2) | Available spots visibility above the fold: On small screens (e.g. <600px viewport height), remaining seats count required scrolling down to be seen before tapping join. | **2** (Minor) | **Open** (Backlog UI fix: sticky summary badge in activity card header). |
| **ISS-06** | PROXY (`U14`, Task T1) | Initial cold-start latency on Render free tier: When waking from sleep, initial feed load took ~15–25 seconds, causing users to perceive the application as frozen. | **3** (Major) | **Documented** (Infrastructure limitation on free tier in `KNOWN-GAPS.md` and `case-study.md`; warm ping script added). |

### 3.5 Heuristic Usability Review (TEAM)
Conducted on 2026-10-28 using Jakob Nielsen's 10 Usability Heuristics on JoinGun build 0.3.0 (mobile web view):

1. **Visibility of system status:** Feed filters and remaining spots update in real time (`Passed`), but active filter selection lacks high-contrast feedback (`ISS-03`, Severity 2).
2. **Match between system and real world:** Activity terms (ชื่อกิจกรรม, สถานที่นัดพบ, จำนวนคน) use familiar campus vocabulary matching students' everyday language (`Passed`).
3. **User control and freedom:** Users can cancel membership, edit own posts, and delete with explicit confirmation (`Passed`).
4. **Consistency and standards:** Follows standard bottom-navigation and card paradigms; however, reminder placement in drawer deviates from user expectation of inline toggles (`ISS-02`, Severity 2).
5. **Error prevention:** Separate unticked consent boxes, validation on past dates, capacity bounds (2–50), and double-join blocking prevent common errors (`Passed`).
6. **Recognition rather than recall:** Visual badges for remaining spots and category pills reduce memory burden (`Passed`).
7. **Flexibility and efficiency of use:** Fast category filtering and keyword search support quick discovery, but map pin tap targets need enlargement for one-handed thumb use (`ISS-04`, Severity 3).
8. **Aesthetic and minimalist design:** High signal-to-noise ratio in cards, avoiding chat chatter clutter (`Passed`).
9. **Help users recognize, diagnose, and recover from errors:** Human-readable Thai error notices on invalid sign-in and join attempts (`Passed`).
10. **Help and documentation:** Meeting-safety notices and AI transparent factor breakdowns are visible before joining (`Passed`).

---

## 4. Before / After Comparison (Controlled Active Effort)

Measured across all 4 MUST tasks using identical 12-activity datasets (Scenario Set A = Badminton on LINE/Facebook chat; Set B = Futsal on JoinGun) with 16 proxy participants (`PX01–PX16` / `U01–U16` in `JoinGun - Testing.xlsx`):

| MUST Task | Before: Usual Way (Median Sec / Success / SEQ) | After: JoinGun (Median Sec / Success / SEQ) | Change / Benchmark | Benchmark Target | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **T1: Find an activity** (Sunday after 16:00 with open spots) | **113.0 s** (mean 108.0 s)<br>43.8% success (7/16)<br>Median SEQ 3.0 (1 timeout) | **44.0 s** (mean 45.3 s)<br>**100.0%** success (16/16)<br>Median SEQ 6.0 (0 timeout) | **-58.1% time reduction**<br>+56.2% success rate | $\ge 30\%$ faster time<br>$\ge 80\%$ success | **Passed** |
| **T2: Join & verify spots left** | **46.0 s** (mean 45.3 s)<br>50.0% success (8/16)<br>Median SEQ 3.0 | **26.0 s** (mean 25.3 s)<br>**93.8%** success (15/16)<br>Median SEQ 5.5 | **-44.2% time reduction**<br>+43.8% success rate | $\ge 30\%$ faster time<br>$\ge 80\%$ success | **Passed** |
| **T3: Locate meeting point & route** | **47.0 s** (mean 48.3 s)<br>18.8% success (3/16)<br>Median SEQ 3.0 | **28.0 s** (mean 27.7 s)<br>**93.8%** success (15/16)<br>Median SEQ 6.0 | **-42.8% time reduction**<br>+75.0% success rate | $\ge 30\%$ faster time<br>$\ge 80\%$ success | **Passed** |
| **T4: Set a 1-hour reminder** | **48.0 s** (mean 50.6 s)<br>56.3% success (9/16)<br>Median SEQ 3.0 (1 timeout) | **28.5 s** (mean 27.1 s)<br>**87.5%** success (14/16)<br>Median SEQ 6.0 | **-46.3% time reduction**<br>+31.2% success rate | Completed accurately<br>$\ge$ Usual Way SEQ | **Passed** |
| **Summary (T1–T3 Core Journey)** | **206.0 s** total median time | **98.0 s** total median time | **-52.4% total time reduction** | $\ge 30\%$ faster | **Passed** |

---

## 5. Future Real-User Testing Plan (`REAL`)

All Thai consent forms, task cards (Sets A & B), SUS/TAM forms, and the 9-item Paired Satisfaction questionnaire (`S1–S9`) are finalized in [uat-materials-th.md](../.docs/03-testing/uat-materials-th.md).

> [!IMPORTANT]
> **Mandatory Evidence Prerequisite for Real-User Testing Claims:**
> Because REAL UAT is incomplete and currently has no evidence, no member of the team may claim or reference real-user testing until moderated sessions are actually executed on a deployed HTTPS environment. If a moderated session with real users is conducted, the team must first record:
> 1. Specific session date(s)
> 2. Testing methodology and protocol
> 3. Participant count and anonymized participant codes/IDs (`U01–U12`)
> 4. Empirical results (task success, time, errors, SUS/TAM scores)
>
> Only after these items are formally added to the repository as evidence may any team document or role statement cite real-user testing.

### 5.1 Pre-Session Setup & Deployment Requirements
1. **Live HTTPS Deployment:** Deploy the application to a public host with a valid **HTTPS URL** (mandatory before collecting any real student interaction or personal data). Confirm `npm test` and `npm run test:e2e` pass on the deployed commit.
2. **UAT Data & Baseline Kit:** Seed a clean UAT database (`npm run seed`) with 12 activities over 7 days (Sets A & B + decoys) and 20 fresh test accounts (`U01–U20`). Prepare a matching LINE OpenChat/Facebook group with the same 12 posts plus chat noise for the "Before" condition.
3. **Pilot & Recruitment:** Run 1 pilot session (`U00`) to verify timing, then recruit **12 target participants + 2 reserves** (enrolled students, `.ac.th` email, age 20+, external to the team and course).

### 5.2 25-Minute Moderated Session Protocol & Governance
* **0–3 min:** Briefing ("we are testing the system, not you") and signed consent.
* **3–8 min:** Execute **T1–T4** via the **Usual Way** (Set A) on the baseline chat kit.
* **8–13 min:** Execute **T1–T4** via **JoinGun** (Set B) on the **Deployed HTTPS URL** using think-aloud.
* **13–19 min:** Complete **SUS**, **TAM**, and the full **Paired Satisfaction Survey (`S1–S9`)**.
* **19–24 min:** Debrief interview (positives, friction points, adoption barriers).
* **Privacy & Exit Criteria:** Record screen only (no audio/faces), store participant codes (`U01+`) separately outside Git, and delete identifiable notes by **2026-12-31**. Testing completes when $\ge 10$ sessions are finished with **0 open Severity-4 issues** and all Severity-3 issues resolved or signed off by the Product Owner.

---

## 6. Limitations & AI Disclosure

### 6.1 What This Document Does and Does Not Prove
* **Proves:** Core workflows pass automated API/E2E verification (`TEAM`), user pain points exist in campus and community data (`PRELIMINARY SURVEY` / `SECONDARY`), and proxy respondents perceive strong usefulness and ease of use (`TAM = 3.81–4.08`, `PROXY` test completed and populated into the primary UAT workbook `JoinGun - Testing.xlsx`).
* **Does Not Prove:** Moderated real-user testing on a live HTTPS deployment (**`REAL` UAT is incomplete with 0 sessions and no empirical evidence to date**; data currently residing in `JoinGun - Testing.xlsx` reflects proxy evaluation and must not be mistaken for real-user sessions; `uat-record.xlsx` holds no data), real-world invitation turnaround speed, mobile performance on 4G/physical Android hardware, or resolution of the SUS usability friction (`57.66` mean) without follow-up UI simplification.
* **Known Biases:** `PROXY` responses reflect post-demo impressions with potential straight-lining bias on alternating SUS items (`25%` flat-4 responses), and team members running Before/After benchmarks possess prior system familiarity.

### 6.2 AI Disclosure
This document was drafted and consolidated with AI assistance (Claude and Gemini) from repository test logs (`2026-10-28`) and Google Form response data (`2026-11-17`). All statistical calculations (SUS, TAM constructs, and Wilcoxon paired satisfaction tests) were programmatically verified from the raw response dataset and reviewed by the team.