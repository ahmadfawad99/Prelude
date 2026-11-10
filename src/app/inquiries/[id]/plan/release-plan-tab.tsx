import type { ResourceRate, SprintPlan, SprintAllocation } from "@prisma/client";
import type { DerivedPlan } from "@/modules/plans/derive";
import { RELEASE_PLAN_ROLES } from "@/modules/plans/service";
import { SubmitButton } from "@/components/submit-button";
import {
  generatePlanAction,
  updateSprintAction,
  addSprintAction,
  deleteSprintAction,
  setMarginAction,
  approvePlanAction,
  rejectPlanAction,
  importPlanAction,
  generateReleaseSummariesAction,
} from "./actions";

const APPROVAL_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  IN_REVIEW: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const di = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

type PlanWithSprints = {
  id: string;
  status: string;
  version: number;
  marginPct: number;
  sprints: (SprintPlan & { allocations: SprintAllocation[] })[];
};

export function ReleasePlanTab({
  inquiryId,
  plan,
  rates,
  derived,
  wbsApproved,
}: {
  inquiryId: string;
  plan: PlanWithSprints | null;
  rates: ResourceRate[];
  derived: DerivedPlan | null;
  wbsApproved: boolean;
}) {
  if (!plan || !derived) {
    return (
      <div className="card max-w-2xl p-5">
        {wbsApproved ? (
          <>
            <p className="text-sm text-muted-foreground">Seeds sprints and a default team from the approved WBS; costs recompute live.</p>
            <form action={generatePlanAction} className="mt-3">
              <input type="hidden" name="inquiryId" value={inquiryId} />
              <SubmitButton pendingText="Generating…">Generate Release Plan</SubmitButton>
            </form>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Approve the WBS tab first to unlock the Release Plan.</p>
        )}
      </div>
    );
  }

  const derivedById = new Map(derived.sprints.map((s) => [s.id, s]));
  void rates;
  const roles = RELEASE_PLAN_ROLES;
  const COLS = `130px 180px 52px 118px 118px ${roles.map(() => "92px").join(" ")} 56px 92px 76px 86px`;
  const minW = 760 + roles.length * 92;

  return (
    <div>
      {/* Approval bar */}
      <div className="card mb-3 flex flex-wrap items-center gap-3 px-4 py-3">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${APPROVAL_STYLES[plan.status]}`}>{plan.status.replace("_", " ")}</span>
        <span className="text-sm text-muted-foreground">{plan.sprints.length} sprints · {money(derived.totalCost)} · {derived.totalHours} hrs · v{plan.version}</span>
        <form action={setMarginAction} className="flex items-center gap-1 text-sm">
          <input type="hidden" name="inquiryId" value={inquiryId} />
          <span className="text-muted-foreground">Margin %</span>
          <input name="marginPct" defaultValue={Math.round(plan.marginPct * 100)} className="w-14 rounded-md border border-border bg-card px-1.5 py-1" />
          <button className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">Set</button>
        </form>
        <div className="ml-auto flex items-center gap-2">
          {plan.status !== "APPROVED" ? (
            <form action={approvePlanAction}><input type="hidden" name="inquiryId" value={inquiryId} /><SubmitButton pendingText="Approving…">✓ Approve plan</SubmitButton></form>
          ) : (
            <>
              <span className="text-sm font-medium text-emerald-700">✓ Plan approved</span>
              <form action={rejectPlanAction}><input type="hidden" name="inquiryId" value={inquiryId} /><button className="btn-secondary !py-1.5 text-xs">Reopen</button></form>
            </>
          )}
        </div>
      </div>

      {/* Matrix */}
      <div className="scrollbar-thin card overflow-x-auto">
        <div style={{ minWidth: minW }}>
          <div className="grid items-end gap-1 border-b border-border bg-muted/50 px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" style={{ gridTemplateColumns: COLS }}>
            <span>Sprint Release Group</span><span>Summary</span><span>Sprint</span><span>Start Date</span><span>End Date</span>
            {roles.map((r) => <span key={r} title={r} className="truncate">{r}</span>)}
            <span className="text-right">Hours</span><span className="text-right">Expected Cost</span><span className="text-right">Blended Rate</span><span>Actions</span>
          </div>
          {plan.sprints.map((sp) => {
            const d = derivedById.get(sp.id);
            const fteFor = (role: string) => sp.allocations.find((a) => a.role === role)?.fteFraction ?? "";
            return (
              <form key={sp.id} action={updateSprintAction} className="grid items-center gap-1 border-t border-border px-2 py-1.5 text-sm transition hover:bg-muted/30" style={{ gridTemplateColumns: COLS }}>
                <input type="hidden" name="inquiryId" value={inquiryId} />
                <input type="hidden" name="sprintId" value={sp.id} />
                <input name="releaseGroup" defaultValue={sp.releaseGroup ?? ""} className="rounded border border-transparent px-1.5 py-1 transition hover:border-border focus:border-primary focus:bg-card focus:outline-none" />
                <input name="summary" defaultValue={sp.summary ?? ""} placeholder="Summary…" className="rounded border border-transparent px-1.5 py-1 text-xs transition hover:border-border focus:border-primary focus:bg-card focus:outline-none" />
                <input name="sprintNo" defaultValue={sp.sprintNo} className="rounded border border-transparent px-1 py-1 text-center transition hover:border-border focus:border-primary focus:bg-card focus:outline-none" />
                <input type="date" name="startDate" defaultValue={di(sp.startDate)} className="rounded border border-transparent px-1 py-1 text-xs transition hover:border-border focus:border-primary focus:bg-card focus:outline-none" />
                <input type="date" name="endDate" defaultValue={di(sp.endDate)} className="rounded border border-transparent px-1 py-1 text-xs transition hover:border-border focus:border-primary focus:bg-card focus:outline-none" />
                {roles.map((r) => (
                  <input key={r} name={`fte:${r}`} defaultValue={fteFor(r)} className="rounded border border-transparent px-1 py-1 text-center transition hover:border-border focus:border-primary focus:bg-card focus:outline-none" />
                ))}
                <span className="text-right text-muted-foreground">{d?.hours ?? 0}</span>
                <span className="text-right font-medium">{money(d?.cost ?? 0)}</span>
                <span className="text-right text-muted-foreground">{d?.blendedRate != null ? `$${d.blendedRate.toFixed(1)}` : "—"}</span>
                <div className="flex gap-1">
                  <button className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">Save</button>
                  <button formAction={deleteSprintAction} className="rounded-md border border-border px-2 py-1 text-xs text-red-500 hover:bg-muted">Del</button>
                </div>
              </form>
            );
          })}
          <div className="grid items-center gap-1 border-t-2 border-border bg-muted/40 px-2 py-2 text-sm font-semibold" style={{ gridTemplateColumns: COLS }}>
            <span className="col-span-5">Totals</span>
            {roles.map((r) => <span key={r} />)}
            <span className="text-right">{derived.totalHours}</span>
            <span className="text-right">{money(derived.totalCost)}</span>
            <span /><span />
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <form action={addSprintAction}>
          <input type="hidden" name="inquiryId" value={inquiryId} />
          <input type="hidden" name="planId" value={plan.id} />
          <button className="btn-secondary !py-1.5 text-xs">+ Add sprint</button>
        </form>
        <form action={generateReleaseSummariesAction}>
          <input type="hidden" name="inquiryId" value={inquiryId} />
          <SubmitButton className="btn-secondary !py-1.5 text-xs" pendingText="Summarizing… (~10s)">✨ AI release summaries</SubmitButton>
        </form>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Import edited Excel</summary>
          <form action={importPlanAction} className="mt-2 flex items-center gap-2">
            <input type="hidden" name="inquiryId" value={inquiryId} />
            <input type="file" name="file" accept=".xlsx" required className="text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs" />
            <button className="btn-secondary !py-1.5 text-xs">↑ Import</button>
          </form>
        </details>
      </div>
    </div>
  );
}
