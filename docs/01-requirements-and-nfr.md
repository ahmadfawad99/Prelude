# PreSales Tool — Refined Requirements & Non-Functional Requirements

**Status:** Draft v1 · **Date:** 2026-10-20 · **Owner:** Ahmad Fawad (Clustox)

---

## 1. Vision & Scope

A single, production-grade platform that holds **everything** for the presales lifecycle — inquiry, call summary, requirement docs, POC links, Work Breakdown Structure (WBS), estimation, and the final Project Plan — so no artifact lives scattered across Jira, ChatGPT, email, and spreadsheets.

The tool **replaces Jira** as the source of truth for presales tickets (Jira import is supported for migration only). It is **cloud-hosted, single-tenant** (Clustox only), sized for a small internal team (~10–50 users).

### 1.1 The end goal
Every inquiry flows toward **one deliverable: an approved Project Plan.** The system is the rail that moves a ticket from raw call transcript → summary → requirements → WBS (approved) → Project Plan (approved) → export.

### 1.2 Out of scope (v1)
- Multi-tenancy / reselling to other agencies.
- Automated POC *generation* (POCs are built manually in Claude Code; the tool only **tracks and links** them).
- Billing/invoicing, CRM pipeline/deal management, time tracking.

---

## 2. Actors & Roles (RBAC)

| Role | Responsibility |
|---|---|
| **Admin** | Manage users, roles, project-plan templates, resource rates, integrations, global settings. Can edit/override any artifact. |
| **Presales** | Create inquiry tickets, attach transcripts/RFPs, generate AI summaries, assign to technical team. |
| **Technical Lead / Assignee** | Work the ticket: generate & edit WBS, build estimation, generate & edit Project Plan, link POCs, **and approve them**. |
| **Viewer** | Read-only access to tickets and artifacts. |

> Roles are **permission sets**, not fixed job titles — one user may hold several. Every sensitive action is permission-gated and audit-logged.
>
> **Approval model (confirmed):** there is **no separate Approver role**. The ticket's **assignee (the person working on it) self-approves** the WBS and Project Plan. Approval is still a recorded, gated state transition (actor + timestamp + comment), it just doesn't require a different person. A future "require second approver" toggle can be added via config without schema changes.

---

## 3. Core Domain Model

```
Inquiry (Ticket)  ──1:1──  AI Summary
   │
   ├──*── Attachments (transcripts, RFP/RFI, requirement docs, misc)
   ├──*── Comments / Activity
   ├──*── Email Threads (Gmail-linked)
   ├──*── POC Links (external — built in Claude Code)
   ├──0..1── WBS  ──*── WBS Items (hierarchical)   → has approval state
   ├──0..1── Estimation (derived from WBS)
   └──0..1── Project Plan  ──*── Plan Rows (template-driven) → has approval state
```

**Inquiry attributes:** key/ID, title, reporter, assignee, client/account, status, type, priority, source, created/updated, due date, tags/labels.

**Inquiry type** (drives the workflow): `Call-Required` · `RFP/RFI-Based` · `POC-Required` · `Estimation-Only`. A ticket may carry more than one type.

---

## 4. Workflow (State Machine)

The ticket status is an explicit, enforced state machine — no "foolish or incomplete" transitions allowed.

```
NEW → TRIAGED → IN_PROGRESS
        │
        ├─(RFP/requirement doc present)→ WBS_DRAFTING → WBS_REVIEW
        │        ├─ rejected → WBS_DRAFTING (loop with comments)
        │        └─ approved → PLAN_DRAFTING → PLAN_REVIEW
        │                              ├─ rejected → PLAN_DRAFTING
        │                              └─ approved → PLAN_APPROVED
        │
        └─(POC-required)→ POC_IN_PROGRESS → POC_DONE → (re-joins WBS or PLAN flow)

Terminal: DELIVERED · WON · LOST · ARCHIVED
```

**Hard rules**
- A Project Plan **cannot** enter drafting until its WBS is `approved`. The UI and API both enforce this gate.
- Approval/rejection requires a comment (audit trail).
- Every state change is logged with actor + timestamp + reason.

---

## 5. Functional Requirements

### FR-1 — Inquiry / Ticket Management
- CRUD tickets with reporter, assignee, client, type, priority, tags, due date.
- Attachments: upload (drag-drop), preview, version, delete (soft-delete), download. Support PDF, DOCX, XLSX, images, TXT.
- Threaded comments + full activity timeline.
- Assignment with notification to assignee.

### FR-2 — AI Call Summary
- Paste a call transcript (or upload); generate an **executive summary, key highlights, pain points, client wants, and action items** in a structured, consistent schema (not freeform).
- Summary is **editable** after generation (human-in-the-loop) and versioned.
- **Pluggable AI provider**: Claude or OpenAI, selectable per environment/org via config; same prompt contract and output schema for both.
- Show provider + model + token cost per generation for transparency.

### FR-3 — Document-Driven WBS Generation
- When an RFP/RFI/requirement doc is attached, generate a **comprehensive, hierarchical WBS** (phases → epics → tasks, with effort placeholders).
- WBS renders as an **editable listing/table view** — inline add/edit/delete/reorder rows, indent/outdent for hierarchy.
- WBS has an **approval workflow** (submit → review → approve/reject with comments).
- Regenerate is allowed but never silently overwrites human edits (diff/confirm).

### FR-4 — Project Plan
- Generated **only after WBS approval**; seeded from the approved WBS.
- Renders as an **inline-editable listing** matching a **Project Plan template**.
- **Template managed by Admin**: upload/update the template via Excel sheet (or Admin provides a plan file that becomes the template).
- Approval workflow (submit → review → approve/reject).
- Inline-editable sections/fields per the template's columns.

### FR-5 — Estimation
- Derived from WBS effort; roll-up totals by phase/role; editable; included in the Project Plan.

### FR-6 — POC Tracking
- POCs are built manually (Claude Code) — the tool stores **links, repo/artifact references, status, and notes**, tied to the ticket. No generation.

### FR-7 — Export
- Export **WBS, Project Plan, and Estimation to Excel (.xlsx)** — faithful to the on-screen listing. (PDF export a nice-to-have.)

### FR-8 — Kanban Board
- Jira-style board: columns = workflow states, cards = tickets, drag-drop to transition (respecting the state-machine rules), swimlanes/filters by assignee, client, type, priority. List view alternative.

### FR-9 — Gmail Integration (read-only, v1)
- Connect a Gmail account (OAuth, **read-only scope**); **link/attach client email threads to a ticket** so communication lives with the inquiry.
- v1 scope: **read + link only**. No sending or replying from the tool in v1 (deferred). Minimal OAuth scopes.

### FR-10 — Notifications
- In-app notification center + email notifications for: assignment, mention, WBS/Plan submitted for review, approval/rejection, status change, new client email linked.
- Per-user notification preferences.

### FR-11 — Authentication & Sign-up
- **Google SSO / "Sign up with Google"** as the primary auth, plus email/password fallback.
- Role assignment on first login (Admin approves new users, or domain-restricted auto-provision for @clustox.com).

### FR-12 — Jira Integration (Migration/Import)
- Since the tool **replaces** Jira: one-time/periodic **import** of existing Jira tickets (fields, attachments, comments) to migrate. Full two-way sync is explicitly **not** a v1 goal.

### FR-13 — Audit & Activity
- Immutable audit log for all create/update/delete/approve/transition actions.

### FR-14 — Search & Filtering
- Global search across tickets, summaries, WBS, and plans; faceted filters (status, type, assignee, client, date range, tags).

---

## 6. Non-Functional Requirements (NFRs)

### NFR-1 — Architecture & Quality
- Clean, layered, modular architecture (domain / application / infra / API / UI). Integrations (AI, Gmail, Jira) behind **adapter interfaces** so providers are swappable.
- No "sluggish" or dead-end flows: every screen has loading, empty, error, and success states; every destructive action confirms and is reversible (soft-delete + restore where feasible).

### NFR-2 — Performance
- P95 page/API response < 500 ms for standard reads; listing views handle 10k+ rows via server-side pagination/virtualized tables.
- AI generation is **async with progress feedback** (job queue + streaming where possible); never blocks the UI thread.
- Excel export of large artifacts completes < 10 s or streams/background-jobs with download notification.

### NFR-3 — Reliability & Availability
- Target 99.5% uptime. Graceful degradation: if an AI provider or Gmail is down, the core ticketing still works.
- All external calls (AI, Gmail, Jira) have timeouts, retries with backoff, and circuit-breaking. Idempotent job processing.
- Automated DB backups (daily + point-in-time where supported); tested restore.

### NFR-4 — Security
- Google OAuth 2.0 / OIDC; secure session management; CSRF protection; RBAC enforced server-side on every endpoint (never trust the client).
- Secrets in a secrets manager (not in code/env files committed to repo). API keys (AI, Gmail, Jira) encrypted at rest.
- Encryption in transit (TLS 1.2+) and at rest (DB + object storage for attachments).
- Input validation & output encoding (prevent XSS/SQLi); file-upload scanning and type/size limits.
- Principle of least privilege for integration scopes (Gmail: minimal scopes needed).
- Full audit logging; no PII in logs.

### NFR-5 — Privacy & Compliance
- Client call transcripts and emails are sensitive — access restricted by role, encrypted, and retention-policy configurable. Data deletion on request.
- Clear data-residency choice (cloud region) at deployment.

### NFR-6 — Scalability
- Stateless application tier (horizontal scale); background workers scale independently for AI/export jobs. Sized for ~50 users now; architecture must not block growth to a few hundred.

### NFR-7 — Observability
- Structured logging, metrics, distributed tracing; error tracking (e.g., Sentry); dashboards + alerting on error rate, latency, queue depth, integration failures.

### NFR-8 — Maintainability & Testability
- Automated tests: unit (domain/services), integration (API + DB), E2E for the critical path (inquiry → WBS → plan → export). CI runs tests + lint + type-check on every PR.
- Type-safe end to end; documented API (OpenAPI); seeded demo data; one-command local dev.

### NFR-9 — Usability & Accessibility
- Responsive (desktop-first, usable on tablet). WCAG 2.1 AA target. Consistent design system, keyboard navigation for tables/boards, undo for inline edits.

### NFR-10 — Auditability of AI
- Every AI output records provider, model, prompt version, input reference, timestamp, and cost; outputs are editable and versioned so human changes are never lost or silently overwritten.

### NFR-11 — Data Integrity
- Referential integrity enforced (FKs); optimistic concurrency on inline-editable listings to prevent lost updates when two people edit; transactional writes.

### NFR-12 — Configurability
- Admin-configurable: project-plan template, AI provider/model, notification rules, role permissions, workflow SLAs — without code changes.

---

## 7. Recommended Technology Stack

> Chosen for: AI integration, real-time boards, heavy tabular editing, and production maturity for a small team.

| Layer | Choice | Why |
|---|---|---|
| **Frontend** | Next.js (React) + TypeScript, TanStack Table/Query, Tailwind + shadcn/ui | Great for inline-editable listings, Kanban (dnd-kit), SSR, and a mature ecosystem. |
| **Backend** | NestJS (Node/TS) — or Next.js API routes if kept lean | Modular, DI, adapter-friendly for integrations; one language with the frontend. |
| **Database** | PostgreSQL + Prisma | Relational integrity for the ticket→WBS→plan hierarchy; strong tooling. |
| **Jobs/Queue** | BullMQ + Redis | Async AI generation, exports, email sync with retries. |
| **Object storage** | S3-compatible (AWS S3 / Cloudflare R2) | Attachments at scale, encrypted. |
| **AI** | Provider-abstraction layer over **Anthropic (Claude)** + **OpenAI**, config-selectable | Meets the "configurable/both" requirement. |
| **Auth** | Auth.js (NextAuth) with Google OIDC + email/password | Built-in Google sign-up, session security. |
| **Integrations** | Gmail API, Jira REST (import) | Scoped OAuth, adapter pattern. |
| **Excel** | SheetJS / ExcelJS | WBS & plan export/import. |
| **Observability** | Sentry + OpenTelemetry + structured logs | NFR-7. |
| **Hosting** | AWS or GCP (single region), containerized (Docker) | Single-tenant cloud. |

---

## 8. Build Phasing (suggested)

1. **Foundation** — auth (Google SSO), RBAC, ticket CRUD, attachments, activity log, Kanban + list views.
2. **AI Summary** — transcript → structured, editable, versioned summary; provider abstraction.
3. **WBS** — doc-driven generation, editable listing, approval workflow.
4. **Project Plan** — template management (Excel), generation from approved WBS, inline editing, approval.
5. **Export + Estimation** — Excel export of all artifacts; estimation roll-ups.
6. **Integrations** — Gmail linking, notifications, Jira import.
7. **Hardening** — observability, tests, performance, security review.

---

## 9. Decisions — RESOLVED (2026-10-20)

1. **Approval authority** — ✅ No separate Approver role. The **assignee self-approves** WBS and Project Plan (still a gated, logged transition). See §2.
2. **Gmail scope** — ✅ **Read-only** linking in v1. The tool connects Gmail, reads, and links threads to tickets. **No sending** from the tool in v1.
3. **Project-plan template** — ✅ Received (`Template __ Project Plan (4).xlsx`). Fully modeled in **[02-project-plan-template-and-data-model.md](02-project-plan-template-and-data-model.md)**.
4. **Estimation model** — ✅ Hours **and resource rates**. The template carries a **Resource Rates** table (role → monthly hours, rate/hour, monthly cost); estimation and budget roll-ups derive from it.
5. **Client/Account entity** — ✅ A **standalone, reusable entity** (not a text field), linked to many tickets.

All five are reflected in the data model (doc 02). No open blockers remain for schema/build planning.
