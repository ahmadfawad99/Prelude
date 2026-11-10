import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Resource rate card seeded from the real template (Resource Rates sheet).
const RATES = [
  { role: "PM", monthlyHours: 160, ratePerHour: 35, effectiveMonthly: 5040 },
  { role: "PSE - Tech lead", monthlyHours: 160, ratePerHour: 35, effectiveMonthly: 5040 },
  { role: "SSE - Full stack", monthlyHours: 160, ratePerHour: 25, effectiveMonthly: 3600 },
  { role: "SE - Full stack", monthlyHours: 160, ratePerHour: 20, effectiveMonthly: 2880 },
  { role: "QA Engineer", monthlyHours: 160, ratePerHour: 15, effectiveMonthly: 2160 },
  { role: "AI Engineer", monthlyHours: 160, ratePerHour: 30, effectiveMonthly: 4320 },
  { role: "Devops", monthlyHours: 160, ratePerHour: 25, effectiveMonthly: 3600 },
];

async function main() {
  for (const r of RATES) {
    // Idempotent-ish seed: skip if a rate for this role already exists.
    const existing = await prisma.resourceRate.findFirst({ where: { role: r.role, active: true } });
    if (!existing) {
      await prisma.resourceRate.create({ data: r });
    }
  }
  console.log(`Seeded ${RATES.length} resource rates.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
