import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/session";
import { Avatar } from "@/components/ui";
import { NewLeadButton } from "@/components/new-lead-modal";

export async function AppShell({ children, fullWidth, bare }: { children: ReactNode; fullWidth?: boolean; bare?: boolean }) {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen">
      {/* Top bar — holds the nav (no left sidebar), like NotebookLM */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-card/70 px-4 backdrop-blur-md">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold text-white shadow-sm"
            style={{ backgroundImage: "linear-gradient(135deg, hsl(var(--accent-from)), hsl(var(--accent-to)))" }}
          >
            P
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Prelude</span>
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden w-72 items-center gap-2 rounded-full border border-border bg-background/60 px-4 py-2 text-sm text-muted-foreground transition hover:border-primary/30 md:flex">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" strokeLinecap="round" />
            </svg>
            <span>Search</span>
          </div>
          <NewLeadButton />
          <Avatar name={user?.name} email={user?.email} size={30} />
        </div>
      </header>

      {/* Main — full width, no sidebar */}
      <main className="min-w-0">
        {bare ? children : <div className={fullWidth ? "px-6 py-7 lg:px-10" : "mx-auto max-w-6xl px-6 py-6"}>{children}</div>}
      </main>
    </div>
  );
}
