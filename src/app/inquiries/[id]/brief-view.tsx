"use client";

import { useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const PRINT_CSS = `
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.55; color: #1a1a2e; max-width: 820px; margin: 2rem auto; padding: 0 1.25rem; }
  h1 { font-size: 20pt; margin: 0 0 .4em; }
  h2 { font-size: 15pt; margin: 1.1em 0 .35em; border-bottom: 1px solid #d9d9e3; padding-bottom: 4px; }
  h3 { font-size: 12.5pt; margin: .9em 0 .3em; }
  ul, ol { padding-left: 1.4em; }
  li { margin: .2em 0; }
  code { background: #f3f3f7; padding: 1px 4px; border-radius: 3px; font-size: .9em; }
  table { border-collapse: collapse; margin: .6em 0; }
  th, td { border: 1px solid #d9d9e3; padding: 4px 8px; text-align: left; }
  th { background: #f3f3f7; }
`;

export function BriefView({ markdown, fileBase }: { markdown: string; fileBase: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const save = (blob: Blob, ext: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileBase}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const wrapHtml = (body: string) =>
    `<!doctype html><html><head><meta charset="utf-8"><title>${fileBase}</title><style>${PRINT_CSS}</style></head><body>${body}</body></html>`;

  const downloadDoc = () => {
    // The rendered HTML wrapped as a Word-openable document (keeps the formatting).
    const html = wrapHtml(ref.current?.innerHTML ?? "");
    save(new Blob(["﻿", html], { type: "application/msword" }), "doc");
  };

  const downloadMd = () => save(new Blob([markdown], { type: "text/markdown" }), "md");

  const printPdf = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(wrapHtml(ref.current?.innerHTML ?? ""));
    w.document.close();
    w.focus();
    // Give the new window a tick to lay out before invoking the print dialog.
    setTimeout(() => w.print(), 350);
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">Download:</span>
        <button type="button" onClick={downloadDoc} className="btn-secondary !py-1 text-xs">Word (.doc)</button>
        <button type="button" onClick={printPdf} className="btn-secondary !py-1 text-xs">PDF (print)</button>
        <button type="button" onClick={downloadMd} className="btn-secondary !py-1 text-xs">Markdown</button>
      </div>
      <div ref={ref} className="prose-brief rounded-lg border border-border bg-background p-5">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </div>
    </div>
  );
}
