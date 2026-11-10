import type { Diagram, DiagramVersion } from "@prisma/client";
import { MermaidView } from "./diagram-view";
import { SubmitButton } from "@/components/submit-button";
import { formatDateTime } from "@/lib/format";
import { generateDiagramAction, restoreDiagramVersionAction } from "../actions";

export function DiagramArtifact({ inquiryId, diagram, versions = [] }: { inquiryId: string; diagram: Diagram | null; versions?: DiagramVersion[] }) {
  if (!diagram) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="grad-fill mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold shadow-lg shadow-primary/20">◆</div>
        <h3 className="text-lg font-bold tracking-tight">No diagram yet</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Generate a flow diagram of the proposed solution from your sources — or ask the chat below to draw anything.
        </p>
        <form action={generateDiagramAction} className="mt-5">
          <input type="hidden" name="inquiryId" value={inquiryId} />
          <SubmitButton pendingText="Drawing… (~10s)">Generate flow diagram</SubmitButton>
        </form>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          v{diagram.version}{diagram.provider ? ` · ${diagram.provider}` : ""}
        </span>
        <div className="flex items-center gap-2">
          {versions.length > 0 && (
            <details className="group relative">
              <summary className="btn-secondary cursor-pointer list-none !py-1 text-xs">History ({versions.length})</summary>
              <div className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-border bg-card p-1.5 shadow-xl">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Previous versions</p>
                {versions.map((v) => (
                  <form key={v.id} action={restoreDiagramVersionAction} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-muted">
                    <input type="hidden" name="inquiryId" value={inquiryId} />
                    <input type="hidden" name="versionId" value={v.id} />
                    <span className="min-w-0 text-xs">
                      <span className="font-semibold">v{v.version}</span>
                      <span className="ml-1.5 text-[10px] text-muted-foreground">{formatDateTime(v.createdAt)}</span>
                    </span>
                    <SubmitButton className="rounded-md border border-border px-2 py-0.5 text-[11px] hover:bg-background" pendingText="…">Restore</SubmitButton>
                  </form>
                ))}
              </div>
            </details>
          )}
          <form action={generateDiagramAction}>
            <input type="hidden" name="inquiryId" value={inquiryId} />
            <SubmitButton className="btn-secondary !py-1 text-xs" pendingText="Redrawing…">Regenerate</SubmitButton>
          </form>
        </div>
      </div>
      <div className="flex min-h-[460px] items-center justify-center rounded-2xl border border-border/50 bg-slate-100/95 p-6 shadow-inner dark:bg-slate-200/95">
        <MermaidView code={diagram.code} />
      </div>
    </div>
  );
}
