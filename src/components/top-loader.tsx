"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** A thin top progress bar that appears on internal navigation. */
export function TopLoader() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const el = (e.target as HTMLElement)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!el) return;
      const href = el.getAttribute("href") ?? "";
      if (href.startsWith("/") && !el.target && !el.hasAttribute("download")) setActive(true);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Clear when the destination has rendered.
  useEffect(() => {
    setActive(false);
  }, [pathname]);

  // Safety timeout.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(false), 8000);
    return () => clearTimeout(t);
  }, [active]);

  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden">
      <div
        className="h-full w-full origin-left animate-[toploader_1.2s_ease-in-out_infinite]"
        style={{ backgroundImage: "linear-gradient(90deg, hsl(var(--accent-from)), hsl(var(--accent-to)))" }}
      />
    </div>
  );
}
