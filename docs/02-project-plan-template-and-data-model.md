# Project Plan Template → Data Model

**Source:** `Template __ Project Plan (4).xlsx` · **Date:** 2026-10-20

This document reverse-engineers your real project-plan template into the system's data model, so the generated Project Plan reproduces the exact sheets, columns, and roll-ups — and exports back to the same Excel layout.

---

## 1. The template has 5 linked sheets

| Sheet | Purpose | Nature |
|---|---|---|
| **Summary** | Executive roll-up: team, budget by release, burn rate, budget by deliverable | **Derived** (computed from the others) |
| **WBS** | Master Work Breakdown Structure (Epic → Feature → …) | **Core input** |
| **Static Landing Page** (and similar per-module tabs) | WBS **detail per module/platform** — same columns as WBS | Core input (one tab per module) |
| **Release Plan** | Sprint-by-sprint resource allocation & cost | **Derived + input** |
| **Resource Rates** | Role → hours, rate/hour, monthly cost | **Reference / rate card** |

> Key insight: **WBS and Release Plan are the two human-edited surfaces; Summary is fully derived; Resource Rates is the rate card that powers all cost math.** The system should compute Summary and the cost columns, never make the user type them twice.

---

## 2. Sheet-by-sheet column mapping

### 2.1 WBS / per-module tabs
Columns (identical across the master **WBS** sheet and each module tab like *Static Landing Page*):

| Col | Field | Type | Notes |
|---|---|---|---|
| A | Epic | string | Grouping level 1 |
| B | Feature | string | Grouping level 2 |
| C | Description | text | |
| D | Sprint | string/enum | e.g. "Sprint 1" |
| E | Story Points | number | |
| F | Hours | number | estimate |
| G | Start Date | date | |
| H | End Date | date | |
| I | Priority | enum | Low / Medium / High |
| J | Release | enum | "Release 1/2/3" |

→ Model as **`WbsItem`** rows belonging to a **`Wbs`**, each tagged with a **module/platform** (the tab) plus epic/feature/sprint/release. "Tabs" = a `module` dimension, not separate tables.

### 2.2 Resource Rates (rate card)

| Col | Field | Example |
|---|---|---|
| A | Role | PM, PSE - Tech lead, SSE - Full stack, SE - Full stack, QA Engineer, AI Engineer, Devops |
| B | Monthly hours | 160 |
| C | Rate/hour | 35, 25, 20, 15, 30… (USD) |
| D | Actual Cost | = monthly hours × rate (full-time) |
| E | Monthly | discounted/effective monthly cost |

→ Model as **`ResourceRate`** (admin-managed rate card). Values are **per-tenant config**, editable by Admin, **versioned** (so old plans keep the rate they were costed at).

### 2.3 Release Plan (sprint allocation & cost)

| Col | Field | Notes |
|---|---|---|
| A | Sprint Release Group | e.g. "Release 2" (spans several sprints) |
| B | Summary / Key Deliverables | narrative per release group |
| C | Sprint | sprint number |
| D / E | Start / End Date | |
| F–J | Allocation per role | PM, SE (Mobile), SE (Fullstack), QA Engineer, DevOps — **fractional FTE** (0.25, 1.0, 0.5…) |
| K | Expected Cost per Sprint | **derived** = Σ(role allocation × role monthly cost) |
| L | Hours | derived from allocations |
| M | Blended Rate | **derived** = Cost ÷ Hours |

→ Model as **`SprintPlan`** rows (one per sprint) with a child set of **`SprintAllocation`** (role → FTE fraction). K/L/M are **computed**, never stored as hand-typed truth (the template even shows a `#DIV/0!` where an empty sprint divided by zero — our system guards that).

### 2.4 Summary (fully derived dashboard)
Three blocks, all computed:
1. **Team Summary** — Role · Responsibilities · Avg Allocation (avg of the role's allocation across sprints).
2. **Summary of Budget** — per release: Budget Range · Time Duration; plus Overall Budget and **Monthly Burn rate**.
3. **Summary of Budget by Deliverables** — Design Discovery / Release 1 / Release 2 … → budget each, and overall total.

→ Not a table the user edits — a **computed view** rendered from WBS + Release Plan + Resource Rates. Budget "ranges" (e.g. `$5000–$6000`) come from a configurable ± margin on the computed point estimate.

---

## 3. Resulting data model (entities)

```
Client (account)
  └── Inquiry (ticket)
        ├── AiSummary (1:1, versioned)
        ├── Attachment* , Comment* , EmailThreadLink* (Gmail read-only), PocLink*
        ├── Wbs (0..1, approvable)
        │     └── WbsItem*   { module, epic, feature, description, sprint,
        │                      storyPoints, hours, startDate, endDate,
        │                      priority, release }
        └── ProjectPlan (0..1, approvable, template-bound)
              ├── SprintPlan*            { releaseGroup, sprintNo, start, end, summary }
              │     └── SprintAllocation* { role, fteFraction }   // F–J
              │        (derived: costPerSprint, hours, blendedRate)
              └── (derived views) SummaryView, BudgetByReleaseView, BudgetByDeliverableView

ResourceRate*  { role, monthlyHours, ratePerHour, monthlyCost, effectiveMonthly, version }
   — tenant-level rate card, Admin-managed, versioned

ProjectPlanTemplate { columns, sheet layout, margin %, version }
   — Admin uploads/updates via Excel (FR-4); drives generation + export
```

**Derived everywhere:** `costPerSprint`, `hours`, `blendedRate`, all Summary figures, budget ranges. Stored inputs are WBS items, sprint allocations, and the rate card. This prevents the stale/duplicated numbers that plague hand-kept spreadsheets.

---

## 4. How this drives the features

- **AI WBS generation (FR-3)** produces `WbsItem` rows in exactly these columns, grouped by module/epic/feature — so the on-screen listing and the Excel export match the template 1:1.
- **Project Plan generation (FR-4)** seeds `SprintPlan` + `SprintAllocation` from the approved WBS (hours → sprints → role allocations), then computes costs from the **versioned rate card**.
- **Inline editing** targets the input cells only (WBS rows, allocations, release summaries); derived columns recompute live.
- **Excel export (FR-7)** regenerates all 5 sheets — WBS tabs, Release Plan, Resource Rates, and the computed Summary — matching this template so output is indistinguishable from a hand-made plan.
- **Admin template update (FR-4)** re-uploads this workbook to change columns, role set, or margins without code changes; the rate card is editable in-app too.

---

## 5. Notes / edge cases observed in the file

- **`#DIV/0!` in Release Plan** (empty sprint, 0 hours) → our Blended Rate must guard divide-by-zero and render `—`.
- **Budget shown as ranges** (`$5000–$6000`) → store a point estimate + a configurable margin %, render the range.
- **Per-module tabs** (Static Landing Page, etc.) vary per project → model as a flexible `module` attribute, not hard-coded sheets.
- **Allocations are fractional FTE** (0.25/0.5/1.0), not hours → cost = Σ(fraction × role monthly cost); hours derive from fraction × monthly hours.
- **Two rate columns** (Actual Cost vs. Monthly) imply a standard vs. discounted/effective rate → keep both on `ResourceRate`.

---

## 6. Next step

With this model locked, the next artifact is **`03-architecture-and-phase-1-plan.md`**: concrete DB schema (Prisma), API surface, the AI generation contracts (summary + WBS + plan JSON schemas), and the Phase-1 build breakdown.
