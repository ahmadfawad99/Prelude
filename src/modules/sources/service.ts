import { prisma } from "@/lib/db";
import { extractText } from "@/modules/ai/extract-text";
import { logActivity } from "@/modules/activity/service";

export function listSources(inquiryId: string) {
  return prisma.source.findMany({ where: { inquiryId }, orderBy: { createdAt: "asc" } });
}

/** Concatenate all of a lead's sources into one text blob for the AI. */
export async function combinedSourceText(inquiryId: string): Promise<string> {
  const sources = await prisma.source.findMany({ where: { inquiryId }, orderBy: { createdAt: "asc" } });
  return sources
    .map((s) => `### Source: ${s.name}${s.url ? ` (${s.url})` : ""}\n\n${s.content}`)
    .join("\n\n---\n\n");
}

export async function addFileSource(
  inquiryId: string,
  addedById: string,
  filename: string,
  mime: string,
  buf: Buffer,
) {
  // Never let a text-extraction failure drop the source — attach it either way.
  let content = "";
  try {
    content = (await extractText(buf, filename, mime)).trim();
  } catch (e) {
    console.error("[source] text extraction failed", filename, e);
    content = `[Could not extract text from "${filename}". The file was attached but its contents aren't searchable.]`;
  }
  const src = await prisma.source.create({
    data: { inquiryId, addedById, kind: "FILE", name: filename, content },
  });
  await logActivity({ inquiryId, actorId: addedById, action: "source_added", meta: { kind: "FILE", name: filename } });
  return src;
}

export async function addTextSource(inquiryId: string, addedById: string, name: string, text: string) {
  const src = await prisma.source.create({
    data: { inquiryId, addedById, kind: "TEXT", name: name?.trim() || "Pasted text", content: text },
  });
  await logActivity({ inquiryId, actorId: addedById, action: "source_added", meta: { kind: "TEXT" } });
  return src;
}

export async function addUrlSource(inquiryId: string, addedById: string, url: string) {
  const content = await fetchUrlText(url);
  const src = await prisma.source.create({
    data: { inquiryId, addedById, kind: "URL", name: url, url, content },
  });
  await logActivity({ inquiryId, actorId: addedById, action: "source_added", meta: { kind: "URL", url } });
  return src;
}

export async function deleteSource(id: string) {
  return prisma.source.delete({ where: { id } });
}

/** Fetch a web page and reduce it to plain text. */
export async function fetchUrlText(rawUrl: string): Promise<string> {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (PreludeBot)" },
    redirect: "follow",
  });
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 60000);
}
