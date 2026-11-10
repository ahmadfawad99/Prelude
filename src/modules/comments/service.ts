import { prisma } from "@/lib/db";
import { logActivity } from "@/modules/activity/service";

export function listComments(inquiryId: string) {
  return prisma.comment.findMany({
    where: { inquiryId },
    orderBy: { createdAt: "desc" },
  });
}

export async function addComment(inquiryId: string, authorId: string, body: string) {
  const text = body.trim();
  if (!text) throw new Error("EMPTY_COMMENT");
  const comment = await prisma.comment.create({
    data: { inquiryId, authorId, body: text },
  });
  await logActivity({ inquiryId, actorId: authorId, action: "commented" });
  return comment;
}
