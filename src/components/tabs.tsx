"use client";

import { useState, type ReactNode } from "react";

export function Tabs({
  labels,
  children,
  initial = 0,
  size = "md",
}: {
  labels: string[];
  children: ReactNode[];
  initial?: number;
  size?: "md" | "sm";
}) {
  const [i, setI] = useState(Math.min(initial, labels.length - 1));
  const arr = Array.isArray(children) ? children : [children];
  const pad = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  return (
    <div>
      <div className="scrollbar-thin flex gap-1 overflow-x-auto border-b border-border">
        {labels.map((l, idx) => (
          <button
            key={`${l}-${idx}`}
            onClick={() => setI(idx)}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 font-medium transition ${pad} ${
              i === idx ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className={size === "sm" ? "pt-3" : "pt-4"}>{arr[i]}</div>
    </div>
  );
}
