import type { InquiryStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logActivity } from "@/modules/activity/service";
import { transitionInquiry, advanceInquiryTo } from "@/modules/inquiries/service";
import { InvalidTransitionError } from "@/modules/inquiries/state-machine";
import { getProvider } from "@/modules/ai";
import { buildRateMap, derivePlan } from "./derive";
import { listActiveRates } from "@/modules/rates/service";

async function tryTransition(inquiryId: string, to: InquiryStatus, actorId: string) {
  try {
    await transitionInquiry(inquiryId, to, actorId);
  } catch (e) {
    if (!(e instanceof InvalidTransitionError)) throw e;
  }
}

// The Release Plan's fixed role columns, matching the standard template.
export const RELEASE_PLAN_ROLES = ["PM", "SE (Mobile)", "SE (Fullstack)", "QA Engineer", "DevOps"];

// Story points one 2-week sprint delivers (team velocity) — per the team, 120–140.
// The sprint COUNT = ceil(points / capacity), and total cost = Σ (sprint FTE ×
// rate), so WBS story-point changes flow into cost when they change the sprint
// count (i.e. when total points cross a ~130-point sprint boundary).
export const SPRINT_CAPACITY_SP = 130;
export const SPRINT_WEEKS = 2;

// Default role mix seeded onto each sprint (names match RELEASE_PLAN_ROLES).
const DEFAULT_ALLOCATIONS: { role: string; fteFraction: number }[] = [
  { role: "PM", fteFraction: 0.25 },
  { role: "SE (Fullstack)", fteFraction: 1.0 },
  { role: "QA Engineer", fteFraction: 0.5 },
  { role: "DevOps", fteFraction: 0.25 },
];

export function getPlan(inquiryId: string) {
  return prisma.projectPlan.findUnique({
    where: { inquiryId },
    include: { sprints: { include: { allocations: true }, orderBy: { order: "asc" } } },
  });
}

/**
 * Re-sync an existing (non-approved) plan's sprint structure to the current WBS:
 * recompute how many 2-week sprints each release needs from its story points,
 * then add default-allocated sprints or remove trailing ones so the count
 * matches — PRESERVING the allocations of sprints that remain. Cost (derived from
 * allocations × rates) therefore tracks WBS changes without wiping manual tuning.
 * Skips approved plans (reopen first). Returns true if anything changed.
 */
export async function resyncPlanFromWbs(inquiryId: string): Promise<boolean> {
  const [plan, wbs, inquiry] = await Promise.all([
    prisma.projectPlan.findUnique({
      where: { inquiryId },
      select: { id: true, status: true, sprints: { select: { id: true, releaseGroup: true, order: true }, orderBy: { order: "asc" } } },
    }),
    prisma.wbs.findUnique({ where: { inquiryId }, select: { items: { select: { storyPoints: true, release: true } } } }),
    prisma.inquiry.findUnique({ where: { id: inquiryId }, select: { startDate: true } }),
  ]);
  if (!plan || plan.status === "APPROVED" || !wbs) return false;

  // Needed sprint count per release, in WBS release order.
  const relOrder: string[] = [];
  const relSP = new Map<string, number>();
  for (const it of wbs.items) {
    const rel = it.release?.trim() || "Release 1";
    if (!relSP.has(rel)) {
      relSP.set(rel, 0);
      relOrder.push(rel);
    }
    relSP.set(rel, (relSP.get(rel) ?? 0) + (it.storyPoints ?? 0));
  }
  if (relOrder.length === 0) {
    relOrder.push("Release 1");
    relSP.set("Release 1", 0);
  }
  const need = new Map(relOrder.map((rel) => [rel, Math.max(1, Math.ceil((relSP.get(rel) ?? 0) / SPRINT_CAPACITY_SP))]));

  // Existing sprints grouped by release (preserve their order = their allocations).
  const haveByRel = new Map<string, { id: string }[]>();
  for (const s of plan.sprints) {
    const rel = s.releaseGroup?.trim() || "Release 1";
    (haveByRel.get(rel) ?? haveByRel.set(rel, []).get(rel)!).push({ id: s.id });
  }

  const toDelete: string[] = [];
  const toAdd: { release: string }[] = [];
  // Releases no longer in the WBS → drop entirely.
  for (const [rel, list] of haveByRel) if (!need.has(rel)) toDelete.push(...list.map((s) => s.id));
  // Per needed release, add/trim to the target count.
  for (const rel of relOrder) {
    const have = haveByRel.get(rel) ?? [];
    const target = need.get(rel) ?? 1;
    if (have.length > target) toDelete.push(...have.slice(target).map((s) => s.id));
    else for (let i = have.length; i < target; i++) toAdd.push({ release: rel });
  }

  if (toDelete.length === 0 && toAdd.length === 0) return false;

  await prisma.$transaction(async (tx) => {
    if (toDelete.length) await tx.sprintPlan.deleteMany({ where: { id: { in: toDelete } } });
    for (const a of toAdd) {
      await tx.sprintPlan.create({
        data: { planId: plan.id, sprintNo: 0, order: 9999, releaseGroup: a.release, allocations: { create: DEFAULT_ALLOCATIONS } },
      });
    }
    // Re-number + re-date the whole plan in WBS release order.
    const remaining = await tx.sprintPlan.findMany({ where: { planId: plan.id }, select: { id: true, releaseGroup: true }, orderBy: { order: "asc" } });
    const relRank = new Map(relOrder.map((r, i) => [r, i]));
    remaining.sort((x, y) => (relRank.get(x.releaseGroup?.trim() || "Release 1") ?? 99) - (relRank.get(y.releaseGroup?.trim() || "Release 1") ?? 99));
    const DAY = 86_400_000;
    const base = inquiry?.startDate
      ? new Date(Date.UTC(inquiry.startDate.getUTCFullYear(), inquiry.startDate.getUTCMonth(), inquiry.startDate.getUTCDate()))
      : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
    for (let i = 0; i < remaining.length; i++) {
      const s = new Date(base.getTime() + i * SPRINT_WEEKS * 7 * DAY);
      const e = new Date(s.getTime() + (SPRINT_WEEKS * 7 - 1) * DAY);
      await tx.sprintPlan.update({ where: { id: remaining[i].id }, data: { sprintNo: i + 1, order: i, startDate: s, endDate: e } });
    }
  });
  return true;
}

/**
 * Re-date an existing plan's sprints to run as consecutive 2-week blocks from
 * `start`. No-op if the lead has no plan yet. Returns the number of sprints moved.
 */
export async function redateSprintsFromStart(inquiryId: string, start: Date): Promise<number> {
  const plan = await prisma.projectPlan.findUnique({
    where: { inquiryId },
    select: { id: true, sprints: { select: { id: true }, orderBy: { order: "asc" } } },
  });
  if (!plan || plan.sprints.length === 0) return 0;

  const DAY = 86_400_000;
  // Normalize to UTC midnight so sprint dates match the stored start date exactly.
  const base = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));

  await prisma.$transaction(
    plan.sprints.map((sp, i) => {
      const s = new Date(base.getTime() + i * SPRINT_WEEKS * 7 * DAY);
      const e = new Date(s.getTime() + (SPRINT_WEEKS * 7 - 1) * DAY);
      return prisma.sprintPlan.update({ where: { id: sp.id }, data: { startDate: s, endDate: e } });
    }),
  );
  return plan.sprints.length;
}

/** Generate a Project Plan seeded from the APPROVED WBS. Replaces any existing plan. */
export async function generatePlan(inquiryId: string, actorId: string) {
  const [wbs, inquiry] = await Promise.all([
    prisma.wbs.findUnique({ where: { inquiryId }, include: { items: { orderBy: { order: "asc" } } } }),
    prisma.inquiry.findUnique({ where: { id: inquiryId }, select: { startDate: true } }),
  ]);
  if (!wbs) throw new Error("NO_WBS");
  if (wbs.status !== "APPROVED") throw new Error("WBS_NOT_APPROVED");

  // Pack WBS story points into 2-week sprints (~SPRINT_CAPACITY_SP each), per release.
  const relOrder: string[] = [];
  const relSP = new Map<string, number>();
  for (const it of wbs.items) {
    const rel = it.release?.trim() || "Release 1";
    if (!relSP.has(rel)) {
      relSP.set(rel, 0);
      relOrder.push(rel);
    }
    relSP.set(rel, (relSP.get(rel) ?? 0) + (it.storyPoints ?? 0));
  }
  if (relOrder.length === 0) {
    relOrder.push("Release 1");
    relSP.set("Release 1", 0);
  }

  const seeds: { sprintNo: number; release: string }[] = [];
  let sprintNo = 1;
  for (const rel of relOrder) {
    const sp = relSP.get(rel) ?? 0;
    const n = Math.max(1, Math.ceil(sp / SPRINT_CAPACITY_SP));
    for (let i = 0; i < n; i++) seeds.push({ sprintNo: sprintNo++, release: rel });
  }

  const DAY = 86_400_000;
  let projectStart: Date;
  if (inquiry?.startDate) {
    // The lead's start date is stored at UTC midnight — keep sprints on that day.
    const d = inquiry.startDate;
    projectStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  } else {
    projectStart = new Date();
    projectStart.setHours(0, 0, 0, 0);
  }

  const plan = await prisma.$transaction(async (tx) => {
    const existing = await tx.projectPlan.findUnique({ where: { inquiryId }, select: { id: true } });
    if (existing) await tx.projectPlan.delete({ where: { id: existing.id } });

    return tx.projectPlan.create({
      data: {
        inquiryId,
        status: "DRAFT",
        marginPct: 0.1,
        sprints: {
          create: seeds.map((s, i) => {
            const start = new Date(projectStart.getTime() + i * SPRINT_WEEKS * 7 * DAY);
            const end = new Date(start.getTime() + (SPRINT_WEEKS * 7 - 1) * DAY);
            return {
              sprintNo: s.sprintNo,
              releaseGroup: s.release,
              order: i,
              startDate: start,
              endDate: end,
              allocations: { create: DEFAULT_ALLOCATIONS },
            };
          }),
        },
      },
      include: { sprints: { include: { allocations: true }, orderBy: { order: "asc" } } },
    });
  });

  await logActivity({ inquiryId, actorId, action: "plan_generated", meta: { sprints: seeds.length } });
  await tryTransition(inquiryId, "ESTIMATES", actorId);
  // Auto-write a features-based summary for each release.
  try {
    await generateReleaseSummaries(inquiryId, actorId);
  } catch (e) {
    console.error("[plan] release summaries failed", e);
  }
  return plan;
}

/** Write an AI (or features-based) summary into each release group's first sprint. */
export async function generateReleaseSummaries(inquiryId: string, actorId: string) {
  const [wbs, plan] = await Promise.all([
    prisma.wbs.findUnique({ where: { inquiryId }, include: { items: { orderBy: { order: "asc" } } } }),
    getPlan(inquiryId),
  ]);
  if (!plan || plan.sprints.length === 0) return;

  const byRelease = new Map<string, string[]>();
  for (const it of wbs?.items ?? []) {
    const rel = it.release?.trim() || "Release 1";
    const feat = [it.epic, it.feature].filter(Boolean).join(" — ") || it.feature || it.epic || "";
    if (feat) {
      const arr = byRelease.get(rel) ?? [];
      arr.push(feat);
      byRelease.set(rel, arr);
    }
  }
  for (const sp of plan.sprints) {
    const rg = sp.releaseGroup?.trim();
    if (rg && !byRelease.has(rg)) byRelease.set(rg, []);
  }
  const releases = [...byRelease.entries()].map(([release, features]) => ({ release, features }));
  if (releases.length === 0) return;

  let summaries: { release: string; summary: string }[];
  try {
    summaries = (await getProvider().generateReleaseSummaries(releases)).summaries;
  } catch {
    summaries = releases.map((r) => ({
      release: r.release,
      summary: r.features.length ? `Delivers: ${r.features.slice(0, 8).join("; ")}.` : "",
    }));
  }
  const map = new Map(summaries.map((s) => [s.release.trim(), s.summary]));

  const seen = new Set<string>();
  for (const sp of plan.sprints) {
    const rg = (sp.releaseGroup ?? "").trim();
    if (seen.has(rg)) continue;
    seen.add(rg);
    const sum = map.get(rg) ?? "";
    if (sum) await prisma.sprintPlan.update({ where: { id: sp.id }, data: { summary: sum } });
  }
  await logActivity({ inquiryId, actorId, action: "release_summaries_generated" });
}

/** Generate the executive project overview (markdown) from the brief + WBS + plan + costs. */
export async function generateProjectOverview(inquiryId: string, actorId: string) {
  const [inquiry, wbs, plan, rates] = await Promise.all([
    prisma.inquiry.findUnique({
      where: { id: inquiryId },
      select: { title: true, client: { select: { name: true } }, summary: { select: { document: true } } },
    }),
    prisma.wbs.findUnique({ where: { inquiryId }, include: { items: { orderBy: { order: "asc" } } } }),
    getPlan(inquiryId),
    listActiveRates(),
  ]);
  if (!inquiry) throw new Error("NOT_FOUND");
  if (!plan) throw new Error("NO_PLAN");

  const derived = derivePlan(plan.sprints, buildRateMap(rates), plan.marginPct);
  const items = wbs?.items ?? [];

  const byRelease = new Map<string, string[]>();
  for (const it of items) {
    const rel = it.release?.trim() || "Release 1";
    const feat = [it.epic, it.feature].filter(Boolean).join(" — ");
    const arr = byRelease.get(rel) ?? [];
    if (feat) arr.push(feat);
    byRelease.set(rel, arr);
  }

  const ctx = {
    title: inquiry.title,
    client: inquiry.client?.name ?? null,
    brief: inquiry.summary?.document ?? null,
    epics: [...new Set(items.map((i) => i.epic).filter(Boolean) as string[])],
    features: items.map((i) => i.feature).filter(Boolean) as string[],
    totalStoryPoints: items.reduce((a, b) => a + (b.storyPoints ?? 0), 0),
    totalHours: derived.totalHours,
    totalCost: derived.totalCost,
    budget: wbs?.extractedBudget ?? null,
    timeline: wbs?.extractedTimeline ?? null,
    team: derived.team,
    sprintCount: plan.sprints.length,
    releases: [...byRelease.entries()].map(([release, features]) => ({ release, features })),
  };

  const res = await getProvider().generateProjectOverview(ctx);
  await prisma.projectPlan.update({ where: { inquiryId }, data: { overview: res.document } });
  await logActivity({ inquiryId, actorId, action: "overview_generated", meta: { provider: res.provider, model: res.model } });
  return res;
}

export async function setPlanMargin(inquiryId: string, marginPct: number) {
  return prisma.projectPlan.update({ where: { inquiryId }, data: { marginPct } });
}

export async function updateSprint(
  sprintId: string,
  data: {
    releaseGroup?: string | null;
    sprintNo?: number;
    summary?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
  },
) {
  return prisma.sprintPlan.update({ where: { id: sprintId }, data });
}

export async function updateSummaryData(inquiryId: string, data: unknown) {
  return prisma.projectPlan.update({
    where: { inquiryId },
    data: { summaryData: data as import("@prisma/client").Prisma.InputJsonValue },
  });
}

/** Upsert the FTE for one role on one sprint; 0/empty removes the allocation. */
export async function setAllocation(sprintId: string, role: string, fteFraction: number | null) {
  const existing = await prisma.sprintAllocation.findFirst({ where: { sprintId, role } });
  if (fteFraction === null || fteFraction === 0) {
    if (existing) await prisma.sprintAllocation.delete({ where: { id: existing.id } });
    return;
  }
  if (existing) {
    await prisma.sprintAllocation.update({ where: { id: existing.id }, data: { fteFraction } });
  } else {
    await prisma.sprintAllocation.create({ data: { sprintId, role, fteFraction } });
  }
}

export async function addSprint(planId: string) {
  const agg = await prisma.sprintPlan.aggregate({
    where: { planId },
    _max: { order: true, sprintNo: true },
  });
  return prisma.sprintPlan.create({
    data: {
      planId,
      sprintNo: (agg._max.sprintNo ?? 0) + 1,
      order: (agg._max.order ?? -1) + 1,
      releaseGroup: "Release 1",
    },
  });
}

export async function deleteSprint(sprintId: string) {
  return prisma.sprintPlan.delete({ where: { id: sprintId } });
}

export async function submitPlan(inquiryId: string, actorId: string) {
  const plan = await prisma.projectPlan.update({ where: { inquiryId }, data: { status: "IN_REVIEW" } });
  await logActivity({ inquiryId, actorId, action: "plan_submitted" });
  await tryTransition(inquiryId, "REVIEW", actorId);
  return plan;
}

export async function approvePlan(inquiryId: string, actorId: string) {
  const plan = await prisma.projectPlan.update({
    where: { inquiryId },
    data: { status: "APPROVED", approvedById: actorId, approvedAt: new Date() },
  });
  await logActivity({ inquiryId, actorId, action: "plan_approved" });
  // Walk ESTIMATES → REVIEW → HANDOFF so the lead's status keeps up even when the
  // plan was approved in one click (no manual submit-to-review step).
  await advanceInquiryTo(inquiryId, "HANDOFF", actorId);
  return plan;
}

export async function rejectPlan(inquiryId: string, actorId: string, note?: string) {
  const plan = await prisma.projectPlan.update({ where: { inquiryId }, data: { status: "REJECTED" } });
  await logActivity({ inquiryId, actorId, action: "plan_rejected", meta: { note: note ?? null } });
  await tryTransition(inquiryId, "ESTIMATES", actorId);
  return plan;
}
