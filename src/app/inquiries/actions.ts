"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { InquiryStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { createInquiry, assignInquiry, transitionInquiry, updateInquiryDetails } from "@/modules/inquiries/service";
import { INQUIRY_TYPES, PRIORITIES } from "@/modules/inquiries/schema";
import { addComment } from "@/modules/comments/service";
import { createClient, findOrCreateClientByName } from "@/modules/clients/service";
import { addFileSource, addUrlSource, addTextSource, deleteSource, combinedSourceText } from "@/modules/sources/service";
import { sendChat, postAssistantMessage } from "@/modules/chat/service";
import { briefChatMarkdown, diagramChatSummary } from "@/modules/chat/artifact-markdown";
import { uploadAttachment, softDeleteAttachment } from "@/modules/attachments/service";
import { generateSummary, updateSummary } from "@/modules/summaries/service";
import { generateDiagram, getDiagram, restoreDiagramVersion } from "@/modules/diagrams/service";
import { extractText } from "@/modules/ai/extract-text";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function createInquiryAction(formData: FormData) {
  const user = await requireUser();

  const type = INQUIRY_TYPES.filter((t) => formData.get(`type_${t}`) === "on");
  const tagsRaw = (formData.get("tags") as string) ?? "";
  const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
  const priority = (formData.get("priority") as (typeof PRIORITIES)[number]) || "MEDIUM";

  const clientName = (formData.get("clientName") as string) ?? "";
  const client = clientName.trim() ? await findOrCreateClientByName(clientName) : null;

  const inquiry = await createInquiry(
    {
      title: (formData.get("title") as string) ?? "",
      clientId: client?.id ?? "",
      assigneeId: (formData.get("assigneeId") as string) || "",
      type,
      priority,
      source: (formData.get("source") as string) || "",
      dueDate: (formData.get("dueDate") as string) || "",
      tags,
    },
    user.id,
  );

  redirect(`/inquiries/${inquiry.id}`);
}

export async function createLeadWithSourcesAction(formData: FormData) {
  const user = await requireUser();
  const clientName = (formData.get("clientName") as string) ?? "";
  const client = clientName.trim() ? await findOrCreateClientByName(clientName) : null;

  const lead = await createInquiry(
    {
      title: ((formData.get("title") as string) ?? "").trim() || "Untitled lead",
      clientId: client?.id ?? "",
      assigneeId: "",
      type: [],
      priority: "MEDIUM",
      source: "",
      dueDate: "",
      tags: [],
    },
    user.id,
    { fullFlow: true },
  );

  // Add sources (any combination of files / website / pasted text).
  const files = formData.getAll("files") as File[];
  for (const f of files) {
    if (f && f.size > 0) {
      const buf = Buffer.from(await f.arrayBuffer());
      try {
        await addFileSource(lead.id, user.id, f.name, f.type || "application/octet-stream", buf);
      } catch (e) {
        console.error("[lead] file source failed", f.name, e);
      }
    }
  }
  const url = (formData.get("url") as string)?.trim();
  if (url) {
    try {
      await addUrlSource(lead.id, user.id, url);
    } catch (e) {
      console.error("[lead] url source failed", url, e);
    }
  }
  const text = (formData.get("text") as string)?.trim();
  if (text) await addTextSource(lead.id, user.id, "Pasted text", text);

  redirect(`/inquiries/${lead.id}`);
}

export async function addSourceAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  const kind = formData.get("kind") as string;
  if (kind === "URL") {
    const url = (formData.get("url") as string)?.trim();
    if (url) await addUrlSource(id, user.id, url);
  } else if (kind === "TEXT") {
    const text = (formData.get("text") as string)?.trim();
    const name = (formData.get("name") as string)?.trim() || "Pasted text";
    if (text) await addTextSource(id, user.id, name, text);
  } else {
    const files = formData.getAll("files") as File[];
    for (const f of files) {
      if (f && f.size > 0) {
        const buf = Buffer.from(await f.arrayBuffer());
        await addFileSource(id, user.id, f.name, f.type || "application/octet-stream", buf);
      }
    }
  }
  revalidatePath(`/inquiries/${id}`);
}

export async function deleteSourceAction(formData: FormData) {
  await requireUser();
  const id = formData.get("inquiryId") as string;
  const sourceId = formData.get("sourceId") as string;
  await deleteSource(sourceId);
  revalidatePath(`/inquiries/${id}`);
}

/** Analyze all sources together into the AI brief. */
export async function generateAnalysisAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  const text = await combinedSourceText(id);
  if (text.trim()) {
    const s = await generateSummary(id, text, user.id);
    await postAssistantMessage(id, briefChatMarkdown(s.document ?? ""), "regenerate_analysis");
  }
  revalidatePath(`/inquiries/${id}`);
}

/** Re-run the analysis (and the diagram, if one exists) from the current sources. */
export async function refreshFromSourcesAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  const text = await combinedSourceText(id);
  if (text.trim()) {
    const s = await generateSummary(id, text, user.id);
    await postAssistantMessage(id, `_Refreshed from updated sources._\n\n${briefChatMarkdown(s.document ?? "")}`, "regenerate_analysis");
  }
  if (await getDiagram(id)) {
    const d = await generateDiagram(id, null, user.id);
    await postAssistantMessage(id, diagramChatSummary(d.version), "generate_diagram");
  }
  revalidatePath(`/inquiries/${id}`);
}

export async function generateDiagramAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  const instruction = ((formData.get("instruction") as string) ?? "").trim() || null;
  const d = await generateDiagram(id, instruction, user.id);
  await postAssistantMessage(id, diagramChatSummary(d.version), "generate_diagram");
  revalidatePath(`/inquiries/${id}`);
}

export async function restoreDiagramVersionAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  const versionId = formData.get("versionId") as string;
  await restoreDiagramVersion(id, versionId, user.id);
  revalidatePath(`/inquiries/${id}`);
}

export async function sendChatAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  const message = (formData.get("message") as string) ?? "";
  if (message.trim()) await sendChat(id, user.id, message);
  revalidatePath(`/inquiries/${id}`);
}

export async function assignInquiryAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  const assigneeId = (formData.get("assigneeId") as string) || null;
  await assignInquiry(id, assigneeId, user.id);
  revalidatePath(`/inquiries/${id}`);
}

export async function assignToMeAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  await assignInquiry(id, user.id, user.id);
  revalidatePath(`/inquiries/${id}`);
}

export async function updateDetailsAction(formData: FormData) {
  await requireUser();
  const id = formData.get("inquiryId") as string;
  const priority = formData.get("priority") as "LOW" | "MEDIUM" | "HIGH";
  const tagsRaw = (formData.get("tags") as string) ?? "";
  const start = (formData.get("startDate") as string)?.trim();
  const due = (formData.get("dueDate") as string)?.trim();
  await updateInquiryDetails(id, {
    priority: PRIORITIES.includes(priority) ? priority : undefined,
    tags: tagsRaw.split(",").map((t) => t.trim()).filter(Boolean),
    startDate: start ? new Date(start) : null,
    dueDate: due ? new Date(due) : null,
    wbsEnabled: formData.get("wbsEnabled") === "on",
    planEnabled: formData.get("planEnabled") === "on",
  });
  revalidatePath(`/inquiries/${id}`);
}

export async function transitionInquiryAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  const to = formData.get("to") as InquiryStatus;
  const note = (formData.get("note") as string) || undefined;
  await transitionInquiry(id, to, user.id, note);
  revalidatePath(`/inquiries/${id}`);
}

export async function addCommentAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  const body = (formData.get("body") as string) ?? "";
  if (body.trim()) await addComment(id, user.id, body);
  revalidatePath(`/inquiries/${id}`);
}

export async function createClientAction(formData: FormData) {
  await requireUser();
  await createClient({
    name: (formData.get("name") as string) ?? "",
    domain: (formData.get("domain") as string) || "",
    notes: (formData.get("notes") as string) || "",
  });
  revalidatePath("/clients");
}

export async function uploadAttachmentAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  const file = formData.get("file") as File | null;
  if (file && file.size > 0) {
    const data = Buffer.from(await file.arrayBuffer());
    await uploadAttachment({
      inquiryId: id,
      uploadedById: user.id,
      filename: file.name,
      mime: file.type || "application/octet-stream",
      data,
    });
  }
  revalidatePath(`/inquiries/${id}`);
}

export async function deleteAttachmentAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  const attachmentId = formData.get("attachmentId") as string;
  await softDeleteAttachment(attachmentId, user.id);
  revalidatePath(`/inquiries/${id}`);
}

export async function generateSummaryAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  let transcript = (formData.get("transcript") as string) ?? "";
  const file = formData.get("file") as File | null;
  if (file && file.size > 0) {
    const buf = Buffer.from(await file.arrayBuffer());
    const text = await extractText(buf, file.name, file.type);
    transcript = (transcript.trim() ? transcript + "\n\n" : "") + text;
  }
  if (transcript.trim()) {
    await generateSummary(id, transcript, user.id);
  }
  revalidatePath(`/inquiries/${id}`);
}

export async function updateSummaryAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("inquiryId") as string;
  const document = (formData.get("document") as string) ?? "";
  await updateSummary(id, document, user.id);
  revalidatePath(`/inquiries/${id}`);
}
