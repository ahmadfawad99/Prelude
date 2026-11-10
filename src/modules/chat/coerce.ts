import type { Complexity, Priority } from "@prisma/client";

// ---- argument coercion for chat tool calls (pure, unit-tested) ----

export function asStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function asComplexity(v: unknown): Complexity | undefined {
  return v === "LOW" || v === "LOW_MEDIUM" || v === "MEDIUM" ? v : undefined;
}

export function asPriority(v: unknown): Priority | undefined {
  return v === "LOW" || v === "MEDIUM" || v === "HIGH" ? v : undefined;
}

/**
 * Parse an ISO-ish date string ("YYYY-MM-DD" or similar) to a UTC-midnight Date,
 * or undefined. A plain calendar date is treated as UTC midnight so it displays
 * as the same day regardless of the server's timezone (fmtDate formats in UTC).
 */
export function asDate(v: unknown): Date | undefined {
  const s = asStr(v);
  if (!s) return undefined;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00Z` : s);
  return isNaN(d.getTime()) ? undefined : d;
}

export function fmtDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "not set";
}
