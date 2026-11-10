import mammoth from "mammoth";

/**
 * Extract plain text from an uploaded document (txt / pdf / docx / etc.) so it
 * can be fed to the AI (call transcript, RFP, requirement doc).
 */
export async function extractText(buf: Buffer, filename: string, mime: string): Promise<string> {
  const lower = (filename || "").toLowerCase();

  // PDF — use unpdf's serverless pdf.js build (no DOMMatrix/canvas needed, so it
  // runs in Vercel's Node runtime where pdf-parse/pdfjs throws "DOMMatrix is not defined").
  if (lower.endsWith(".pdf") || mime === "application/pdf") {
    const { extractText: pdfExtractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await pdfExtractText(pdf, { mergePages: true });
    return text ?? "";
  }

  // Word (.docx)
  if (lower.endsWith(".docx") || mime.includes("wordprocessingml")) {
    const res = await mammoth.extractRawText({ buffer: buf });
    return res.value;
  }

  // txt / csv / md / .doc fallback (best effort)
  return buf.toString("utf8");
}
