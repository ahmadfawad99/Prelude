"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

let initialized = false;

/** Renders Mermaid source to an SVG, themed for the dark workspace. */
export function MermaidView({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!initialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        securityLevel: "loose",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        themeVariables: {
          primaryColor: "#e0e7ff",
          primaryBorderColor: "#4f46e5",
          primaryTextColor: "#1e1b4b",
          lineColor: "#4f46e5",
          secondaryColor: "#ede9fe",
          tertiaryColor: "#f5f3ff",
          fontSize: "15px",
        },
      });
      initialized = true;
    }
    let active = true;
    const id = `mmd-${Math.random().toString(36).slice(2)}`;
    mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (active && ref.current) {
          ref.current.innerHTML = svg;
          setErr(null);
        }
      })
      .catch((e: unknown) => {
        if (active) setErr(e instanceof Error ? e.message : String(e));
      });
    return () => {
      active = false;
    };
  }, [code]);

  if (err) {
    return (
      <div className="text-sm">
        <p className="text-amber-400">The diagram couldn&apos;t be drawn — try asking to regenerate it.</p>
        <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">{code}</pre>
      </div>
    );
  }
  return <div ref={ref} className="w-full [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:w-full" />;
}
