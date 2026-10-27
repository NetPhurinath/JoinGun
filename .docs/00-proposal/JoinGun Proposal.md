## **Project Proposal**

**Project Title:** JoinGun

**Team Members:** 

**Chayabordin Maophimpha	(AI Lead)**  
**Chawin Thachai			(Product Owner)**  
**Phurinath Janjirahpoonpon	(Designer)**  
**Supawat Chaimoon		(Tech Lead)**  
**Parinya Chotchungtakul		(QA/Test)**

**Date:** 5th September 2026

**1\. Executive Summary**

JoinGun is a platform which invites university students to join in activities together, allowing both friends and strangers with shared interests to meet up through posted activities. It includes a map to show exact meeting locations, notifications, and an AI-driven recommendation system that learns from the user's participation history. The goal is to reduce the difficulty of finding activity partners and make coordinating meetups easier and safer for students on campus.

**2\. Introduction and Problem Statement**

Many university students, especially 1st year students, students who find it hard to socialize, or those who recently moved from another area/struggle to find people to join activities with outside of class. Even though universities have many clubs and activities, access to them is spread with no central hub, leading to problems such as: 

* Missed opportunities: students don’t know when someone is organizing, or looking for others to join, an activity that matches their interests.   
    
* Difficult coordination: logistics(time, location, number of people) are scattered across multiple group social channels, easy to lose track of, with no centralized notifications  
    
* Socially awkward with strangers: there’s no safe, trustworthy central space(verified via an educational-institution email ending in .ac.th) for meeting new people who share the same activity interests.   
    
* No personalized recommendations: students have to search for activities by themselves; there’s no system that learns their interests from past behavior. 


**Target Users:** 

* **Primary:**   
1. University students verified via their educational-institution email (.ac.th)   
2. Students who want to try new activities with people who share their interests, even if they’re strangers, and who can bring a friend along when they would rather not go alone   
     
* **Secondary:**   
1. University clubs/activity groups looking to recruit for members or participants

**3\. Project Goals and Objectives**

**Primary Goal:**Build a platform that makes it easy, safe, and relevant for students to find people to do activities with.   
**Specific Objectives:**

* Reduce the time/hassle of coordinating activity logistics   
* Increase students’ chances of meeting others with shared interests, even strangers   
* Reduce the problem of participants being unable to find meeting locations, via a built-in map   
* Recommend activities tailored to each user’s interests using AI 


  
**4\. Scope of Work**

**In-Scope Functionalities:**

* Sign-up/verification via educational-institution email (.ac.th)   
* Post activities specifying number of people, location (pinned on a map), and time   
* Notifications as the activity time approaches   
* Friend system (add manually, or add people from the same activity group)   
* Invite friends to the same activity (share the activity link; a friends feed shows what friends post)   
* AI-based activity recommendations based on participation history 


**Out-of-Scope Functionalities:**

* Payment system for paid activities, Real-time in-app chat
* Points or rewards system

**5\. Methodology and Technical Approach**

* **5.1. Development Methodology:**Agile/Scrum with weekly sprints   
    
* **5.2. System Architecture:**  
  A single web application (a "modular monolith"): one Node.js server serves both the web pages and a JSON API, and stores everything in one SQLite database file. The Android app is the same web pages inside a Capacitor shell, pointed at the same server, plus reminders scheduled on the phone. Outside services are Gmail SMTP for sign-in codes and optional reminder email, and OpenStreetMap for map tiles and place search. The full diagrams (context, use cases, architecture, core workflow) are in `.docs/02-design/diagrams.md`.

  | Part | What it does |
  | --- | --- |
  | Client | Web browser or Android app showing the `web/` pages: feed, activity details, map, join, profile, settings, moderator screen |
  | Server (`server/`) | Security headers and rate limits; modules for sign-in and accounts, posts and feed, joining, friends and profiles, notifications, recommendations, moderation, data download and account deletion |
  | Background jobs | Every minute: reminders and marking finished activities. Every day: purging deleted accounts after the 90-day archive, and a database backup |
  | Data | One SQLite file: accounts, activities and participants, consent records, logs (posting, joining, sign-in), social data and notifications, moderation records |
  | External | Gmail SMTP; OpenStreetMap tiles and Nominatim place search (called from the browser) |

  Current state: the system runs locally (bound to 127.0.0.1). The Android app has not yet been built and run on a phone. Nothing is deployed; hosting, HTTPS and a domain are still to be chosen.
    
* **5.3. Technology Stack:**

  | Layer | Technology |
  | --- | --- |
  | Server | Node.js 22.13+, Express 5 |
  | Database | SQLite through Node's built-in `node:sqlite`; daily backup with `VACUUM INTO` |
  | Web UI | HTML, CSS and plain JavaScript modules (no framework, no build step) |
  | Map | Leaflet with OpenStreetMap tiles; Nominatim for place search |
  | Email | Gmail SMTP with an App Password, sent through nodemailer |
  | Mobile | Capacitor 8 Android app with the Local Notifications plugin |
  | Data download | Password-protected ZIP through `@zip.js/zip.js` |
  | Security | Field-level encryption of email and optional profile fields; security headers and rate limits built into the server |
  | Recommendations | A transparent points model inside the server; no trained model and no external AI service |
  | Testing and CI | `node:test` API and database tests, run by GitHub Actions on every push |
  | Source control | Git and GitHub |
  | Hosting | Not chosen yet |

**6\. Risk Assessment and Mitigation Plan**

* **Safety risk** (meeting strangers in person) → Require verification via educational-institution email (.ac.th) only; consider adding a report/block feature   
* **Data privacy risk** (storing location and behavioral logs) → Restrict data access, define a clear privacy policy   
* **Low user adoption risk** (few users at launch) → Start with a small target group within the university, promote through clubs 

**7\. Milestones and Timeline**

Course dates come from the course slides (W2–W6 and the Post-Midterm Plan, 2569). "JoinGun" shows what the team has done or must do at each point.

| Week / date | Course milestone | JoinGun |
| --- | --- | --- |
| W1 | Team charter (Discover) | Team, roles and problem chosen |
| W2 | AI ethics, PDPA and IT law | `rule.md` written |
| W3 — 26 Aug 2026 | Requirements → backlog | Requirement spec and product backlog |
| W4 — 2 Sep 2026 | Design with agents | Feature list, user journey, design system, prototype, diagrams |
| 5 Sep 2026 | — | This proposal first written |
| W5 — 9 Sep 2026 | User Validation Gate | Questionnaire (5 responses, 7–8 Sep) |
| W6 — 16 Sep 2026 | Scope lock, Sprint 0, repository | MoSCoW from the spec: F1–F3 Must, F4–F5 Should, F6 Could, F7 Won't |
| W7 — 23 Sep 2026 | Architecture studio, build sprint | Build sprint on the core workflow |
| W8 — 7 Oct 2026 | Alpha demo | Web UI connected to the Express and SQLite MVP |
| W9 — 14 Oct 2026 | Online class: testing and UAT | Accounts, joining, safety and PDPA functions built (14–16 Oct) |
| W10 — 21 Oct 2026 | No class; write the Test Plan | Android app (Capacitor) and build 0.3.0 (26–27 Oct) |
| Before 28 Oct 2026 | **Test Plan due** (one per team) | Test plan drafted in `.docs/03-testing/test-plan.md` |
| Sat 31 Oct 2026 | Cybersecurity guest lecture, E4614 | — |
| W12 — 4 Nov 2026 | Field testing with real users | UAT sessions with real students (target ≥ 10), fix critical bugs |
| W13 or W14 — 11 or 18 Nov 2026 | Final presentation (teams 1–10 on 11 Nov, 11–20 on 18 Nov) | Portfolio P1–P5: case study, live product and demo video, user evidence log, impact metrics, role statements |
| 22 Nov – 4 Dec 2026 | Final exam period | — |

**8\. Ethical Considerations**

* Educational-institution email (.ac.th) verification to reduce the risk of fake accounts   
* Obtaining consent to collect and use user behavior data for recommendations  
* Protecting user’s location data and personal information   
* Responsibility for user safety when meeting in person 


**9\. Expected Deliverables**

* A working(MVP) version of the JoinGun app/web app   
* Supporting documents: Product Backlog, Design draft(feature list, user journey, diagrams), Compliance document   
* A report on user interviews and problem validation 


**10\. Conclusion**

JoinGun addresses the lack of a convenient, safe central channel for university students to find activity partners. With features like activity posting, maps, notifications, and AI-based recommendations, the team believes this platform will help increase student engagement in campus activities. 

**11\. References**

Yellotalk. (2026). *Yellotalk* (Version 4.2) \[Mobile app\]. Google Play Store. google.com   
Google. (2026). *Google Calendar* (Version 2026.08) \[Mobile app\]. Google Play Store.   
Google. (2026). *Google Maps* (Version 11.130) \[Mobile app\]. App Store. apple.com 