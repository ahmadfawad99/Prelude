import { prisma } from "@/lib/db";
import { getProvider } from "@/modules/ai";
import { logActivity } from "@/modules/activity/service";
import { combinedSourceText } from "@/modules/sources/service";

export function getDiagram(inquiryId: string) {
  return prisma.diagram.findUnique({ where: { inquiryId } });
}

/** Past versions of the diagram, newest first, for the history switcher. */
export function listDiagramVersions(inquiryId: string) {
  return prisma.diagramVersion.findMany({ where: { inquiryId }, orderBy: { version: "desc" } });
}

/** Snapshot the current diagram (if any) into the version history. */
async function snapshot(inquiryId: string) {
  const cur = await prisma.diagram.findUnique({ where: { inquiryId }, select: { version: true, code: true } });
  if (cur) await prisma.diagramVersion.create({ data: { inquiryId, version: cur.version, code: cur.code } });
}

/** Restore a previous diagram version (snapshotting the current one first). */
export async function restoreDiagramVersion(inquiryId: string, versionId: string, userId: string) {
  const [snap, cur] = await Promise.all([
    prisma.diagramVersion.findUnique({ where: { id: versionId } }),
    prisma.diagram.findUnique({ where: { inquiryId }, select: { version: true } }),
  ]);
  if (!snap || snap.inquiryId !== inquiryId || !cur) throw new Error("NOT_FOUND");
  await snapshot(inquiryId);
  const saved = await prisma.diagram.update({ where: { inquiryId }, data: { code: snap.code, version: cur.version + 1 } });
  await logActivity({ inquiryId, actorId: userId, action: "diagram_restored", meta: { fromVersion: snap.version } });
  return saved;
}

/**
 * Generate (or regenerate/edit) the lead's flow diagram as Mermaid, grounded in
 * its brief + sources. One diagram per lead; regenerating bumps the version.
 */
export async function generateDiagram(inquiryId: string, instruction: string | null, userId: string) {
  const [inquiry, sources, existing] = await Promise.all([
    prisma.inquiry.findUnique({ where: { id: inquiryId }, select: { title: true, summary: { select: { document: true } } } }),
    combinedSourceText(inquiryId),
    prisma.diagram.findUnique({ where: { inquiryId } }),
  ]);
  if (!inquiry) throw new Error("NOT_FOUND");

  const res = await getProvider().generateDiagram({
    title: inquiry.title,
    brief: inquiry.summary?.document ?? null,
    sources,
    instruction: instruction?.trim() || null,
    current: existing?.code ?? null,
  });
  if (!res.code?.trim()) throw new Error("EMPTY_DIAGRAM");

  // Keep the outgoing version in history before we overwrite it.
  if (existing) await prisma.diagramVersion.create({ data: { inquiryId, version: existing.version, code: existing.code } });

  const saved = await prisma.diagram.upsert({
    where: { inquiryId },
    create: { inquiryId, title: res.title, code: res.code, provider: res.provider, model: res.model },
    update: { code: res.code, provider: res.provider, model: res.model, version: (existing?.version ?? 1) + 1 },
  });

  await logActivity({ inquiryId, actorId: userId, action: "diagram_generated", meta: { provider: res.provider, model: res.model } });
  return saved;
}
