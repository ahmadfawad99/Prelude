import type { InquiryStatus } from "@prisma/client";

/**
 * The presales pipeline as an enforced state machine. Columns mirror the team's
 * Jira board: Request → Understanding → Design/POC/Prototype → Estimates →
 * Review → Handoff, plus terminal outcomes.
 */
export const BOARD_COLUMNS: InquiryStatus[] = [
  "REQUEST",
  "UNDERSTANDING",
  "DESIGN_POC_PROTOTYPE",
  "ESTIMATES",
  "REVIEW",
  "HANDOFF",
];

export const TRANSITIONS: Record<InquiryStatus, InquiryStatus[]> = {
  REQUEST: ["UNDERSTANDING", "LOST", "ARCHIVED"],
  UNDERSTANDING: ["DESIGN_POC_PROTOTYPE", "ESTIMATES", "REQUEST", "LOST", "ARCHIVED"],
  DESIGN_POC_PROTOTYPE: ["ESTIMATES", "UNDERSTANDING", "REVIEW", "LOST", "ARCHIVED"],
  ESTIMATES: ["REVIEW", "DESIGN_POC_PROTOTYPE", "UNDERSTANDING", "LOST", "ARCHIVED"],
  REVIEW: ["HANDOFF", "ESTIMATES", "WON", "LOST", "ARCHIVED"],
  HANDOFF: ["WON", "REVIEW", "LOST", "ARCHIVED"],
  WON: ["ARCHIVED"],
  LOST: ["ARCHIVED", "UNDERSTANDING"],
  ARCHIVED: [],
};

export function canTransition(from: InquiryStatus, to: InquiryStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * The sequence of legal forward steps along the linear pipeline to get from
 * `from` to `target` (exclusive of `from`, inclusive of `target`). Returns [] if
 * either status is off the pipeline, `from` is already at or past `target`, or a
 * required step is illegal. Never walks backward or into terminal states — used
 * by one-click approvals that need to carry the lead's status forward.
 */
export function forwardPath(from: InquiryStatus, target: InquiryStatus): InquiryStatus[] {
  const fromIdx = BOARD_COLUMNS.indexOf(from);
  const toIdx = BOARD_COLUMNS.indexOf(target);
  if (fromIdx < 0 || toIdx < 0 || fromIdx >= toIdx) return [];
  const steps: InquiryStatus[] = [];
  for (let i = fromIdx; i < toIdx; i++) {
    const next = BOARD_COLUMNS[i + 1];
    if (!canTransition(BOARD_COLUMNS[i], next)) break;
    steps.push(next);
  }
  return steps;
}

export class InvalidTransitionError extends Error {
  constructor(from: InquiryStatus, to: InquiryStatus) {
    super(`Invalid status transition: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(from: InquiryStatus, to: InquiryStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}
