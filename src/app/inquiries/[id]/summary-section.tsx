import type { AiSummary } from "@prisma/client";
import { formatDateTime } from "@/lib/format";
import { SubmitButton } from "@/components/submit-button";
import { BriefView } from "./brief-view";
import { generateSummaryAction, updateSummaryAction } from "../actions";

export function SummarySection({ inquiryId, summary, fileBase = "analysis-brief" }: { inquiryId: string; summary: AiSummary | null; fileBase?: string }) {
  if (!summary || !summary.document) {
    return (
      <div>
        <p className="mb-2 text-sm text-muted-foreground">
          Paste the call transcript/notes <strong>or upload a file</strong> (txt, PDF, Word) — the AI produces a full structured brief.
        </p>
        <form action={generateSummaryAction} className="space-y-3">
          <input type="hidden" name="inquiryId" value={inquiryId} />
          <textarea
            name="transcript"
            rows={6}
            placeholder="Paste call transcript / notes here…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>or upload:</span>
            <input type="file" name="file" accept=".txt,.pdf,.docx,.doc,.md,.csv" className="text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs" />
          </label>
          <SubmitButton pendingText="Generating brief… (~10s)">Generate brief</SubmitButton>
          <p className="text-xs text-muted-foreground">Takes about 10 seconds.</p>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="rounded bg-muted px-2 py-0.5">{summary.provider} · {summary.model}</span>
        <span>v{summary.version}</span>
        {summary.editedByHuman && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-700">edited</span>}
        <span>{formatDateTime(summary.createdAt)}</span>
      </div>

      <BriefView markdown={summary.document} fileBase={fileBase} />

      <div className="mt-3 flex gap-5 text-sm">
        <details className="flex-1">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Edit brief</summary>
          <form action={updateSummaryAction} className="mt-2 space-y-2">
            <input type="hidden" name="inquiryId" value={inquiryId} />
            <textarea
              name="document"
              rows={16}
              defaultValue={summary.document}
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none"
            />
            <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:brightness-110">
              Save edits
            </button>
          </form>
        </details>

        <details className="flex-1">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Regenerate</summary>
          <form action={generateSummaryAction} className="mt-2 space-y-2">
            <input type="hidden" name="inquiryId" value={inquiryId} />
            <textarea
              name="transcript"
              rows={6}
              defaultValue={summary.transcript ?? ""}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>or upload:</span>
              <input type="file" name="file" accept=".txt,.pdf,.docx,.doc,.md,.csv" className="text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs" />
            </label>
            <SubmitButton className="btn-secondary" pendingText="Regenerating… (~10s)">Regenerate (new version)</SubmitButton>
          </form>
        </details>
      </div>
    </div>
  );
}
