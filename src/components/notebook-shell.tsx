"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";
import { sendChatAction } from "@/app/inquiries/actions";

export type ArtifactId = "analysis" | "estimates" | "plan" | "diagram";

const ArtifactCtx = createContext<{ open: ArtifactId | null; setOpen: (a: ArtifactId | null) => void }>({
  open: null,
  setOpen: () => {},
});

/** Open/close the artifact popup from anywhere in the workspace (e.g. Studio cards). */
export function useArtifact() {
  return useContext(ArtifactCtx);
}

// ---- Background generation progress ----

type GenJob = { id: string; label: string; pct: number };
const GenCtx = createContext<{ jobs: GenJob[]; start: (label: string) => void }>({ jobs: [], start: () => {} });

/** Register a background generation job (shows a % progress card in the Studio). */
export function useGeneration() {
  return useContext(GenCtx);
}

/** The progress cards — rendered in the Studio pane; survives the popup closing. */
export function BackgroundJobs() {
  const { jobs } = useGeneration();
  if (jobs.length === 0) return null;
  return (
    <div className="mb-3 space-y-2">
      {jobs.map((j) => (
        <div key={j.id} className="nb-card p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex min-w-0 items-center gap-2 font-semibold">
              <span className="dotpulse h-2 w-2 shrink-0 rounded-full bg-primary" />
              <span className="truncate">{j.label}</span>
            </span>
            <span className="shrink-0 text-muted-foreground">{Math.round(j.pct)}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="grad-fill h-full rounded-full transition-[width] duration-300" style={{ width: `${j.pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const ARTIFACT_TITLE: Record<ArtifactId, string> = {
  analysis: "Analysis brief",
  estimates: "Work Breakdown & Estimates",
  plan: "Release Plan",
  diagram: "Flow diagram",
};

export function NotebookShell({
  inquiryId,
  rev,
  header,
  left,
  chat,
  analysis,
  estimates,
  plan,
  diagram,
  studio,
}: {
  inquiryId: string;
  rev: number;
  header: ReactNode;
  left: ReactNode;
  chat: ReactNode;
  analysis: ReactNode;
  estimates: ReactNode;
  plan: ReactNode;
  diagram: ReactNode;
  studio: ReactNode;
}) {
  const [open, setOpen] = useState<ArtifactId | null>(null);
  const [jobs, setJobs] = useState<GenJob[]>([]);

  const start = (label: string) => setJobs((j) => (j.length ? j : [{ id: `g${Date.now()}`, label, pct: 6 }]));

  // Climb the progress bar toward ~90% while a job is active.
  useEffect(() => {
    if (jobs.length === 0) return;
    const t = setInterval(() => {
      setJobs((js) => js.map((j) => ({ ...j, pct: j.pct < 90 ? j.pct + Math.max(1.5, (90 - j.pct) * 0.09) : j.pct })));
    }, 400);
    return () => clearInterval(t);
  }, [jobs.length]);

  // Complete the job when the artifact data changes (revalidation bumps `rev`).
  const prevRev = useRef(rev);
  useEffect(() => {
    if (rev === prevRev.current) return;
    prevRev.current = rev;
    setJobs((js) => js.map((j) => ({ ...j, pct: 100 })));
    const t = setTimeout(() => setJobs([]), 700);
    return () => clearTimeout(t);
  }, [rev]);

  // Close the artifact popup on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <ArtifactCtx.Provider value={{ open, setOpen }}>
     <GenCtx.Provider value={{ jobs, start }}>
      <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-background">
        <div className="shrink-0 px-4 pt-3 pb-1">{header}</div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 pt-2 lg:grid-cols-[300px_minmax(0,1fr)_360px]">
          {/* Left — Sources */}
          <aside className="nb-pane hidden min-h-0 flex-col overflow-hidden lg:flex">
            <div className="min-h-0 flex-1 overflow-y-auto p-3">{left}</div>
          </aside>

          {/* Center — Chat only (NotebookLM style, no tabs) */}
          <section className="nb-pane flex min-h-0 flex-col overflow-hidden">
            <div className="h-full px-5 py-4">{chat}</div>
          </section>

          {/* Right — Studio (artifacts) */}
          <aside className="nb-pane hidden min-h-0 flex-col overflow-hidden lg:flex">
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <BackgroundJobs />
              {studio}
            </div>
          </aside>
        </div>

        {/* Mobile: Sources + Studio stacked under the center column */}
        <div className="flex flex-col gap-3 p-3 lg:hidden">
          <div className="nb-pane p-3">{left}</div>
          <div className="nb-pane p-3">
            <BackgroundJobs />
            {studio}
          </div>
        </div>
      </div>

      {/* Artifact popup — large, with the chat composer beneath */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-5" onClick={() => setOpen(null)}>
            <div className="nb-pane flex w-full max-w-[1400px] flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="grad-fill flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold">◆</span>
                  <h2 className="text-sm font-bold tracking-tight">{ARTIFACT_TITLE[open]}</h2>
                </div>
                <button onClick={() => setOpen(null)} className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Close">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>

              <ArtifactModalBody key={open} inquiryId={inquiryId} label={ARTIFACT_TITLE[open]}>
                {open === "analysis" ? analysis : open === "diagram" ? diagram : open === "plan" ? plan : estimates}
              </ArtifactModalBody>
            </div>
          </div>,
          document.body,
        )}
     </GenCtx.Provider>
    </ArtifactCtx.Provider>
  );
}

/**
 * Artifact body (its own forms work normally) + a SEPARATE chat composer form
 * beneath. The composer's "generating" loader is portaled over the body so no
 * forms are nested.
 */
function ArtifactModalBody({ inquiryId, label, children }: { inquiryId: string; label: string; children: ReactNode }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { start } = useGeneration();
  return (
    <>
      <div ref={bodyRef} className="relative min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {children}
      </div>

      <div className="shrink-0 border-t border-border p-3">
        <form
          ref={formRef}
          action={sendChatAction}
          onSubmit={() => {
            start(`Updating ${label}…`);
            requestAnimationFrame(() => {
              if (inputRef.current) {
                inputRef.current.value = "";
                inputRef.current.style.height = "auto";
              }
            });
          }}
        >
          <input type="hidden" name="inquiryId" value={inquiryId} />
          <GeneratingOverlay target={bodyRef} />
          <div className="ring-focus mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm transition">
            <textarea
              ref={inputRef}
              name="message"
              rows={1}
              required
              placeholder="Ask to change this — e.g. “make the features more granular”, “add a risks section”…"
              className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm focus:outline-none"
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  formRef.current?.requestSubmit();
                }
              }}
            />
            <SendBtn />
          </div>
        </form>
      </div>
    </>
  );
}

/** Portals a "generating" loader over the artifact body while the prompt is pending. */
function GeneratingOverlay({ target }: { target: React.RefObject<HTMLDivElement | null> }) {
  const { pending } = useFormStatus();
  if (!pending || !target.current) return null;
  return createPortal(
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/85 backdrop-blur-sm">
      <div className="grad-fill animate-splashpop flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-bold shadow-lg shadow-primary/30">◆</div>
      <p className="mt-3 text-sm font-semibold">Generating…</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Updating this artifact from your prompt</p>
      <div className="mt-4 flex gap-1.5">
        <span className="dotpulse h-2 w-2 rounded-full bg-primary" />
        <span className="dotpulse h-2 w-2 rounded-full bg-primary" style={{ animationDelay: "160ms" }} />
        <span className="dotpulse h-2 w-2 rounded-full bg-primary" style={{ animationDelay: "320ms" }} />
      </div>
    </div>,
    target.current,
  );
}

function SendBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`btn-send flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${pending ? "cursor-wait opacity-70" : ""}`} aria-label="Send">
      {pending ? (
        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
      )}
    </button>
  );
}
