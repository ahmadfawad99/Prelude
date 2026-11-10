import type { ResourceRate, SprintPlan, SprintAllocation } from "@prisma/client";

/**
 * The derive engine (docs/03 §4). Costs, hours, blended rate and the whole
 * Summary are COMPUTED from three stored inputs only: sprint allocations
 * (fractional FTE), the rate card, and the margin %. Nothing cost-related is
 * stored, so numbers never go stale.
 */

export interface RateInfo {
  monthlyHours: number;
  effectiveMonthly: number;
  ratePerHour: number;
}
export type RateMap = Record<string, RateInfo>;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function buildRateMap(rates: ResourceRate[]): RateMap {
  const map: RateMap = {};
  for (const r of rates) {
    const info: RateInfo = {
      monthlyHours: r.monthlyHours,
      effectiveMonthly: r.effectiveMonthly ?? r.monthlyHours * r.ratePerHour,
      ratePerHour: r.ratePerHour,
    };
    map[r.role] = info; // exact
    const n = norm(r.role);
    map[n] = info; // normalized
    // Alias "SSE - Full stack" so it also answers "SE (Fullstack)".
    if (n.startsWith("sse")) map["se" + n.slice(3)] = info;
  }
  return map;
}

/** Look up a rate for an allocation role, tolerant of label differences. */
export function rateFor(map: RateMap, role: string): RateInfo | undefined {
  return map[role] ?? map[norm(role)];
}

export type SprintWithAllocations = SprintPlan & { allocations: SprintAllocation[] };

export interface DerivedSprint {
  id: string;
  sprintNo: number;
  releaseGroup: string | null;
  hours: number;
  cost: number;
  blendedRate: number | null; // null guards divide-by-zero (the template's #DIV/0!)
}

export function deriveSprint(sprint: SprintWithAllocations, rates: RateMap): DerivedSprint {
  let hours = 0;
  let cost = 0;
  for (const a of sprint.allocations) {
    const r = rateFor(rates, a.role);
    if (!r) continue;
    hours += a.fteFraction * r.monthlyHours;
    cost += a.fteFraction * r.effectiveMonthly;
  }
  return {
    id: sprint.id,
    sprintNo: sprint.sprintNo,
    releaseGroup: sprint.releaseGroup,
    hours,
    cost,
    blendedRate: hours > 0 ? cost / hours : null,
  };
}

export interface BudgetRange {
  releaseGroup: string;
  cost: number;
  low: number;
  high: number;
}

export interface TeamRow {
  role: string;
  avgFte: number;
}

export interface DerivedPlan {
  sprints: DerivedSprint[];
  totalCost: number;
  totalHours: number;
  budgetByRelease: BudgetRange[];
  team: TeamRow[];
  monthlyBurn: number;
  marginPct: number;
}

export function derivePlan(
  sprints: SprintWithAllocations[],
  rates: RateMap,
  marginPct: number,
): DerivedPlan {
  const derived = sprints.map((s) => deriveSprint(s, rates));
  const totalCost = derived.reduce((a, b) => a + b.cost, 0);
  const totalHours = derived.reduce((a, b) => a + b.hours, 0);

  // Budget grouped by release group, with a ± margin band.
  const byRelease = new Map<string, number>();
  for (const d of derived) {
    const key = d.releaseGroup ?? "Unassigned";
    byRelease.set(key, (byRelease.get(key) ?? 0) + d.cost);
  }
  const budgetByRelease: BudgetRange[] = [...byRelease.entries()].map(([releaseGroup, cost]) => ({
    releaseGroup,
    cost,
    low: cost * (1 - marginPct),
    high: cost * (1 + marginPct),
  }));

  // Team summary: average FTE per role across sprints.
  const roleTotals = new Map<string, number>();
  for (const s of sprints) {
    for (const a of s.allocations) {
      roleTotals.set(a.role, (roleTotals.get(a.role) ?? 0) + a.fteFraction);
    }
  }
  const n = sprints.length || 1;
  const team: TeamRow[] = [...roleTotals.entries()]
    .map(([role, sum]) => ({ role, avgFte: sum / n }))
    .sort((a, b) => b.avgFte - a.avgFte);

  // Monthly burn ≈ average cost per sprint (treating a sprint as ~a month).
  const monthlyBurn = derived.length ? totalCost / derived.length : 0;

  return { sprints: derived, totalCost, totalHours, budgetByRelease, team, monthlyBurn, marginPct };
}
