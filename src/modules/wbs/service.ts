import type { Complexity, InquiryStatus, Priority } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getProvider } from "@/modules/ai";
import { logActivity } from "@/modules/activity/service";
import { transitionInquiry } from "@/modules/inquiries/service";
import { InvalidTransitionError } from "@/modules/inquiries/state-machine";
import { spFor, engineersFor } from "./complexity";

/** Transition the inquiry if the move is legal; ignore if not. */
async function tryTransition(inquiryId: string, to: InquiryStatus, actorId: string) {
  try {
    await transitionInquiry(inquiryId, to, actorId);
  } catch (e) {
    if (!(e instanceof InvalidTransitionError)) throw e;
  }
}

export function getWbs(inquiryId: string) {
  return prisma.wbs.findUnique({
    where: { inquiryId },
    include: { items: { orderBy: { order: "asc" } } },
  });
}

/** Generate (or regenerate) a WBS from requirement text. Replaces existing items. */
export async function generateWbs(inquiryId: string, requirements: string, actorId: string) {
  const text = requirements.trim();
  if (!text) throw new Error("EMPTY_REQUIREMENTS");

  const provider = getProvider();
  const result = await provider.generateWbs(text);

  const existing = await prisma.wbs.findUnique({ where: { inquiryId }, select: { id: true, version: true } });

  const itemsData = result.output.items.map((it, i) => {
    const complexity = (it.complexity ?? null) as Complexity | null;
    // Complexity is the source of truth for story points + engineers; fall back
    // to any AI-provided storyPoints only when complexity is absent.
    const storyPoints = complexity ? spFor(complexity) : (it.storyPoints ?? null);
    return {
      module: it.module ?? null,
      epic: it.epic,
      feature: it.feature,
      description: it.description ?? null,
      sprint: it.sprint ?? null,
      complexity,
      engineers: engineersFor(complexity),
      storyPoints,
      hours: it.hours ?? null,
      priority: (it.priority ?? null) as Priority | null,
      release: it.release ?? null,
      order: i,
    };
  });

  const extractedBudget = result.output.budget?.trim() || null;
  const extractedTimeline = result.output.timeline?.trim() || null;

  const wbs = await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.wbsItem.deleteMany({ where: { wbsId: existing.id } });
      return tx.wbs.update({
        where: { id: existing.id },
        data: {
          status: "DRAFT",
          version: existing.version + 1,
          approvedById: null,
          approvedAt: null,
          extractedBudget,
          extractedTimeline,
          items: { create: itemsData },
        },
        include: { items: true },
      });
    }
    return tx.wbs.create({
      data: { inquiryId, status: "DRAFT", extractedBudget, extractedTimeline, items: { create: itemsData } },
      include: { items: true },
    });
  });

  await logActivity({
    inquiryId,
    actorId,
    action: "wbs_generated",
    meta: { provider: result.provider, model: result.model, items: itemsData.length },
  });

  await tryTransition(inquiryId, "ESTIMATES", actorId);
  return wbs;
}

export interface WbsItemInput {
  module?: string | null;
  epic: string;
  feature: string;
  description?: string | null;
  sprint?: string | null;
  complexity?: Complexity | null;
  engineers?: number | null;
  storyPoints?: number | null;
  hours?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  priority?: Priority | null;
  release?: string | null;
}

export async function updateWbsItem(itemId: string, input: WbsItemInput) {
  const data: WbsItemInput = { ...input };
  // Story points are directly editable. Only fall back to the complexity's default
  // (3/5/13) when no explicit value was entered, so a typed value is never clobbered.
  if (input.storyPoints == null && input.complexity) data.storyPoints = spFor(input.complexity);
  if (input.complexity) data.engineers = engineersFor(input.complexity);
  return prisma.wbsItem.update({ where: { id: itemId }, data });
}

export async function addWbsItem(wbsId: string, input: WbsItemInput) {
  const max = await prisma.wbsItem.aggregate({ where: { wbsId }, _max: { order: true } });
  const data: WbsItemInput = { ...input };
  if (input.storyPoints == null && input.complexity) data.storyPoints = spFor(input.complexity);
  if (input.complexity) data.engineers = engineersFor(input.complexity);
  return prisma.wbsItem.create({
    data: { wbsId, ...data, order: (max._max.order ?? -1) + 1 },
  });
}

export async function deleteWbsItem(itemId: string) {
  return prisma.wbsItem.delete({ where: { id: itemId } });
}

export async function submitWbs(inquiryId: string, actorId: string) {
  const wbs = await prisma.wbs.update({ where: { inquiryId }, data: { status: "IN_REVIEW" } });
  await logActivity({ inquiryId, actorId, action: "wbs_submitted" });
  await tryTransition(inquiryId, "ESTIMATES", actorId);
  return wbs;
}

export async function approveWbs(inquiryId: string, actorId: string) {
  const wbs = await prisma.wbs.update({
    where: { inquiryId },
    data: { status: "APPROVED", approvedById: actorId, approvedAt: new Date() },
  });
  await logActivity({ inquiryId, actorId, action: "wbs_approved" });
  // Opens the Project Plan gate; keeps the ticket in Estimates.
  await tryTransition(inquiryId, "ESTIMATES", actorId);
  return wbs;
}

export async function rejectWbs(inquiryId: string, actorId: string, note?: string) {
  const wbs = await prisma.wbs.update({ where: { inquiryId }, data: { status: "REJECTED" } });
  await logActivity({ inquiryId, actorId, action: "wbs_rejected", meta: { note: note ?? null } });
  return wbs;
}
