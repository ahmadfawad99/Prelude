import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getProvider } from "@/modules/ai";
import { logActivity } from "@/modules/activity/service";
import { transitionInquiry } from "@/modules/inquiries/service";
import { InvalidTransitionError } from "@/modules/inquiries/state-machine";

/** Generate (or regenerate) the AI call-summary brief for an inquiry. Versioned. */
export async function generateSummary(inquiryId: string, transcript: string, actorId: string) {
  const text = transcript.trim();
  if (!text) throw new Error("EMPTY_TRANSCRIPT");

  const provider = getProvider();
  const result = await provider.generateSummary(text);

  const existing = await prisma.aiSummary.findUnique({ where: { inquiryId }, select: { version: true } });
  const version = existing ? existing.version + 1 : 1;

  const data = {
    transcript: text,
    document: result.document,
    executive: null,
    highlights: [],
    painPoints: [],
    clientWants: [],
    actionItems: [] as unknown as Prisma.InputJsonValue,
    provider: result.provider,
    model: result.model,
    promptVer: result.promptVer,
    tokensCost: (result.tokensCost ?? undefined) as Prisma.InputJsonValue | undefined,
    version,
    editedByHuman: false,
  };

  const summary = await prisma.aiSummary.upsert({
    where: { inquiryId },
    create: { inquiryId, ...data },
    update: data,
  });

  await logActivity({
    inquiryId,
    actorId,
    action: "summary_generated",
    meta: { provider: result.provider, model: result.model, version },
  });

  // Auto-advance Request → Understanding.
  try {
    await transitionInquiry(inquiryId, "UNDERSTANDING", actorId);
  } catch (e) {
    if (!(e instanceof InvalidTransitionError)) throw e;
  }

  return summary;
}

/** Save a human edit to the summary document. */
export async function updateSummary(inquiryId: string, document: string, actorId: string) {
  const summary = await prisma.aiSummary.update({
    where: { inquiryId },
    data: { document, editedByHuman: true },
  });
  await logActivity({ inquiryId, actorId, action: "summary_edited" });
  return summary;
}
