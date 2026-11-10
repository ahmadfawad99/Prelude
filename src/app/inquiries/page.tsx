export const dynamic = "force-dynamic";

import Link from "next/link";
import type { InquiryStatus } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/badges";
import { Avatar, LabelChip, PriorityIcon, KeyTag } from "@/components/ui";
import { KanbanBoard, type BoardCard } from "@/components/kanban-board";
import { formatDate, STATUS_LABELS } from "@/lib/format";
import { listInquiries } from "@/modules/inquiries/service";
import { getCurrentUser } from "@/lib/session";

type Scope = "all" | "mine";
type View = "list" | "board";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; scope?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const scope: Scope = sp.scope === "mine" ? "mine" : "all";
  const view: View = sp.view === "board" ? "board" : "list";
  const status = sp.status && sp.status in STATUS_LABELS ? (sp.status as InquiryStatus) : undefined;
  const q = sp.q?.trim() || undefined;

  const inquiries = await listInquiries({
    status,
    q,
    mineUserId: scope === "mine" ? user?.id : undefined,
  });

  const qs = (over: Partial<{ scope: Scope; view: View }>) => {
    const p = new URLSearchParams();
    p.set("scope", over.scope ?? scope);
    p.set("view", over.view ?? view);
    if (status) p.set("status", status);
    if (q) p.set("q", q);
    return `/inquiries?${p.toString()}`;
  };

  return (
    <AppShell fullWidth>
      <div className="mb-5">
        <h1 className="text-[28px] font-bold tracking-tight">Leads</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Inquiries across the organization.</p>
      </div>

      {/* Scope tabs + view toggle */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border">
        <div className="flex gap-1">
          {([
            ["all", "All leads"],
            ["mine", "My leads"],
          ] as const).map(([s, label]) => (
            <Link
              key={s}
              href={qs({ scope: s })}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
                scope === s
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="mb-2 flex items-center gap-1 rounded-lg bg-muted/60 p-0.5">
          {([
            ["list", "List", "M4 6h16M4 12h16M4 18h16"],
            ["board", "Board", "M4 4h5v16H4zM10 4h5v10h-5zM16 4h4v7h-4z"],
          ] as const).map(([v, label, icon]) => (
            <Link
              key={v}
              href={qs({ view: v })}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={icon} />
              </svg>
              {label}
            </Link>
          ))}
        </div>
      </div>

      <form className="mb-4 flex flex-wrap gap-2" action="/inquiries" method="get">
        <input type="hidden" name="scope" value={scope} />
        <input type="hidden" name="view" value={view} />
        <input name="q" defaultValue={q} placeholder="Search title or key…" className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        <select name="status" defaultValue={status ?? ""} className="rounded-md border border-border bg-card px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Filter</button>
      </form>

      {inquiries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No leads here yet. Use <span className="font-medium text-foreground">New lead</span> to add one.
        </div>
      ) : view === "board" ? (
        <KanbanBoard
          initialCards={inquiries.map<BoardCard>((i) => ({
            id: i.id,
            key: i.key,
            title: i.title,
            status: i.status,
            priority: i.priority,
            clientName: i.client?.name ?? null,
            assigneeName: i.assignee?.name ?? null,
            assigneeEmail: i.assignee?.email ?? null,
            tags: i.tags,
            dueDate: i.dueDate ? i.dueDate.toISOString() : null,
          }))}
        />
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-3 pr-4 font-semibold">Key</th>
              <th className="py-3 pr-4 font-semibold">Lead</th>
              <th className="hidden py-3 pr-4 font-semibold md:table-cell">Labels</th>
              <th className="py-3 pr-4 font-semibold">Status</th>
              <th className="py-3 pr-4 text-center font-semibold">Pri</th>
              <th className="hidden py-3 pr-4 font-semibold lg:table-cell">Updated</th>
              <th className="py-3 text-right font-semibold">Owner</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {inquiries.map((i) => (
              <tr key={i.id} className="group transition hover:bg-muted/40">
                <td className="py-3.5 pr-4"><Link href={`/inquiries/${i.id}`}><KeyTag>{i.key}</KeyTag></Link></td>
                <td className="py-3.5 pr-4">
                  <Link href={`/inquiries/${i.id}`} className="font-medium hover:text-primary hover:underline">{i.title}</Link>
                  <span className="ml-2 text-xs text-muted-foreground">{i.client?.name ?? ""}</span>
                </td>
                <td className="hidden py-3.5 pr-4 md:table-cell">
                  <div className="flex flex-wrap gap-1">{i.tags.slice(0, 2).map((t) => <LabelChip key={t}>{t}</LabelChip>)}</div>
                </td>
                <td className="py-3.5 pr-4"><StatusBadge status={i.status} /></td>
                <td className="py-3.5 pr-4 text-center"><PriorityIcon priority={i.priority} /></td>
                <td className="hidden py-3.5 pr-4 text-xs text-muted-foreground lg:table-cell">{formatDate(i.updatedAt)}</td>
                <td className="py-3.5 text-right"><span className="inline-flex"><Avatar name={i.assignee?.name} email={i.assignee?.email} size={24} /></span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AppShell>
  );
}
