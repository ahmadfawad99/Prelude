"use client";

import { useEffect, useState } from "react";

/**
 * Branded splash shown on a full page load, then fades away. Only renders for
 * full loads (the root layout persists across in-app navigations).
 */
export function AppSplash() {
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 1100);
    const t2 = setTimeout(() => setGone(true), 1650);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        fading ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="grad-fill animate-splashpop flex h-20 w-20 items-center justify-center rounded-3xl text-4xl font-bold shadow-xl shadow-primary/30">
        P
      </div>
      <h1 className="animate-rise mt-5 text-3xl font-bold tracking-tight">Prelude</h1>
      <p className="animate-rise mt-1 text-sm text-muted-foreground">from lead to plan</p>
      <div className="mt-7 flex gap-2">
        <span className="dotpulse h-2 w-2 rounded-full bg-primary" style={{ animationDelay: "0ms" }} />
        <span className="dotpulse h-2 w-2 rounded-full bg-primary" style={{ animationDelay: "160ms" }} />
        <span className="dotpulse h-2 w-2 rounded-full bg-primary" style={{ animationDelay: "320ms" }} />
      </div>
    </div>
  );
}
