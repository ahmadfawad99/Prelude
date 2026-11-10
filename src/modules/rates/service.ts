import { prisma } from "@/lib/db";

export function listRates() {
  return prisma.resourceRate.findMany({ orderBy: [{ active: "desc" }, { ratePerHour: "desc" }] });
}

export function listActiveRates() {
  return prisma.resourceRate.findMany({ where: { active: true }, orderBy: { ratePerHour: "desc" } });
}

export interface RateInput {
  role: string;
  monthlyHours: number;
  ratePerHour: number;
  effectiveMonthly?: number | null;
  active?: boolean;
}

export function createRate(input: RateInput) {
  return prisma.resourceRate.create({
    data: {
      role: input.role,
      monthlyHours: input.monthlyHours,
      ratePerHour: input.ratePerHour,
      effectiveMonthly: input.effectiveMonthly ?? input.monthlyHours * input.ratePerHour,
      active: input.active ?? true,
    },
  });
}

export function updateRate(id: string, input: RateInput) {
  return prisma.resourceRate.update({
    where: { id },
    data: {
      role: input.role,
      monthlyHours: input.monthlyHours,
      ratePerHour: input.ratePerHour,
      effectiveMonthly: input.effectiveMonthly ?? input.monthlyHours * input.ratePerHour,
      active: input.active ?? true,
    },
  });
}

export function deleteRate(id: string) {
  return prisma.resourceRate.delete({ where: { id } });
}
