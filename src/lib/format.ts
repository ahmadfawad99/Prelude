import type { InquiryStatus, Priority } from "@prisma/client";

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const STATUS_LABELS: Record<InquiryStatus, string> = {
  REQUEST: "Request",
  UNDERSTANDING: "Understanding",
  DESIGN_POC_PROTOTYPE: "Design / POC / Prototype",
  ESTIMATES: "Estimates",
  REVIEW: "Review",
  HANDOFF: "Handoff",
  WON: "Won",
  LOST: "Lost",
  ARCHIVED: "Archived",
};

export const TYPE_LABELS: Record<string, string> = {
  CALL_REQUIRED: "Call required",
  RFP_BASED: "RFP-based",
  POC_REQUIRED: "POC required",
  ESTIMATION_ONLY: "Estimation only",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};
