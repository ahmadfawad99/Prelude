import mammoth from "mammoth";

/**
 * Extract plain text from an uploaded document (txt / pdf / docx / etc.) so it
 * can be fed to the AI (call transcript, RFP, requirement doc).
 */
export async function extractText(buf: Buffer, filename: string, mime: string): Promise<string> {
  const lower = (filename || "").toLowerCase();

  // PDF
  if (lower.endsWith(".pdf") || mime === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    // pdf-parse v2 exposes a PDFParse class.
    const parser = new (PDFParse as unknown as new (o: { data: Uint8Array }) => {
      getText(): Promise<{ text?: string }>;
      destroy?: () => Promise<void>;
    })({ data: new Uint8Array(buf) });
    const res = await parser.getText();
    try {
      await parser.destroy?.();
    } catch {
      /* ignore */
    }
    return typeof res?.text === "string" ? res.text : "";
  }

  // Word (.docx)
  if (lower.endsWith(".docx") || mime.includes("wordprocessingml")) {
    const res = await mammoth.extractRawText({ buffer: buf });
    return res.value;
  }

  // txt / csv / md / .doc fallback (best effort)
  return buf.toString("utf8");
}
