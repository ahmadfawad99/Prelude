"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createPortal } from "react-dom";
import { SubmitButton } from "@/components/submit-button";
import { createLeadWithSourcesAction } from "@/app/inquiries/actions";

type Tab = "files" | "url" | "text";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "files", label: "Upload files", icon: "M12 3v12m0-12l-4 4m4-4l4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" },
  { id: "url", label: "Website link", icon: "M10 13a5 5 0 007.07 0l3-3a5 5 0 00-7.07-7.07l-1.5 1.5M14 11a5 5 0 00-7.07 0l-3 3a5 5 0 007.07 7.07l1.5-1.5" },
  { id: "text", label: "Paste text", icon: "M4 6h16M4 12h16M4 18h10" },
];

export function NewLeadButton({ className = "btn-primary" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        New lead
      </button>
      {/* Portal to <body> so the fixed overlay anchors to the viewport, not the
          backdrop-blurred top bar (a backdrop-filter ancestor would otherwise
          become the containing block and push the modal off-screen). */}
      {open && typeof document !== "undefined" && createPortal(<NewLeadModal onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

/** Full-screen branded loading screen shown while the lead is being created. */
function CreatingOverlay() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="grad-fill animate-splashpop flex h-16 w-16 items-center justify-center rounded-2xl text-3xl font-bold shadow-xl shadow-primary/30">
        P
      </div>
      <h2 className="mt-4 text-lg font-bold tracking-tight">Creating your lead…</h2>
      <p className="mt-1 text-sm text-muted-foreground">Reading and analysing your sources</p>
      <div className="mt-6 flex gap-2">
        <span className="dotpulse h-2 w-2 rounded-full bg-primary" style={{ animationDelay: "0ms" }} />
        <span className="dotpulse h-2 w-2 rounded-full bg-primary" style={{ animationDelay: "160ms" }} />
        <span className="dotpulse h-2 w-2 rounded-full bg-primary" style={{ animationDelay: "320ms" }} />
      </div>
    </div>
  );
}

function NewLeadModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("files");
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Keep the real <input> FileList in sync with our editable list so files can be
  // removed individually (a FileList isn't mutable — rebuild it via DataTransfer).
  const syncFiles = (next: File[]) => {
    const dt = new DataTransfer();
    next.forEach((f) => dt.items.add(f));
    if (fileRef.current) fileRef.current.files = dt.files;
    setFiles(next);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <form action={createLeadWithSourcesAction}>
          <CreatingOverlay />
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-base font-semibold">New lead</h2>
              <p className="text-xs text-muted-foreground">Add sources — the AI analyzes them together.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4 px-5 py-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Lead title</label>
              <input
                name="title"
                required
                placeholder="e.g. Ecology Prime — platform rebuild"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Client</label>
              <input
                name="clientName"
                placeholder="Company name (optional)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            {/* Source tabs */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Sources</label>
              <div className="flex gap-1 rounded-lg bg-muted/60 p-1">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                      tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={t.icon} />
                    </svg>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="mt-2.5">
                {/* Files — kept mounted so the selection survives tab switches */}
                <div className={tab === "files" ? "" : "hidden"}>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-background px-4 py-6 text-sm text-muted-foreground transition hover:border-primary/40 hover:bg-muted/40"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3v12m0-12l-4 4m4-4l4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                    </svg>
                    {files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected — add more` : "Click to upload PDF, DOCX, TXT"}
                  </button>
                  <input
                    ref={fileRef}
                    name="files"
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt,.md"
                    className="hidden"
                    onChange={(e) => {
                      // Merge newly picked files with the existing selection.
                      const picked = Array.from(e.target.files ?? []);
                      const byKey = new Map(files.map((f) => [`${f.name}:${f.size}`, f]));
                      for (const f of picked) byKey.set(`${f.name}:${f.size}`, f);
                      syncFiles([...byKey.values()]);
                    }}
                  />
                  {files.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {files.map((f, i) => (
                        <li key={`${f.name}:${f.size}`} className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6" />
                          </svg>
                          <span className="min-w-0 flex-1 truncate">{f.name}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                          <button
                            type="button"
                            onClick={() => syncFiles(files.filter((_, idx) => idx !== i))}
                            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-red-500"
                            title="Remove file"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className={tab === "url" ? "" : "hidden"}>
                  <input
                    name="url"
                    placeholder="https://example.com/rfp"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">We fetch the page and extract its text.</p>
                </div>

                <div className={tab === "text" ? "" : "hidden"}>
                  <textarea
                    name="text"
                    rows={5}
                    placeholder="Paste a call transcript, RFP, email thread, or notes…"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
              Cancel
            </button>
            <SubmitButton pendingText="Creating & reading sources…">Create lead</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
