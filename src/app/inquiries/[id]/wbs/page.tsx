export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { KeyTag } from "@/components/ui";
import { prisma } from "@/lib/db";
import { getWbs } from "@/modules/wbs/service";
import { WbsPanel } from "./wbs-panel";

export default async function WbsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inquiry = await prisma.inquiry.findUnique({
    where: { id },
    select: { id: true, key: true, title: true, summary: true },
  });
  if (!inquiry) notFound();
  const wbs = await getWbs(id);
  const s = inquiry.summary;
  const defaultRequirements = s?.document ?? (s ? [s.executive ?? "", ...s.clientWants.map((w) => `- ${w}`)].join("\n") : "");

  return (
    <AppShell fullWidth>
      <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/inquiries" className="hover:text-foreground">Inquiries</Link>
        <span>/</span>
        <Link href={`/inquiries/${inquiry.id}`}><KeyTag>{inquiry.key}</KeyTag></Link>
        <span>/</span>
        <span className="text-foreground">WBS</span>
      </div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Work Breakdown Structure</h1>
          <p className="text-sm text-muted-foreground">{inquiry.title}</p>
        </div>
        {wbs && <a href={`/api/inquiries/${inquiry.id}/export`} className="btn-secondary">↓ Export Excel</a>}
      </div>
      <WbsPanel inquiryId={inquiry.id} wbs={wbs} defaultRequirements={defaultRequirements} />
    </AppShell>
  );
}
