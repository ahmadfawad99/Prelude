"use server";

import { revalidatePath } from "next/cache";
import type { InquiryStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { transitionInquiry } from "@/modules/inquiries/service";

/** Move a card to a new status from the board. Returns ok/error for optimistic UI. */
export async function moveInquiryAction(
  id: string,
  to: InquiryStatus,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthenticated" };
  try {
    await transitionInquiry(id, to, user.id);
    revalidatePath("/board");
    revalidatePath(`/inquiries/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed" };
  }
}
