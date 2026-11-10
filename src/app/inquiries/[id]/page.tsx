export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { NotebookShell } from "@/components/notebook-shell";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { Avatar, LabelChip, KeyTag } from "@/components/ui";
import { formatDate, STATUS_LABELS, TYPE_LABELS } from "@/lib/format";
import { getInquiry } from "@/modules/inquiries/service";
import { getWbs } from "@/modules/wbs/service";
import { TRANSITIONS } from "@/modules/inquiries/state-machine";
import { listUsers } from "@/modules/users/service";
import { SummarySection } from "./summary-section";
import { SourcesPanel, type SourceItem } from "./sources-panel";
import { StudioPanel } from "./studio-panel";
import { ChatPanel, type ChatMsg } from "./chat-panel";
import { DiagramArtifact } from "./diagram-artifact";
import { PlanWorkbook } from "./plan/plan-workbook";
import { listChat } from "@/modules/chat/service";
import { getDiagram, listDiagramVersions } from "@/modules/diagrams/service";
import { SubmitButton } from "@/components/submit-button";
import {
  assignInquiryAction,
  assignToMeAction,
  transitionInquiryAction,
  updateDetailsAction,
  uploadAttachmentAction,
  deleteAttachmentAction,
} from "../actions";

function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
const dateInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function InquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [inquiry, users, wbs, chatMessages, diagram, diagramVersions] = await Promise.all([
    getInquiry(id),
    listUsers(),
    getWbs(id),
    listChat(id),
    getDiagram(id),
    listDiagramVersions(id),
  ]);
  if (!inquiry) notFound();

  const sources: SourceItem[] = inquiry.sources.map((s) => ({ id: s.id, kind: s.kind, name: s.name, url: s.url, chars: s.content.length }));
  const chatMsgs: ChatMsg[] = chatMessages.map((m) => ({ id: m.id, role: m.role, content: m.content, action: m.action }));

  const nextStates = TRANSITIONS[inquiry.status] ?? [];
  const wbsApproved = wbs?.status === "APPROVED";
  const defaultRequirements = inquiry.summary?.document ?? "";
  const wbsOn = inquiry.wbsEnabled;
  const planOn = inquiry.planEnabled;

  // ---- Header (fixed, above the three panes) ----
  const header = (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="mb-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/inquiries" className="hover:text-foreground">Leads</Link>
          <span>/</span>
          <KeyTag>{inquiry.key}</KeyTag>
        </div>
        <h1 className="truncate text-2xl font-bold tracking-tight leading-tight">{inquiry.title}</h1>
      </div>
      <StatusBadge status={inquiry.status} />
    </div>
  );

  // ---- Left pane: Sources ----
  // A source added after the last analysis means artifacts are stale.
  const newestSource = inquiry.sources.reduce((max, s) => Math.max(max, s.createdAt.getTime()), 0);
  const sourcesStale = !!inquiry.summary && newestSource > inquiry.summary.createdAt.getTime();
  const left = (
    <SourcesPanel inquiryId={inquiry.id} sources={sources} hasBrief={!!inquiry.summary?.document} stale={sourcesStale} />
  );

  // ---- Center: Chat (grounded, task-running) ----
  const chat = (
    <ChatPanel inquiryId={inquiry.id} messages={chatMsgs} sourceCount={sources.length} />
  );

  // ---- Center: Analysis (brief) ----
  const analysis = (
    <div className="mx-auto max-w-3xl">
      <SummarySection inquiryId={inquiry.id} summary={inquiry.summary} fileBase={`${inquiry.key}-analysis`} />
    </div>
  );

  // ---- Estimates (WBS) and Release Plan artifacts (same workbook, different landing tab) ----
  const stagesOff = (
    <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
      Estimation stages are turned off for this lead. Enable WBS / Project Plan in Details →
    </div>
  );
  const estimates = (wbsOn || planOn) ? (
    <PlanWorkbook inquiryId={inquiry.id} defaultRequirements={defaultRequirements} initialTab={2} />
  ) : stagesOff;
  const planNode = (wbsOn || planOn) ? (
    <PlanWorkbook inquiryId={inquiry.id} defaultRequirements={defaultRequirements} initialTab={3} />
  ) : stagesOff;

  // ---- Center: Flow diagram artifact ----
  const diagramNode = <DiagramArtifact inquiryId={inquiry.id} diagram={diagram} versions={diagramVersions} />;

  // ---- Right pane: Studio + Status + Details ----
  const studio = (
    <div className="space-y-4">
      <StudioPanel
        flags={{
          inquiryId: inquiry.id,
          hasBrief: !!inquiry.summary?.document,
          briefVersion: inquiry.summary?.version ?? 0,
          briefMarkdown: inquiry.summary?.document ?? "",
          hasSources: sources.length > 0,
          hasWbs: !!wbs,
          wbsVersion: wbs?.version ?? 0,
          hasPlan: !!inquiry.plan,
          planVersion: inquiry.plan?.version ?? 0,
          hasDiagram: !!diagram,
          diagramVersion: diagram?.version ?? 0,
          diagramCode: diagram?.code ?? "",
          wbsOn,
          planOn,
          exportHref: `/api/inquiries/${id}/export`,
        }}
      />

      <details className="group">
        <summary className="nb-card flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground transition hover:bg-muted">
          <span>Lead details &amp; status</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
        </summary>
        <div className="mt-2 space-y-4">
      <div className="card p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          <StatusBadge status={inquiry.status} />
        </div>
        {nextStates.length > 0 && (
          <form action={transitionInquiryAction} className="flex items-center gap-1">
            <input type="hidden" name="inquiryId" value={inquiry.id} />
            <select name="to" className="flex-1 rounded-md border border-border bg-card px-2 py-1 text-xs">
              {nextStates.map((s) => <option key={s} value={s}>Move to: {STATUS_LABELS[s]}</option>)}
            </select>
            <SubmitButton className="grad-fill rounded-md px-3 py-1 text-xs font-semibold shadow-sm transition hover:brightness-110" pendingText="…">Move</SubmitButton>
          </form>
        )}
      </div>

      <div className="card">
        <p className="border-b border-border bg-gradient-to-r from-primary/10 to-transparent px-3 py-2.5 text-xs font-bold uppercase tracking-wider grad-text">Details</p>
        <dl className="space-y-3 p-3 text-sm">
          <Row label="Assignee">
            <div className="flex flex-col items-end gap-1">
              <form action={assignInquiryAction} className="flex items-center gap-1">
                <input type="hidden" name="inquiryId" value={inquiry.id} />
                <select name="assigneeId" defaultValue={inquiry.assigneeId ?? ""} className="w-36 rounded-md border border-border bg-card px-2 py-1 text-xs">
                  <option value="">Unassigned</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}
                </select>
                <SubmitButton className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted" pendingText="…">Set</SubmitButton>
              </form>
              <form action={assignToMeAction}><input type="hidden" name="inquiryId" value={inquiry.id} /><button className="text-xs text-primary hover:underline">Assign to me</button></form>
            </div>
          </Row>
          <Row label="Reporter"><span className="flex items-center gap-1.5"><Avatar name={inquiry.reporter?.name} email={inquiry.reporter?.email} size={20} />{inquiry.reporter?.name ?? inquiry.reporter?.email ?? "—"}</span></Row>
          <Row label="Client">{inquiry.client?.name ?? "—"}</Row>
          <Row label="Type">{inquiry.type.length ? inquiry.type.map((t) => TYPE_LABELS[t]).join(", ") : "—"}</Row>
          <Row label="Priority"><PriorityBadge priority={inquiry.priority} /></Row>
          <Row label="Created">{formatDate(inquiry.createdAt)}</Row>
        </dl>
        <form action={updateDetailsAction} className="space-y-2 border-t border-border p-3 text-sm">
          <input type="hidden" name="inquiryId" value={inquiry.id} />
          <Field label="Priority">
            <select name="priority" defaultValue={inquiry.priority} className="w-full rounded-md border border-border bg-card px-2 py-1 text-xs">
              <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
            </select>
          </Field>
          <Field label="Labels (comma-separated)">
            <input name="tags" defaultValue={inquiry.tags.join(", ")} placeholder="e.g. WaitingForCustomerFeedback" className="w-full rounded-md border border-border bg-card px-2 py-1 text-xs" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start date"><input type="date" name="startDate" defaultValue={dateInput(inquiry.startDate)} className="w-full rounded-md border border-border bg-card px-2 py-1 text-xs" /></Field>
            <Field label="Due date"><input type="date" name="dueDate" defaultValue={dateInput(inquiry.dueDate)} className="w-full rounded-md border border-border bg-card px-2 py-1 text-xs" /></Field>
          </div>
          {inquiry.tags.length > 0 && <div className="flex flex-wrap gap-1 pt-1">{inquiry.tags.map((t) => <LabelChip key={t}>{t}</LabelChip>)}</div>}
          <div className="space-y-1 border-t border-border pt-2">
            <p className="text-[11px] font-medium text-muted-foreground">Stages for this lead</p>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="wbsEnabled" defaultChecked={inquiry.wbsEnabled} /> WBS</label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="planEnabled" defaultChecked={inquiry.planEnabled} /> Project Plan</label>
          </div>
          <SubmitButton className="btn-secondary !py-1.5 text-xs" pendingText="Saving…">Save details</SubmitButton>
        </form>
      </div>

      <div className="card">
        <p className="border-b border-border bg-gradient-to-r from-primary/10 to-transparent px-3 py-2.5 text-xs font-bold uppercase tracking-wider grad-text">Attachments ({inquiry.attachments.length})</p>
        <form action={uploadAttachmentAction} className="flex items-center gap-2 p-3">
          <input type="hidden" name="inquiryId" value={inquiry.id} />
          <input type="file" name="file" required className="flex-1 text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs" />
          <SubmitButton className="btn-secondary !py-1.5 text-xs" pendingText="…">Upload</SubmitButton>
        </form>
        {inquiry.attachments.length > 0 && (
          <ul className="divide-y divide-border border-t border-border">
            {inquiry.attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <a href={`/api/attachments/${a.id}`} target="_blank" className="flex-1 truncate font-medium text-primary hover:underline">{a.filename}</a>
                <span className="text-xs text-muted-foreground">{bytes(a.size)}</span>
                <form action={deleteAttachmentAction}>
                  <input type="hidden" name="inquiryId" value={inquiry.id} />
                  <input type="hidden" name="attachmentId" value={a.id} />
                  <button className="text-xs text-red-500 hover:underline">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
        </div>
      </details>
    </div>
  );

  return (
    <AppShell bare>
      <NotebookShell
        inquiryId={inquiry.id}
        rev={(inquiry.summary?.version ?? 0) + (wbs?.version ?? 0) + (inquiry.plan?.version ?? 0) + (diagram?.version ?? 0) + chatMessages.length}
        header={header}
        left={left}
        chat={chat}
        analysis={analysis}
        estimates={estimates}
        plan={planNode}
        diagram={diagramNode}
        studio={studio}
      />
    </AppShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-2"><dt className="shrink-0 pt-0.5 text-muted-foreground">{label}</dt><dd className="text-right">{children}</dd></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>{children}</label>;
}
