import { prisma } from "../src/lib/db";
import { buildRateMap, deriveSprint, derivePlan, type SprintWithAllocations } from "../src/modules/plans/derive";

async function main() {
  const rates = await prisma.resourceRate.findMany({ where: { active: true } });
  const rateMap = buildRateMap(rates);

  const alloc = (role: string, fteFraction: number) => ({
    id: "x",
    sprintId: "s",
    role,
    fteFraction,
  });

  const sprint: SprintWithAllocations = {
    id: "s1",
    planId: "p",
    releaseGroup: "Release 1",
    sprintNo: 1,
    startDate: null,
    endDate: null,
    summary: null,
    order: 0,
    allocations: [
      alloc("PM", 0.25),
      alloc("SSE - Full stack", 1.0),
      alloc("QA Engineer", 0.5),
      alloc("Devops", 0.25),
    ],
  };

  const d = deriveSprint(sprint, rateMap);
  console.log("Sprint derived:", d);
  console.log("Expected: hours=320, cost=6840, blended=21.375");

  const plan = derivePlan([sprint, { ...sprint, id: "s2", sprintNo: 2 }], rateMap, 0.1);
  console.log("\nPlan totals:", { totalCost: plan.totalCost, totalHours: plan.totalHours, monthlyBurn: plan.monthlyBurn });
  console.log("Budget by release:", plan.budgetByRelease);
  console.log("Team:", plan.team);

  const ok = d.hours === 320 && d.cost === 6840 && Math.abs((d.blendedRate ?? 0) - 21.375) < 0.001;
  console.log("\nDERIVE CHECK:", ok ? "PASS ✓" : "FAIL ✗");
  process.exit(ok ? 0 : 1);
}

main().finally(() => prisma.$disconnect());
