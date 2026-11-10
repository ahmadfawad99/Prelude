"use client";

import { useRef, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { addSourceAction, deleteSourceAction, generateAnalysisAction, refreshFromSourcesAction } from "../actions";

export interface SourceItem {
  id: string;
  kind: "FILE" | "URL" | "TEXT";
  name: string;
  url: string | null;
  chars: number;
}

const KIND_ICON: Record<SourceItem["kind"], string> = {
  FILE: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6",
  URL: "M10 13a5 5 0 007.07 0l3-3a5 5 0 00-7.07-7.07l-1.5 1.5M14 11a5 5 0 00-7.07 0l-3 3a5 5 0 007.07 7.07l1.5-1.5",
  TEXT: "M4 6h16M4 12h16M4 18h10",
};

type AddTab = "files" | "url" | "text";

export function SourcesPanel({
  inquiryId,
  sources,
  hasBrief,
  stale,
}: {
  inquiryId: string;
  sources: SourceItem[];
  hasBrief: boolean;
  stale?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<AddTab>("files");
  const [fileNames, setFileNames] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-base font-bold tracking-tight">Sources</p>
        <button onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-foreground transition hover:bg-muted">
          {adding ? "Close" : "+ Add"}
        </button>
      </div>

      {stale && (
        <div className="mb-2 rounded-xl border border-primary/40 bg-primary/10 p-2.5">
          <p className="flex items-center gap-1.5 text-xs font-bold text-primary">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 11-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
            Sources changed
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Refresh the analysis brief and diagram to include your new source.</p>
          <form action={refreshFromSourcesAction} className="mt-2">
            <input type="hidden" name="inquiryId" value={inquiryId} />
            <SubmitButton className="btn-primary w-full !py-1.5 text-xs" pendingText="Refreshing…">Refresh from sources</SubmitButton>
          </form>
        </div>
      )}

      {sources.length === 0 && !adding && (
        <p className="px-3 py-4 text-xs text-muted-foreground">
          No sources yet. Add files, a website link, or pasted text — the AI analyzes them together.
        </p>
      )}

      {sources.length > 0 && (
        <ul className="divide-y divide-border">
          {sources.map((s) => (
            <li key={s.id} className="group flex items-center gap-2.5 px-3 py-2.5 text-sm transition hover:bg-primary/5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={KIND_ICON[s.kind]} />
                </svg>
              </span>
              {s.url ? (
                <a href={s.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-primary hover:underline">{s.name}</a>
              ) : (
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
              )}
              <span className="shrink-0 text-[10px] text-muted-foreground">{(s.chars / 1000).toFixed(1)}k</span>
              <form action={deleteSourceAction}>
                <input type="hidden" name="inquiryId" value={inquiryId} />
                <input type="hidden" name="sourceId" value={s.id} />
                <button className="shrink-0 text-muted-foreground hover:text-red-500" title="Remove">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="border-t border-border p-3">
          <div className="mb-2 flex gap-1 rounded-lg bg-muted/60 p-1">
            {(["files", "url", "text"] as AddTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium capitalize transition ${
                  tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "url" ? "Link" : t}
              </button>
            ))}
          </div>

          {tab === "files" && (
            <form action={addSourceAction} onSubmit={() => setAdding(false)} className="space-y-2">
              <input type="hidden" name="inquiryId" value={inquiryId} />
              <input type="hidden" name="kind" value="FILE" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-lg border border-dashed border-border bg-background px-3 py-4 text-xs text-muted-foreground hover:border-primary/40"
              >
                {fileNames.length ? `${fileNames.length} file(s)` : "Choose PDF / DOCX / TXT"}
              </button>
              <input
                ref={fileRef}
                name="files"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.md"
                className="hidden"
                onChange={(e) => setFileNames(Array.from(e.target.files ?? []).map((f) => f.name))}
              />
              <SubmitButton className="btn-secondary w-full !py-1.5 text-xs" pendingText="Reading…">Add files</SubmitButton>
            </form>
          )}

          {tab === "url" && (
            <form action={addSourceAction} onSubmit={() => setAdding(false)} className="space-y-2">
              <input type="hidden" name="inquiryId" value={inquiryId} />
              <input type="hidden" name="kind" value="URL" />
              <input name="url" required placeholder="https://…" className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs" />
              <SubmitButton className="btn-secondary w-full !py-1.5 text-xs" pendingText="Fetching…">Add link</SubmitButton>
            </form>
          )}

          {tab === "text" && (
            <form action={addSourceAction} onSubmit={() => setAdding(false)} className="space-y-2">
              <input type="hidden" name="inquiryId" value={inquiryId} />
              <input type="hidden" name="kind" value="TEXT" />
              <input name="name" placeholder="Label (optional)" className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs" />
              <textarea name="text" required rows={4} placeholder="Paste transcript / RFP / notes…" className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs" />
              <SubmitButton className="btn-secondary w-full !py-1.5 text-xs" pendingText="Saving…">Add text</SubmitButton>
            </form>
          )}
        </div>
      )}

      {sources.length > 0 && (
        <div className="border-t border-border p-3">
          <form action={generateAnalysisAction}>
            <input type="hidden" name="inquiryId" value={inquiryId} />
            <SubmitButton className="btn-primary w-full !py-2 text-xs" pendingText="Analyzing sources…">
              {hasBrief ? "Re-analyze sources" : "Analyze sources → brief"}
            </SubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}
