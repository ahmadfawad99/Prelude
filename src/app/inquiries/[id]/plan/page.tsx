export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { KeyTag } from "@/components/ui";
import { prisma } from "@/lib/db";
import { PlanWorkbook } from "./plan-workbook";

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inquiry = await prisma.inquiry.findUnique({
    where: { id },
    select: { id: true, key: true, title: true, summary: { select: { document: true } } },
  });
  if (!inquiry) notFound();
  const defaultRequirements = inquiry.summary?.document ?? "";

  return (
    <AppShell fullWidth>
      <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/inquiries" className="hover:text-foreground">Inquiries</Link>
        <span>/</span>
        <Link href={`/inquiries/${inquiry.id}`}><KeyTag>{inquiry.key}</KeyTag></Link>
        <span>/</span>
        <span className="text-foreground">Project Plan</span>
      </div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Project Plan</h1>
          <p className="text-sm text-muted-foreground">{inquiry.title}</p>
        </div>
        <a href={`/api/inquiries/${inquiry.id}/export`} className="btn-secondary">↓ Export Excel</a>
      </div>
      <PlanWorkbook inquiryId={inquiry.id} defaultRequirements={defaultRequirements} />
    </AppShell>
  );
}
