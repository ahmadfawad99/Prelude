import type { Priority } from "@prisma/client";

const AVATAR_COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-fuchsia-500",
];

function hashIndex(s: string, mod: number) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
}

function initials(name?: string | null, email?: string | null) {
  const base = (name || email || "?").trim();
  const parts = base.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function Avatar({
  name,
  email,
  size = 24,
}: {
  name?: string | null;
  email?: string | null;
  size?: number;
}) {
  const key = name || email || "?";
  const color = AVATAR_COLORS[hashIndex(key, AVATAR_COLORS.length)];
  return (
    <span
      title={name ?? email ?? ""}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${color}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name, email)}
    </span>
  );
}

export function LabelChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
      {children}
    </span>
  );
}

const PRIORITY_META: Record<Priority, { color: string; glyph: string; label: string }> = {
  HIGH: { color: "text-red-500", glyph: "⌃⌃", label: "High" },
  MEDIUM: { color: "text-amber-500", glyph: "=", label: "Medium" },
  LOW: { color: "text-sky-500", glyph: "⌄", label: "Low" },
};

export function PriorityIcon({ priority }: { priority: Priority }) {
  const m = PRIORITY_META[priority];
  return (
    <span title={`${m.label} priority`} className={`font-bold leading-none ${m.color}`}>
      {m.glyph}
    </span>
  );
}

export function KeyTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
      <span className="inline-block h-3 w-3 rounded-[3px] border border-primary/50 bg-primary/10" />
      {children}
    </span>
  );
}
