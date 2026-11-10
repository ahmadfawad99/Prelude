import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/** Append an audit-log entry for an inquiry. Never throws into the caller's path. */
export async function logActivity(params: {
  inquiryId: string;
  actorId: string;
  action: string;
  meta?: Prisma.InputJsonValue;
}) {
  const { inquiryId, actorId, action, meta } = params;
  try {
    await prisma.activity.create({
      data: { inquiryId, actorId, action, meta: meta ?? undefined },
    });
  } catch (err) {
    console.error("[activity] failed to log", action, err);
  }
}

export function listActivity(inquiryId: string) {
  return prisma.activity.findMany({
    where: { inquiryId },
    orderBy: { createdAt: "desc" },
  });
}
