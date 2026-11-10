"use client";

import { useRef, type ReactNode } from "react";
import mermaid from "mermaid";
import { useArtifact, type ArtifactId } from "@/components/notebook-shell";

export interface StudioFlags {
  inquiryId: string;
  hasBrief: boolean;
  briefVersion: number;
  briefMarkdown: string;
  hasSources: boolean;
  hasWbs: boolean;
  wbsVersion: number;
  hasPlan: boolean;
  planVersion: number;
  hasDiagram: boolean;
  diagramVersion: number;
  diagramCode: string;
  wbsOn: boolean;
  planOn: boolean;
  exportHref: string;
}

const ICONS = {
  brief: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6M8 13h8M8 17h5",
  wbs: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  plan: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
  diagram: "M5 3h5v5H5zM14 16h5v5h-5zM7.5 8v4a2 2 0 002 2h4.5M16.5 16v-2",
};

export function StudioPanel({ flags }: { flags: StudioFlags }) {
  const { setOpen } = useArtifact();
  const { inquiryId, exportHref } = flags;
  const open = (a: ArtifactId) => () => setOpen(a);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <span className="grad-fill flex h-7 w-7 items-center justify-center rounded-lg shadow-sm shadow-primary/20">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l2.09 6.26L20 10l-5 3.5L16.5 20 12 16.5 7.5 20 9 13.5 4 10l5.91-.74z" />
          </svg>
        </span>
        <h2 className="text-base font-bold tracking-tight">Artifacts</h2>
      </div>

      <div className="space-y-2">
        {/* Analysis brief */}
        <Row icon={ICONS.brief} tint="bg-blue-500/15 text-blue-300" name="Analysis brief" version={flags.hasBrief ? flags.briefVersion : undefined}>
          {flags.hasBrief ? (
            <>
              <ViewBtn onClick={open("analysis")} />
              <DownloadDoc markdown={flags.briefMarkdown} base="analysis-brief" />
            </>
          ) : flags.hasSources ? (
            <Muted>ask in chat ↓</Muted>
          ) : (
            <Muted>add sources</Muted>
          )}
        </Row>

        {/* Work Breakdown & Estimates */}
        {flags.wbsOn && (
          <Row icon={ICONS.wbs} tint="bg-violet-500/15 text-violet-300" name="Work Breakdown" version={flags.hasWbs ? flags.wbsVersion : undefined}>
            {flags.hasWbs ? (
              <>
                <ViewBtn onClick={open("estimates")} />
                <DownloadLink href={exportHref} title="Download Excel" />
              </>
            ) : flags.hasBrief ? (
              <Muted>ask in chat ↓</Muted>
            ) : (
              <Muted>needs brief</Muted>
            )}
          </Row>
        )}

        {/* Release Plan */}
        {flags.planOn && (
          <Row icon={ICONS.plan} tint="bg-emerald-500/15 text-emerald-300" name="Release plan" version={flags.hasPlan ? flags.planVersion : undefined}>
            {flags.hasPlan ? (
              <>
                <ViewBtn onClick={open("plan")} />
                <DownloadLink href={exportHref} title="Download Excel" />
              </>
            ) : (
              <>
                <ViewBtn onClick={open("plan")} />
                <Muted>after WBS</Muted>
              </>
            )}
          </Row>
        )}

        {/* Flow diagram */}
        <Row icon={ICONS.diagram} tint="bg-cyan-500/15 text-cyan-300" name="Flow diagram" version={flags.hasDiagram ? flags.diagramVersion : undefined}>
          {flags.hasDiagram ? (
            <>
              <ViewBtn onClick={open("diagram")} />
              <DownloadSvg code={flags.diagramCode} />
            </>
          ) : flags.hasSources ? (
            <Muted>ask in chat ↓</Muted>
          ) : (
            <Muted>add sources</Muted>
          )}
        </Row>

        {/* Excel export (full workbook) */}
        {(flags.hasWbs || flags.hasPlan) && (
          <a href={exportHref} className="nb-card flex items-center gap-2.5 p-2.5 transition hover:bg-muted">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/15 text-rose-300">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v13m0 0l-4-4m4 4l4-4M5 21h14" /></svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">Full Excel export</p>
              <p className="text-[10px] text-muted-foreground">WBS · Plan · Rates · Summary</p>
            </div>
            <span className="text-muted-foreground">↓</span>
          </a>
        )}
      </div>
    </div>
  );
}

function Row({ icon, tint, name, version, children }: { icon: string; tint: string; name: string; version?: number; children: ReactNode }) {
  return (
    <div className="nb-card flex items-center gap-2.5 p-2.5">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tint}`}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold leading-tight">{name}</p>
        <p className="text-[10px] text-muted-foreground">{version != null ? `Version ${version}` : "Not generated"}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">{children}</div>
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-[10px] text-muted-foreground">{children}</span>;
}

function ViewBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-md border border-border px-2 py-1 text-[11px] font-medium transition hover:bg-muted" title="View">
      View
    </button>
  );
}

function DownloadLink({ href, title }: { href: string; title: string }) {
  return (
    <a href={href} title={title} className="flex h-6 w-6 items-center justify-center rounded-md border border-border transition hover:bg-muted">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v13m0 0l-4-4m4 4l4-4M5 21h14" /></svg>
    </a>
  );
}

function saveBlob(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Download the brief as a Word-openable .doc (its markdown wrapped as HTML). */
function DownloadDoc({ markdown, base }: { markdown: string; base: string }) {
  const download = () => {
    const html = markdown
      .split("\n")
      .map((l) => {
        if (l.startsWith("### ")) return `<h3>${l.slice(4)}</h3>`;
        if (l.startsWith("## ")) return `<h2>${l.slice(3)}</h2>`;
        if (l.startsWith("# ")) return `<h1>${l.slice(2)}</h1>`;
        if (l.startsWith("- ")) return `<li>${l.slice(2)}</li>`;
        return l.trim() ? `<p>${l}</p>` : "";
      })
      .join("")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    const doc = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5">${html}</body></html>`;
    saveBlob("﻿" + doc, `${base}.doc`, "application/msword");
  };
  return (
    <button onClick={download} title="Download Word" className="flex h-6 w-6 items-center justify-center rounded-md border border-border transition hover:bg-muted">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v13m0 0l-4-4m4 4l4-4M5 21h14" /></svg>
    </button>
  );
}

/** Download the diagram as a rendered SVG. */
function DownloadSvg({ code }: { code: string }) {
  const busy = useRef(false);
  const download = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "loose" });
      const { svg } = await mermaid.render(`dl-${Math.random().toString(36).slice(2)}`, code);
      saveBlob(svg, "flow-diagram.svg", "image/svg+xml");
    } catch {
      saveBlob(code, "flow-diagram.mmd", "text/plain"); // fall back to the Mermaid source
    } finally {
      busy.current = false;
    }
  };
  return (
    <button onClick={download} title="Download SVG" className="flex h-6 w-6 items-center justify-center rounded-md border border-border transition hover:bg-muted">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v13m0 0l-4-4m4 4l4-4M5 21h14" /></svg>
    </button>
  );
}
