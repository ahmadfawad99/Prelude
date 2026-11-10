import type { InquiryStatus, Priority } from "@prisma/client";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/lib/format";

const STATUS_STYLES: Record<InquiryStatus, string> = {
  REQUEST: "bg-slate-100 text-slate-700",
  UNDERSTANDING: "bg-blue-100 text-blue-700",
  DESIGN_POC_PROTOTYPE: "bg-purple-100 text-purple-700",
  ESTIMATES: "bg-amber-100 text-amber-800",
  REVIEW: "bg-indigo-100 text-indigo-700",
  HANDOFF: "bg-emerald-100 text-emerald-700",
  WON: "bg-green-100 text-green-800",
  LOST: "bg-red-100 text-red-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
};

const PRIORITY_STYLES: Record<Priority, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-red-100 text-red-700",
};

export function StatusBadge({ status }: { status: InquiryStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[priority]}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
