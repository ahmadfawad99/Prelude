"use server";

import { revalidatePath } from "next/cache";
import type { Complexity, Priority } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { extractText } from "@/modules/ai/extract-text";
import { combinedSourceText } from "@/modules/sources/service";
import {
  generateWbs,
  updateWbsItem,
  addWbsItem,
  deleteWbsItem,
  submitWbs,
  approveWbs,
  rejectWbs,
  type WbsItemInput,
} from "@/modules/wbs/service";
import { resyncPlanFromWbs, generatePlan, getPlan } from "@/modules/plans/service";
import { postAssistantMessage } from "@/modules/chat/service";
import { wbsChatSummary, planChatSummary } from "@/modules/chat/artifact-markdown";

/** After a WBS change, re-pack the plan's sprints so cost tracks the WBS, and
 *  refresh both the WBS and plan/detail views. */
async function afterWbsChange(id: string) {
  await resyncPlanFromWbs(id);
  revalidatePath(`/inquiries/${id}/wbs`);
  revalidatePath(`/inquiries/${id}/plan`);
  revalidatePath(`/inquiries/${id}`);
}

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

function num(v: FormDataEntryValue | null): number | null {
  const s = (v as string)?.trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function str(v: FormDataEntryValue | null): string | null {
  const s = (v as string)?.trim();
  return s ? s : null;
}

function priority(v: FormDataEntryValue | null): Priority | null {
  const s = (v as string)?.trim();
  return s === "LOW" || s === "MEDIUM" || s === "HIGH" ? s : null;
}

function complexity(v: FormDataEntryValue | null): Complexity | null {
  const s = (v as string)?.trim();
  return s === "LOW" || s === "LOW_MEDIUM" || s === "MEDIUM" ? s : null;
}

function date(v: FormDataEntryValue | null): Date | null {
  const s = (v as string)?.trim();
  return s ? new Date(s) : null;
}

function readItem(fd: FormData): WbsItemInput {
  return {
    module: str(fd.get("module")),
    epic: (fd.get("epic") as string)?.trim() || "Untitled",
    feature: (fd.get("feature") as string)?.trim() || "Untitled",
    description: str(fd.get("description")),
    sprint: str(fd.get("sprint")),
    complexity: complexity(fd.get("complexity")),
    storyPoints: num(fd.get("storyPoints")),
    hours: num(fd.get("hours")),
    startDate: date(fd.get("startDate")),
    endDate: date(fd.get("endDate")),
    priority: priority(fd.get("priority")),
    release: str(fd.get("release")),
  };
}

export async function generateWbsAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  let requirements = (formData.get("requirements") as string) ?? "";
  const file = formData.get("file") as File | null;
  if (file && file.size > 0) {
    const buf = Buffer.from(await file.arrayBuffer());
    const text = await extractText(buf, file.name, file.type);
    requirements = (requirements.trim() ? requirements + "\n\n" : "") + text;
  }
  if (requirements.trim()) await generateWbs(id, requirements, user.id);
  revalidatePath(`/inquiries/${id}/wbs`);
  revalidatePath(`/inquiries/${id}`);
}

/** One-click WBS from the Studio: uses the AI brief, falling back to the raw sources. */
export async function generateWbsFromBriefAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  const summary = await prisma.aiSummary.findUnique({ where: { inquiryId: id }, select: { document: true } });
  let requirements = summary?.document?.trim() ?? "";
  if (!requirements) requirements = (await combinedSourceText(id)).trim();
  if (requirements) {
    const wbs = await generateWbs(id, requirements, user.id);
    await postAssistantMessage(id, wbsChatSummary(wbs), "generate_wbs");
  }
  revalidatePath(`/inquiries/${id}/wbs`);
  revalidatePath(`/inquiries/${id}`);
}

export async function updateWbsItemAction(formData: FormData) {
  await requireUser();
  const id = formData.get("inquiryId") as string;
  const itemId = formData.get("itemId") as string;
  await updateWbsItem(itemId, readItem(formData));
  await afterWbsChange(id);
}

export async function addWbsItemAction(formData: FormData) {
  await requireUser();
  const id = formData.get("inquiryId") as string;
  const wbsId = formData.get("wbsId") as string;
  await addWbsItem(wbsId, readItem(formData));
  await afterWbsChange(id);
}

export async function deleteWbsItemAction(formData: FormData) {
  await requireUser();
  const id = formData.get("inquiryId") as string;
  const itemId = formData.get("itemId") as string;
  await deleteWbsItem(itemId);
  await afterWbsChange(id);
}

export async function submitWbsAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  await submitWbs(id, user.id);
  revalidatePath(`/inquiries/${id}/wbs`);
  revalidatePath(`/inquiries/${id}`);
}

export async function approveWbsAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  await approveWbs(id, user.id);
  // Auto-build the release plan on approval (when enabled and not already made).
  try {
    const inq = await prisma.inquiry.findUnique({ where: { id }, select: { planEnabled: true } });
    const existing = await getPlan(id);
    if (inq?.planEnabled && (!existing || existing.sprints.length === 0)) {
      await generatePlan(id, user.id);
      await postAssistantMessage(id, await planChatSummary(id), "generate_plan");
    }
  } catch (e) {
    console.error("[wbs] auto-plan on approve failed", e);
  }
  revalidatePath(`/inquiries/${id}/wbs`);
  revalidatePath(`/inquiries/${id}/plan`);
  revalidatePath(`/inquiries/${id}`);
}

export async function rejectWbsAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  const note = (formData.get("note") as string) || undefined;
  await rejectWbs(id, user.id, note);
  revalidatePath(`/inquiries/${id}/wbs`);
  revalidatePath(`/inquiries/${id}`);
}
