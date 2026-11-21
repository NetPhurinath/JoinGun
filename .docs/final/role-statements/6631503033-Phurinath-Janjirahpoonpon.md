# Phurinath Janjirahuponpon — Designer

## What I owned

I created the system diagrams, worked on the frontend, and prepared documentation describing the system structure. The diagrams connect the product's users and core activity journey to the components that support it. Their editable source and implementation notes are in [diagrams.md](../../02-design/diagrams.md), with rendered diagrams in the [diagrams folder](../../02-design/diagrams/). I also contributed to the browser interface in [web/](../../../web/index.html), including the structure and presentation of the app's screens. The [design system](../../02-design/design-system.md), [user journey](../../02-design/user-journey.md), and [prototype guide](../../02-design/prototype.md) provide supporting design context. System structure is also documented in the [server guide](../../../server/README.md), which explains how the web client, API, and stored data fit together. These artifacts supported the team's work from design through implementation. The diagrams are drafts and some older exported images may not fully match the current implementation, so the editable diagram source should be treated as the current reference and reviewed against the code when presenting the architecture.

## Evidence

- [System diagrams and structure](../../02-design/diagrams.md)
- [Design system](../../02-design/design-system.md)
- [User journey](../../02-design/user-journey.md)
- [Prototype guide](../../02-design/prototype.md)
- [Frontend entry](../../../web/index.html)
- [Server and system guide](../../../server/README.md)

## AI disclosure

AI-assisted drafting was used for some project and testing documents, as recorded in the [test plan](../../03-testing/test-plan.md). My individual use of AI for diagrams or frontend work should be reported accurately by naming the tool and the material it affected. I reviewed the system design against the implemented application and remain responsible for the diagrams and frontend contributions I submit as my work.

## Reflection

### 1. Lessons learned

Building JoinGun with AI changed every stage of the work. Requirements and design moved faster: an agent could turn the spec and `rule.md` into user stories, and I could ask for screens and diagrams and get a first version in minutes. Coding and testing also sped up, because the AI wrote Express routes, the `web/` modules and Playwright tests from short instructions. The catch was that I had to check everything myself, especially privacy features such as separate consent for location and participation history.

What got better: the diagrams. Instead of drawing pictures by hand, I kept D1–D4 in [diagrams.md](../../02-design/diagrams.md) as Mermaid drafted from the actual code, so the architecture describes what the app really does. The browser tests also caught a real design bug, a welcome page wider than a phone screen, which I would have missed by eye.

What got worse: keeping documents consistent. The AI produced code and documents faster than the team could review them. Our older PNG diagrams still show Google Maps and an external AI engine that we never built, and several choices in `DECISIONS.md` were made before the team discussed them. Quality now depends less on writing and more on reviewing, and teamwork has to include agreeing on what the AI is allowed to decide.

### 2. Where I stand in the AI era

I stand in the space between design and engineering. AI has made that gap smaller: a designer can now build working screens, and a developer can produce decent layouts. I want to be the person who understands both sides well enough to tell when the AI's version of a design breaks the user's experience.

### 3. My plan

Next year, I will focus on frontend development: modern JavaScript, a framework such as React, testing, and accessibility, and I will apply for a frontend internship. In five years, I want to be a senior frontend developer who builds fast, accessible interfaces and guides how a team uses AI tools safely.
