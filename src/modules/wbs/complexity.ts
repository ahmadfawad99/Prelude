import type { Complexity } from "@prisma/client";

// Complexity → story points and full-stack engineers (per the agreed model).
export const COMPLEXITY_SP: Record<Complexity, number> = {
  LOW: 3,
  LOW_MEDIUM: 5,
  MEDIUM: 13,
};

export const COMPLEXITY_ENGINEERS: Record<Complexity, number> = {
  LOW: 1,
  LOW_MEDIUM: 1,
  MEDIUM: 2,
};

export const COMPLEXITY_LABEL: Record<Complexity, string> = {
  LOW: "Low",
  LOW_MEDIUM: "Low-Medium",
  MEDIUM: "Medium",
};

export const COMPLEXITY_VALUES: Complexity[] = ["LOW", "LOW_MEDIUM", "MEDIUM"];

export function spFor(c: Complexity | null | undefined): number | null {
  return c ? COMPLEXITY_SP[c] : null;
}
export function engineersFor(c: Complexity | null | undefined): number | null {
  return c ? COMPLEXITY_ENGINEERS[c] : null;
}

// Complexity is ordinal (Low < Low-Medium < Medium); an epic's complexity is the
// average of its features' complexities, rounded to the nearest level.
const CX_ORDINAL: Record<Complexity, number> = { LOW: 1, LOW_MEDIUM: 2, MEDIUM: 3 };
const ORDINAL_CX: Record<number, Complexity> = { 1: "LOW", 2: "LOW_MEDIUM", 3: "MEDIUM" };

/** The average complexity of a set of features (null when none have one set). */
export function averageComplexity(complexities: (Complexity | null | undefined)[]): Complexity | null {
  const vals = complexities.filter((c): c is Complexity => !!c).map((c) => CX_ORDINAL[c]);
  if (vals.length === 0) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const rounded = Math.min(3, Math.max(1, Math.round(avg)));
  return ORDINAL_CX[rounded];
}
