"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { createRate, updateRate, deleteRate, type RateInput } from "@/modules/rates/service";
import { createTemplateFromWorkbook, deleteTemplate } from "@/modules/templates/service";

function num(v: FormDataEntryValue | null, fallback = 0): number {
  const n = Number((v as string)?.trim());
  return Number.isFinite(n) ? n : fallback;
}

function readRate(fd: FormData): RateInput {
  const effective = (fd.get("effectiveMonthly") as string)?.trim();
  return {
    role: ((fd.get("role") as string) ?? "").trim() || "Unnamed role",
    monthlyHours: num(fd.get("monthlyHours"), 160),
    ratePerHour: num(fd.get("ratePerHour")),
    effectiveMonthly: effective ? Number(effective) : null,
    active: fd.get("active") === "on",
  };
}

export async function createRateAction(formData: FormData) {
  await requireRole("ADMIN");
  await createRate(readRate(formData));
  revalidatePath("/rates");
}

export async function updateRateAction(formData: FormData) {
  await requireRole("ADMIN");
  await updateRate(formData.get("id") as string, readRate(formData));
  revalidatePath("/rates");
}

export async function deleteRateAction(formData: FormData) {
  await requireRole("ADMIN");
  await deleteRate(formData.get("id") as string);
  revalidatePath("/rates");
}

export async function uploadTemplateAction(formData: FormData) {
  await requireRole("ADMIN");
  const file = formData.get("file") as File | null;
  if (file && file.size > 0) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name || "template.xlsx";
    await createTemplateFromWorkbook(name, buffer);
  }
  revalidatePath("/rates");
}

export async function deleteTemplateAction(formData: FormData) {
  await requireRole("ADMIN");
  await deleteTemplate(formData.get("id") as string);
  revalidatePath("/rates");
}
