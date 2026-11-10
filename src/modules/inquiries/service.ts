import type { InquiryStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logActivity } from "@/modules/activity/service";
import { assertTransition, forwardPath } from "./state-machine";
import { getNextInquiryKey } from "./key";
import { createInquirySchema, type CreateInquiryInput } from "./schema";

const listInclude = {
  client: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true, email: true } },
  reporter: { select: { id: true, name: true, email: true } },
} as const;

export interface InquiryFilters {
  status?: InquiryStatus;
  assigneeId?: string;
  clientId?: string;
  q?: string;
  /** "My Leads": inquiries this user created or is assigned to. */
  mineUserId?: string;
}

export function listInquiries(filters: InquiryFilters = {}) {
  const { status, assigneeId, clientId, q, mineUserId } = filters;
  const and: Record<string, unknown>[] = [];
  if (q) and.push({ OR: [{ title: { contains: q, mode: "insensitive" } }, { key: { contains: q, mode: "insensitive" } }] });
  if (mineUserId) and.push({ OR: [{ reporterId: mineUserId }, { assigneeId: mineUserId }] });
  return prisma.inquiry.findMany({
    where: {
      status,
      assigneeId,
      clientId,
      ...(and.length ? { AND: and } : {}),
    },
    include: listInclude,
    orderBy: { updatedAt: "desc" },
  });
}

export function getInquiry(id: string) {
  return prisma.inquiry.findUnique({
    where: { id },
    include: {
      ...listInclude,
      summary: true,
      wbs: true,
      plan: true,
      sources: { orderBy: { createdAt: "asc" } },
      attachments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      pocLinks: true,
      comments: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function createInquiry(
  input: CreateInquiryInput,
  reporterId: string,
  opts: { fullFlow?: boolean } = {},
) {
  const data = createInquirySchema.parse(input);
  const key = await getNextInquiryKey();

  // Full WBS/Plan flow by default for RFP / estimation work, and for
  // source-driven leads; analysis-first (toggleable) for call/POC-only inquiries.
  const fullFlow =
    opts.fullFlow ?? (data.type.includes("RFP_BASED") || data.type.includes("ESTIMATION_ONLY"));

  const inquiry = await prisma.inquiry.create({
    data: {
      key,
      title: data.title,
      type: data.type,
      priority: data.priority,
      source: data.source || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      tags: data.tags,
      clientId: data.clientId || null,
      assigneeId: data.assigneeId || null,
      reporterId,
      wbsEnabled: fullFlow,
      planEnabled: fullFlow,
    },
  });

  await logActivity({
    inquiryId: inquiry.id,
    actorId: reporterId,
    action: "created",
    meta: { key, title: inquiry.title },
  });

  return inquiry;
}

export async function updateInquiryDetails(
  id: string,
  data: {
    title?: string;
    priority?: "LOW" | "MEDIUM" | "HIGH";
    tags?: string[];
    dueDate?: Date | null;
    startDate?: Date | null;
    wbsEnabled?: boolean;
    planEnabled?: boolean;
  },
) {
  return prisma.inquiry.update({ where: { id }, data });
}

export async function assignInquiry(id: string, assigneeId: string | null, actorId: string) {
  const inquiry = await prisma.inquiry.update({ where: { id }, data: { assigneeId } });
  await logActivity({ inquiryId: id, actorId, action: "assigned", meta: { assigneeId } });
  return inquiry;
}

/**
 * Advance a lead forward along the pipeline (REQUEST→…→HANDOFF) until it reaches
 * `target`, taking one legal step at a time. Used by one-click approvals that
 * skip the manual submit step: approving the plan from ESTIMATES should still
 * carry the lead through REVIEW to HANDOFF so the status badge keeps up. Stops
 * quietly if the lead is already at/past the target, isn't on the pipeline, or a
 * step would be illegal — never moves backward and never touches terminal states.
 */
export async function advanceInquiryTo(id: string, target: InquiryStatus, actorId: string) {
  const current = await prisma.inquiry.findUnique({ where: { id }, select: { status: true } });
  if (!current) return;
  for (const next of forwardPath(current.status, target)) {
    await transitionInquiry(id, next, actorId);
  }
}

export async function transitionInquiry(id: string, to: InquiryStatus, actorId: string, note?: string) {
  const current = await prisma.inquiry.findUnique({ where: { id }, select: { status: true } });
  if (!current) throw new Error("NOT_FOUND");

  assertTransition(current.status, to);

  const inquiry = await prisma.inquiry.update({ where: { id }, data: { status: to } });
  await logActivity({
    inquiryId: id,
    actorId,
    action: "status_changed",
    meta: { from: current.status, to, note: note ?? null },
  });
  return inquiry;
}
