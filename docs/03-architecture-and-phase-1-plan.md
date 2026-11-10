# Architecture & Phase-1 Build Plan

**Date:** 2026-10-20 · Builds on docs 01 (requirements/NFR) and 02 (template/data model).

---

## 1. Architecture at a glance

A **modular monolith** — the right weight for ~50 users and a small team. One deployable app, clean module boundaries inside, so it stays simple to run but easy to split later if needed.

```
┌─────────────────────────────────────────────────────────┐
│  Next.js (App Router, TypeScript)                        │
│  ├── UI (React, shadcn/ui, TanStack Table/Query)         │
│  └── API layer (Route Handlers + Server Actions)         │
│        └── Application services (use-cases)              │
│              └── Domain modules (ticket, wbs, plan, …)   │
│                    └── Prisma (PostgreSQL)               │
└──────────────┬───────────────────────┬──────────────────┘
               │                       │
       ┌───────▼──────┐        ┌───────▼────────┐
       │ Worker proc  │        │  Adapters      │
       │ (BullMQ)     │        │  (interfaces)  │
       │ AI gen,      │        │  • AiProvider  │ → Claude / OpenAI
       │ export,      │        │  • MailReader  │ → Gmail (read-only)
       │ gmail sync,  │        │  • JiraImport  │ → Jira REST
       │ notify       │        │  • FileStore   │ → S3/R2
       └──────────────┘        │  • Notifier    │ → email + in-app
                               └────────────────┘
   Redis (queue + cache)   ·   PostgreSQL   ·   S3/R2 (attachments)
```

**Why this shape**
- **One language (TypeScript)** end to end; shared types between UI and API.
- **Adapters behind interfaces** — swap Claude↔OpenAI, or Gmail↔Outlook later, no core changes (NFR-1).
- **Worker process** keeps all slow/external work (AI, export, mail sync) off the request path (NFR-2).
- Alternative if you want a harder backend boundary: a separate **NestJS** API service — same modules, just its own process. Not needed at this scale; noted for later.

### 1.1 Stack (final)
Next.js 15 (App Router) · TypeScript · Prisma + PostgreSQL · BullMQ + Redis · Auth.js (Google OIDC + credentials) · shadcn/ui + Tailwind · TanStack Table + Query · dnd-kit (Kanban) · ExcelJS (import/export) · Zod (validation) · Sentry + OpenTelemetry · Docker.

---

## 2. Module layout (modular monolith)

```
/src
  /modules
    /auth          — sessions, Google OIDC, RBAC guards
    /users         — users, roles, preferences
    /clients       — Client (account) entity
    /inquiries     — Ticket CRUD, state machine, assignment
    /attachments   — upload, versioning, FileStore adapter
    /summaries     — AI call-summary generation (schema-bound)
    /wbs           — WBS + WbsItem, generation, approval
    /plans         — ProjectPlan, SprintPlan/Allocation, derive engine
    /rates         — ResourceRate rate card (versioned)
    /templates     — ProjectPlanTemplate (Excel import)
    /estimation    — roll-ups (derived)
    /export        — ExcelJS generators (5 sheets)
    /kanban        — board views, transitions
    /mail          — Gmail read-only link
    /jira          — one-way import
    /notifications — in-app + email
    /activity      — audit log
    /ai            — AiProvider abstraction (Claude/OpenAI)
  /lib             — db, queue, config, logging, zod schemas
  /app             — Next.js routes (UI + API)
  /workers         — BullMQ processors
```

Each module owns its domain logic and Prisma access; cross-module calls go through service interfaces, not direct table reads.

---

## 3. Database schema (Prisma — core tables)

> Illustrative, not final. Derived fields (costs, blended rate, Summary) are **computed**, not columns.

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  image     String?
  roles     Role[]   // enum set: ADMIN, PRESALES, TECHNICAL, VIEWER
  prefs     Json?    // notification preferences
  createdAt DateTime @default(now())
  reported  Inquiry[] @relation("reporter")
  assigned  Inquiry[] @relation("assignee")
}

enum Role { ADMIN PRESALES TECHNICAL VIEWER }

model Client {
  id        String   @id @default(cuid())
  name      String
  domain    String?
  notes     String?
  inquiries Inquiry[]
  createdAt DateTime @default(now())
}

model Inquiry {
  id         String   @id @default(cuid())
  key        String   @unique            // e.g. PRE-1024
  title      String
  type       InquiryType[]               // CALL_REQUIRED, RFP_BASED, POC_REQUIRED, ESTIMATION_ONLY
  status     InquiryStatus @default(NEW)
  priority   Priority @default(MEDIUM)
  source     String?
  dueDate    DateTime?
  tags       String[]
  clientId   String?
  client     Client?  @relation(fields: [clientId], references: [id])
  reporterId String
  reporter   User     @relation("reporter", fields: [reporterId], references: [id])
  assigneeId String?
  assignee   User?    @relation("assignee", fields: [assigneeId], references: [id])
  summary    AiSummary?
  wbs        Wbs?
  plan       ProjectPlan?
  attachments Attachment[]
  comments   Comment[]
  pocLinks   PocLink[]
  emailLinks EmailThreadLink[]
  activity   Activity[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

enum InquiryType   { CALL_REQUIRED RFP_BASED POC_REQUIRED ESTIMATION_ONLY }
enum InquiryStatus { NEW TRIAGED IN_PROGRESS WBS_DRAFTING WBS_REVIEW
                     PLAN_DRAFTING PLAN_REVIEW PLAN_APPROVED
                     POC_IN_PROGRESS POC_DONE DELIVERED WON LOST ARCHIVED }
enum Priority      { LOW MEDIUM HIGH }

model AiSummary {
  id         String  @id @default(cuid())
  inquiryId  String  @unique
  inquiry    Inquiry @relation(fields: [inquiryId], references: [id])
  executive  String
  highlights String[]
  painPoints String[]
  clientWants String[]
  actionItems Json          // [{text, owner?, due?}]
  provider   String         // "anthropic" | "openai"
  model      String
  promptVer  String
  tokensCost Json?
  version    Int     @default(1)
  editedByHuman Boolean @default(false)
  createdAt  DateTime @default(now())
}

model Wbs {
  id        String   @id @default(cuid())
  inquiryId String   @unique
  inquiry   Inquiry  @relation(fields: [inquiryId], references: [id])
  status    ApprovalStatus @default(DRAFT)
  items     WbsItem[]
  approvedById String?
  approvedAt DateTime?
  version   Int @default(1)
}

model WbsItem {
  id          String  @id @default(cuid())
  wbsId       String
  wbs         Wbs     @relation(fields: [wbsId], references: [id])
  module      String?            // the "tab" dimension (e.g. Static Landing Page)
  epic        String?
  feature     String?
  description String?
  sprint      String?
  storyPoints Float?
  hours       Float?
  startDate   DateTime?
  endDate     DateTime?
  priority    Priority?
  release     String?
  order       Int
}

enum ApprovalStatus { DRAFT IN_REVIEW APPROVED REJECTED }

model ResourceRate {
  id            String  @id @default(cuid())
  role          String  // "PM", "SSE - Full stack", ...
  monthlyHours  Float   @default(160)
  ratePerHour   Float
  effectiveMonthly Float?
  version       Int     @default(1)
  active        Boolean @default(true)
}

model ProjectPlan {
  id         String   @id @default(cuid())
  inquiryId  String   @unique
  inquiry    Inquiry  @relation(fields: [inquiryId], references: [id])
  templateId String?
  status     ApprovalStatus @default(DRAFT)
  marginPct  Float    @default(0.1)      // for budget ranges
  sprints    SprintPlan[]
  approvedById String?
  approvedAt DateTime?
  version    Int @default(1)
}

model SprintPlan {
  id           String  @id @default(cuid())
  planId       String
  plan         ProjectPlan @relation(fields: [planId], references: [id])
  releaseGroup String?
  sprintNo     Int
  startDate    DateTime?
  endDate      DateTime?
  summary      String?
  allocations  SprintAllocation[]
  order        Int
}

model SprintAllocation {
  id          String  @id @default(cuid())
  sprintId    String
  sprint      SprintPlan @relation(fields: [sprintId], references: [id])
  role        String   // matches ResourceRate.role
  fteFraction Float    // 0.25, 0.5, 1.0
}

model Attachment {
  id        String @id @default(cuid())
  inquiryId String
  inquiry   Inquiry @relation(fields: [inquiryId], references: [id])
  filename  String
  mime      String
  size      Int
  storageKey String        // S3/R2 key
  version   Int @default(1)
  deletedAt DateTime?       // soft delete
  uploadedById String
  createdAt DateTime @default(now())
}

model PocLink { id String @id @default(cuid()) inquiryId String url String label String? status String? notes String? }
model EmailThreadLink { id String @id @default(cuid()) inquiryId String gmailThreadId String subject String? snippet String? linkedById String createdAt DateTime @default(now()) }
model Comment { id String @id @default(cuid()) inquiryId String authorId String body String createdAt DateTime @default(now()) }
model Activity { id String @id @default(cuid()) inquiryId String actorId String action String meta Json? createdAt DateTime @default(now()) }
model ProjectPlanTemplate { id String @id @default(cuid()) name String layout Json version Int @default(1) active Boolean @default(true) }
model Notification { id String @id @default(cuid()) userId String type String payload Json readAt DateTime? createdAt DateTime @default(now()) }
```

---

## 4. The derive engine (the heart of the plan)

A pure, tested function set — **no stored cost columns**:

```
deriveSprint(sprint, rates):
  hours        = Σ alloc.fteFraction × rate(alloc.role).monthlyHours
  costPerSprint= Σ alloc.fteFraction × rate(alloc.role).effectiveMonthly
  blendedRate  = hours > 0 ? costPerSprint / hours : null   // guards #DIV/0!

derivePlan(plan, rates):
  sprints      = plan.sprints.map(deriveSprint)
  budgetByRelease   = group sprints by releaseGroup → Σ cost, range = ±marginPct
  budgetByDeliverable = group WBS by release/deliverable → Σ cost
  teamSummary  = per role: avg fteFraction across sprints
  monthlyBurn  = cost of a representative month
  total        = Σ costPerSprint
```

Rendered live in the UI and regenerated into the Excel Summary sheet on export. Unit-tested against the numbers in your sample file.

---

## 5. AI generation contracts (provider-agnostic)

One `AiProvider` interface, two adapters (Claude, OpenAI), selected by config. All calls run as **async jobs** and return **schema-validated JSON** (Zod), never free text.

**Summary** — input: transcript → output:
```json
{ "executive": "string", "highlights": ["string"], "painPoints": ["string"],
  "clientWants": ["string"], "actionItems": [{"text":"string","owner":"string?","due":"string?"}] }
```

**WBS** — input: RFP/requirement text (+ optional module list) → output:
```json
{ "items": [{ "module":"string?","epic":"string","feature":"string","description":"string",
  "sprint":"string?","storyPoints":"number?","hours":"number?","priority":"LOW|MEDIUM|HIGH",
  "release":"string?" }] }
```

**Plan seed** — input: approved WBS → output: suggested `SprintPlan[]` + `SprintAllocation[]` (fractional FTE per role), which the derive engine then costs.

Each result stores `provider / model / promptVer / tokensCost`, is editable, and is versioned (NFR-10). Regeneration **diffs against human edits** and asks before overwriting.

---

## 6. API surface (representative)

```
POST   /api/inquiries                 create ticket
GET    /api/inquiries?filters         list (server-side paging)
GET    /api/inquiries/:id             detail
PATCH  /api/inquiries/:id             update / assign
POST   /api/inquiries/:id/transition  state change (guarded by state machine)
POST   /api/inquiries/:id/attachments upload (→ FileStore)

POST   /api/inquiries/:id/summary     enqueue AI summary
PATCH  /api/summaries/:id             edit summary

POST   /api/inquiries/:id/wbs/generate   enqueue AI WBS
GET/PATCH /api/wbs/:id/items             inline edit rows
POST   /api/wbs/:id/approve              (assignee self-approve, gated)

POST   /api/inquiries/:id/plan/generate  seed from approved WBS
GET/PATCH /api/plans/:id/sprints         inline edit allocations
POST   /api/plans/:id/approve
GET    /api/plans/:id/export.xlsx        5-sheet Excel

GET/POST/PATCH /api/rates                rate card (admin)
POST   /api/templates                    upload Excel template (admin)
GET    /api/notifications                in-app feed
POST   /api/integrations/gmail/link      link a thread (read-only)
POST   /api/integrations/jira/import     import tickets
```

Every mutating route: Zod-validated, RBAC-guarded, activity-logged, optimistic-concurrency on inline edits (NFR-11).

---

## 7. Phase-1 build breakdown (incremental, each shippable)

| # | Milestone | Delivers |
|---|---|---|
| **0** | **Foundation** | Repo, Docker (Postgres+Redis), Prisma init, CI (lint/type/test), Auth.js Google SSO + RBAC, app shell/layout. |
| **1** | **Inquiries core** | Client entity, ticket CRUD, assignment, attachments (S3/R2), comments, activity log, **state machine**. |
| **2** | **Kanban + list** | Board (dnd-kit) with guarded transitions, list view, filters/search. |
| **3** | **AI summary** | `AiProvider` abstraction (Claude+OpenAI), async job + progress, schema-bound editable summary. |
| **4** | **WBS** | AI WBS generation, editable listing (TanStack Table, hierarchy, reorder), approval flow. |
| **5** | **Rates + Plan + derive engine** | Rate card admin, plan seed from WBS, inline-editable sprints/allocations, live derived costs & Summary. |
| **6** | **Excel export/import** | 5-sheet export matching the template; admin template upload. |
| **7** | **Integrations + notifications** | Gmail read-only linking, in-app + email notifications, Jira import. |
| **8** | **Hardening** | Observability (Sentry/OTel), E2E tests on inquiry→WBS→plan→export, perf pass, security review. |

Milestones 0–2 give a usable ticketing+Kanban tool fast; 3–6 deliver the AI→WBS→Plan→Export core (the end goal); 7–8 complete and harden.

---

## 8. What I need to start milestone 0

- **Confirm the stack** above (or flag changes).
- **GitHub repo** — create it, or I scaffold locally first and we push later.
- **Cloud choice** for later deploy: AWS vs GCP vs Cloudflare (R2 for storage). Not needed to start coding.
- **AI keys** — Anthropic and/or OpenAI (can use env placeholders until ready).

On your go, milestone 0 is: scaffold the Next.js + Prisma + Docker project, Auth.js Google SSO, RBAC, and the module skeleton — a running app you can log into.
