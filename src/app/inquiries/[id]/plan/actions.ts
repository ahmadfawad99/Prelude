"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import {
  generatePlan,
  setPlanMargin,
  updateSprint,
  setAllocation,
  addSprint,
  deleteSprint,
  submitPlan,
  approvePlan,
  rejectPlan,
  updateSummaryData,
  generateReleaseSummaries,
  generateProjectOverview,
} from "@/modules/plans/service";
import { importPlanFromWorkbook } from "@/modules/export/import-plan";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

function rev(id: string) {
  revalidatePath(`/inquiries/${id}/plan`);
  revalidatePath(`/inquiries/${id}`);
}

export async function generatePlanAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  await generatePlan(id, user.id);
  rev(id);
}

export async function generateReleaseSummariesAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  await generateReleaseSummaries(id, user.id);
  rev(id);
}

export async function generateOverviewAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  await generateProjectOverview(id, user.id);
  rev(id);
}

export async function importPlanAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  const file = formData.get("file") as File | null;
  if (file && file.size > 0) {
    const buffer = Buffer.from(await file.arrayBuffer());
    await importPlanFromWorkbook(id, buffer, user.id);
  }
  rev(id);
}

export async function updateSprintAction(formData: FormData) {
  await requireUser();
  const id = formData.get("inquiryId") as string;
  const sprintId = formData.get("sprintId") as string;

  const sprintNoRaw = (formData.get("sprintNo") as string)?.trim();
  const sprintNo = sprintNoRaw ? Number(sprintNoRaw) : undefined;
  const start = (formData.get("startDate") as string)?.trim();
  const end = (formData.get("endDate") as string)?.trim();
  await updateSprint(sprintId, {
    releaseGroup: ((formData.get("releaseGroup") as string) ?? "").trim() || null,
    sprintNo: Number.isFinite(sprintNo) ? sprintNo : undefined,
    summary: ((formData.get("summary") as string) ?? "").trim() || null,
    startDate: start ? new Date(start) : null,
    endDate: end ? new Date(end) : null,
  });

  // Allocations arrive as fte:<role> fields.
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("fte:")) continue;
    const role = key.slice(4);
    const s = (value as string).trim();
    const n = s ? Number(s) : 0;
    await setAllocation(sprintId, role, Number.isFinite(n) ? n : 0);
  }

  revalidatePath(`/inquiries/${id}/plan`);
}

export async function addSprintAction(formData: FormData) {
  await requireUser();
  const id = formData.get("inquiryId") as string;
  const planId = formData.get("planId") as string;
  await addSprint(planId);
  revalidatePath(`/inquiries/${id}/plan`);
}

export async function deleteSprintAction(formData: FormData) {
  await requireUser();
  const id = formData.get("inquiryId") as string;
  await deleteSprint(formData.get("sprintId") as string);
  revalidatePath(`/inquiries/${id}/plan`);
}

export async function updateSummaryDataAction(formData: FormData) {
  await requireUser();
  const id = formData.get("inquiryId") as string;
  const collect = (prefix: string, keys: string[]) => {
    const rows: Record<string, string>[] = [];
    for (let i = 0; i < 100; i++) {
      if (formData.get(`${prefix}_${keys[0]}_${i}`) == null) break;
      const row: Record<string, string> = {};
      for (const k of keys) row[k] = ((formData.get(`${prefix}_${k}_${i}`) as string) ?? "").trim();
      rows.push(row);
    }
    return rows.filter((r) => Object.values(r).some(Boolean));
  };
  const data = {
    team: collect("team", ["role", "responsibilities", "avgAllocation"]),
    budget: collect("budget", ["platform", "budgetRange", "timeDuration"]),
    deliverables: collect("deliv", ["platform", "budgetRange"]),
    overallBudget: ((formData.get("overallBudget") as string) ?? "").trim(),
    overallDuration: ((formData.get("overallDuration") as string) ?? "").trim(),
    monthlyBurn: ((formData.get("monthlyBurn") as string) ?? "").trim(),
  };
  await updateSummaryData(id, data);
  rev(id);
}

export async function setMarginAction(formData: FormData) {
  await requireUser();
  const id = formData.get("inquiryId") as string;
  const pct = Number((formData.get("marginPct") as string)?.trim());
  await setPlanMargin(id, Number.isFinite(pct) ? pct / 100 : 0.1);
  revalidatePath(`/inquiries/${id}/plan`);
}

export async function submitPlanAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  await submitPlan(id, user.id);
  rev(id);
}

export async function approvePlanAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  await approvePlan(id, user.id);
  rev(id);
}

export async function rejectPlanAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  await rejectPlan(id, user.id, (formData.get("note") as string) || undefined);
  rev(id);
}
