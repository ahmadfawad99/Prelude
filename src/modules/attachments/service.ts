import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { fileStore } from "@/lib/storage";
import { logActivity } from "@/modules/activity/service";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export function listAttachments(inquiryId: string) {
  return prisma.attachment.findMany({
    where: { inquiryId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export async function uploadAttachment(params: {
  inquiryId: string;
  uploadedById: string;
  filename: string;
  mime: string;
  data: Buffer;
}) {
  const { inquiryId, uploadedById, filename, mime, data } = params;

  if (data.byteLength > MAX_BYTES) throw new Error("FILE_TOO_LARGE");
  if (!ALLOWED_MIME.has(mime)) throw new Error("UNSUPPORTED_TYPE");

  const storageKey = `${inquiryId}/${randomUUID()}-${filename}`;
  await fileStore.put(storageKey, data, mime);

  const attachment = await prisma.attachment.create({
    data: {
      inquiryId,
      uploadedById,
      filename,
      mime,
      size: data.byteLength,
      storageKey,
    },
  });

  await logActivity({ inquiryId, actorId: uploadedById, action: "attachment_added", meta: { filename } });
  return attachment;
}

export async function getAttachment(id: string) {
  const att = await prisma.attachment.findFirst({ where: { id, deletedAt: null } });
  if (!att) return null;
  const data = await fileStore.get(att.storageKey);
  return { att, data };
}

export async function softDeleteAttachment(id: string, actorId: string) {
  const att = await prisma.attachment.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await logActivity({ inquiryId: att.inquiryId, actorId, action: "attachment_removed", meta: { filename: att.filename } });
  return att;
}
