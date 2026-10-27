# JoinGun — เอกสารเตรียมส่ง W5

## JoinGun app — Node.js, Express, SQLite and a Capacitor Android app (build 0.3.0)

The app covers F1–F6 of the spec: `.ac.th` email-code sign-up, activity posts with a map pin and place search, a paged feed with search and filters, joining and leaving, reminders and in-app notifications (with optional email), friends, a profile page whose activity history follows the owner's privacy setting, explainable activity recommendations behind their own consent, reports, blocks, a moderator screen with appeals, data download and account deletion. The UI in `web/` is a phone-app layout on every screen (bottom tab bar, light and dark themes) and also runs as an Android app through Capacitor (`android/`, `capacitor.config.json`), with activity reminders scheduled on the phone. Optional profile fields are stored encrypted.

From the repository root: `npm ci`, then `npm start`, and open `http://127.0.0.1:3000`. Requires Node.js 22.13+. `npm test` runs the API and database integration tests; `npm run seed` adds sample activities for local testing; `npm run moderator -- <username>` gives an account the moderator screen. GitHub Actions runs `npm test` on every push (`.github/workflows/test.yml`). `npm run perf` measures API response times (NFR1/NFR4) and `npm run bias-report` checks who recommendations favour. Android app: set `server.url` in `capacitor.config.json`, run `npm run cap:sync`, then `npm run cap:open` in Android Studio (see server/README.md, "Android app").

See [server/README.md](server/README.md) for the API, schema, configuration and limits, and [DECISIONS.md](DECISIONS.md) for choices made without a team decision. `.docs/02-design/prototype/` remains as the design reference. The earlier design notes below describe the original prototype.

โครงสร้างนี้จัดตามคำสั่งส่งอาจารย์และสไลด์ W2–W4: ใช้ `.docs/` (มีจุดนำหน้า) สำหรับเอกสารทำงาน และ `rule.md` ที่ราก repo ส่วน `เอกสาร/` เก็บต้นฉบับและสไลด์อ้างอิง

## ไฟล์ปัจจุบัน

```text
joingun/
├── README.md
├── rule.md
├── .docs/
│   ├── 01-requirements/
│   │   ├── backlog.md
│   │   └── 01-spec/
│   │       ├── 20260908-01-joingun.md
│   │       └── 20260908-02-legal-traceability.md
│   └── 02-design/
│       ├── feature-list.md
│       ├── user-journey.md
│       ├── design-system.md
│       ├── prototype.md
│       └── prototype/
│           ├── index.html
│           ├── styles.css
│           └── app.js
└── เอกสาร/
    └── เอกสารต้นฉบับและสไลด์ W2–W4
```

วันที่ในชื่อ spec เป็นวันที่จัดสำเนาเข้าโครงสร้างนี้ ไม่ใช่วันที่สร้างต้นฉบับ ให้แก้ฉบับทำงานใน `.docs/` และ `rule.md` ต่อจากนี้; ต้นฉบับใน `เอกสาร/` เก็บไว้เทียบที่มา

## รายการส่งอาจารย์และสถานะ

| รายการ | ตำแหน่ง | สถานะปัจจุบัน |
| --- | --- | --- |
| Updated Proposal: problem statement + target users | เสนอให้ใช้ `.docs/00-proposal/proposal.md` และส่งออก PDF หากต้องการ | มีเพียง [proposal ต้นฉบับ](เอกสาร/proposal.pdf); ยังไม่ได้อัปเดต และยังมีช่องข้อมูลทีม/วิธีทำงาน/กำหนดการ/อ้างอิงที่ไม่ครบ |
| Product Backlog | [backlog.md](.docs/01-requirements/backlog.md) | ถอด 22 รายการจาก PDF พร้อม Trace และรายการช่องว่าง; ยังไม่ใช่ฉบับผ่าน audit |
| Requirement Spec รวม Legal Requirements | [Spec](.docs/01-requirements/01-spec/20260908-01-joingun.md) | คัดลอกเนื้อหาเดิมครบ 5 ส่วน มี F/NFR/LR แต่ยังต้องปิดช่องว่างการ trace |
| W2 Compliance | [rule.md](rule.md) และ [Legal traceability](.docs/01-requirements/01-spec/20260908-02-legal-traceability.md) | คัดลอกกฎเดิมและเพิ่มตารางเชื่อม LR1–LR5; ระบุข้อที่ยังไม่ครอบคลุมไว้แล้ว |
| Feature list | [feature-list.md](.docs/02-design/feature-list.md) | มี 7 บรรทัด เลือก core เดียว |
| User journey | [user-journey.md](.docs/02-design/user-journey.md) | มี happy path 5 ขั้นตอน: เข้าร่วมกิจกรรมจากฟีด |
| Design system | [design-system.md](.docs/02-design/design-system.md) | มี tokens และ component rules; สี/ฟอนต์เป็นข้อเสนอ ยังไม่มีภาพ UI อ้างอิงของทีม |
| Prototype | [วิธีเปิดและทดลอง](.docs/02-design/prototype.md) และ [HTML](.docs/02-design/prototype/index.html) | สร้างแล้ว: ฟีด ตัวกรอง รายละเอียด consent และผลสำเร็จ ใช้ข้อมูลจำลอง |
| 4 diagrams | `.docs/02-design/diagrams.md` พร้อม source ใน `.docs/02-design/diagrams/` | ยังไม่ได้สร้าง |

คำสั่งอาจารย์ไม่ได้กำหนด path ของ Proposal: `00-proposal/` เป็นข้อเสนอจัดเก็บ ส่วน path ของ backlog, design และตำแหน่ง root ของ rule มีระบุในคำสั่ง/สไลด์

## เปิด prototype

Run `npm start` and open `http://127.0.0.1:3000` to use the web UI in `web/` with the backend. Direct file opening does not provide database access. See [server/README.md](server/README.md#web-ui-web); the static prototype is described in [prototype.md](.docs/02-design/prototype.md).

## ไฟล์ที่ยังต้องสร้าง

- `.docs/00-proposal/proposal.md` — Updated Proposal
- `.docs/02-design/diagrams.md` — D1–D4 พร้อม source ที่แก้ไขได้ใน `diagrams/`

Prototype ให้ยึด journey และ design-system เดิม: หน้าฟีดพร้อมตัวกรอง → รายละเอียดกิจกรรม → ยืนยันและแสดงผลสำเร็จ ใช้ 3 หน้าหลักร่วมกับแผงยืนยันได้ ไม่จำเป็นต้องสร้าง 5 หน้าเพียงเพราะ journey มี 5 ขั้นตอน ต้องเป็น mobile-first, เนื้อหาไม่เกิน 480px และปุ่มกดได้สะดวก

แผนภาพต้องมี D1 System Context, D2 Use Case หรือ User Story Map, D3 Architecture และ D4 Activity หรือ Sequence โดยใช้ core workflow และชื่อ actor เดียวกับเอกสารออกแบบ D3 ต้องสอดคล้องกับ tech stack ที่ทีมระบุจริงใน Proposal ซึ่งต้นฉบับยังไม่กำหนด

## สิ่งที่ต้องทำก่อนส่งขึ้น repo

1. อัปเดต Proposal จากข้อมูลจริงของทีม โดยเฉพาะ problem statement, target users และ tech stack ที่ใช้ทำ D3
2. เชื่อม pain/evidence จริง → F/NFR/LR → backlog; เติม story การ join/leave ที่ยังไม่มี F แยก และปรับ priority ที่ไม่ตรงกัน โดยไม่แต่งหลักฐานการสัมภาษณ์
3. ปิดช่องว่างใน Legal traceability โดยเฉพาะหลักฐาน consent และการแยกหัวข้อ ETA/จริยธรรม AI ใน rule เดิม
4. สร้าง D1–D4 ให้ตรงกับ prototype ที่มีแล้ว และทดลองใช้งานต้นแบบบนมือถือจริง
5. เชื่อม Git repository ที่ทีมใช้ ตรวจไฟล์ที่จะ commit แล้ว commit/push; ใช้ remote `origin` ที่ `https://github.com/maefahluang-uni/Join-Gun.git` และ branch `main` สำหรับเอกสารชุดนี้

W3 ยังระบุงานเครื่องมือประกอบ: `CLAUDE.md`, `.claude/agents/requirement-writer.md`, skill `.claude/skills/audit-backlog/SKILL.md` และโครงสร้าง log `.docs/05-log/` (หน้า 15, 22) ซึ่งยังไม่พบในชุดไฟล์นี้ ต้องตรวจงานที่ทีมอาจทำไว้ใน repo เดิม ไม่สร้างไฟล์เปล่าหรืออ้างว่ารัน audit แล้ว ส่วนรายการส่ง 4 ข้อล่าสุดไม่ได้เรียกชื่อไฟล์เครื่องมือเหล่านี้โดยตรง

## อ้างอิงโครงสร้าง

- [W2](<เอกสาร/Week 2 — AI Ethics, PDPA & IT Law — 1305493.pdf>) หน้า 17, 19–21: rule ที่ root และการนำกฎไปเป็น LR/backlog
- [W3](<เอกสาร/Week 3 — Requirements → Backlog with AI Agents & Skills — 1305493.pdf>) หน้า 9–11, 15, 22: traceability, spec 5 ส่วน, path และงานที่ต้องอยู่บน GitHub
- [W4](<เอกสาร/W4 — Design with Agents — Case Study — 1305493.pdf>) หน้า 3–4, 7, 15–19: design folder, core workflow เดียว, prototype และ D1–D4
