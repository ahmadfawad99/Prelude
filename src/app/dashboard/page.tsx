export const dynamic = "force-dynamic";

import Link from "next/link";
import type { InquiryStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/badges";
import { Avatar, PriorityIcon, KeyTag } from "@/components/ui";
import { NewLeadButton } from "@/components/new-lead-modal";
import { formatDate } from "@/lib/format";

const OPEN_EXCLUDED: InquiryStatus[] = ["WON", "LOST", "ARCHIVED"];

export default async function DashboardPage() {
  const [total, open, won, clients, recent] = await Promise.all([
    prisma.inquiry.count(),
    prisma.inquiry.count({ where: { status: { notIn: OPEN_EXCLUDED } } }),
    prisma.inquiry.count({ where: { status: "WON" } }),
    prisma.client.count(),
    prisma.inquiry.findMany({
      take: 8,
      orderBy: { updatedAt: "desc" },
      include: { client: { select: { name: true } }, assignee: { select: { name: true, email: true } } },
    }),
  ]);

  const stats = [
    { label: "Total leads", value: total },
    { label: "Open", value: open },
    { label: "Won", value: won },
    { label: "Clients", value: clients },
  ];

  return (
    <AppShell>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <NewLeadButton />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-2xl font-semibold">{s.value}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Recently updated</h2>
        <Link href="/inquiries" className="text-sm text-muted-foreground hover:text-foreground">View all →</Link>
      </div>
      {recent.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No leads yet. Create your first one.
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
          {recent.map((i) => (
            <li key={i.id}>
              <Link href={`/inquiries/${i.id}`} className="flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-muted/50">
                <KeyTag>{i.key}</KeyTag>
                <span className="flex-1 truncate font-medium">{i.title}</span>
                <span className="hidden text-xs text-muted-foreground sm:inline">{i.client?.name ?? "—"}</span>
                <PriorityIcon priority={i.priority} />
                <StatusBadge status={i.status} />
                <span className="hidden w-20 text-right text-xs text-muted-foreground md:inline">{formatDate(i.updatedAt)}</span>
                <Avatar name={i.assignee?.name} email={i.assignee?.email} size={24} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
