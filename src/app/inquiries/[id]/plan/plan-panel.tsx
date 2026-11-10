import Link from "next/link";
import { getPlan } from "@/modules/plans/service";
import { listActiveRates } from "@/modules/rates/service";
import { buildRateMap, derivePlan } from "@/modules/plans/derive";
import {
  generatePlanAction,
  importPlanAction,
  updateSprintAction,
  addSprintAction,
  deleteSprintAction,
  setMarginAction,
  approvePlanAction,
  rejectPlanAction,
} from "./actions";

const APPROVAL_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  IN_REVIEW: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export async function PlanPanel({
  inquiryId,
  wbsApproved,
}: {
  inquiryId: string;
  wbsApproved: boolean;
}) {
  const [plan, rates] = await Promise.all([getPlan(inquiryId), listActiveRates()]);

  if (!plan) {
    return (
      <div className="card max-w-2xl p-5">
        {wbsApproved ? (
          <>
            <p className="text-sm text-muted-foreground">Seeds sprints and a default team from the approved WBS; costs recompute live as you tune allocations.</p>
            <form action={generatePlanAction} className="mt-3">
              <input type="hidden" name="inquiryId" value={inquiryId} />
              <button className="btn-primary">Generate Project Plan</button>
            </form>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Approve the WBS first to unlock the Project Plan. <Link href={`/inquiries/${inquiryId}/wbs`} className="text-primary underline">Open WBS →</Link>
          </p>
        )}
      </div>
    );
  }

  const rateMap = buildRateMap(rates);
  const derived = derivePlan(plan.sprints, rateMap, plan.marginPct);
  const derivedById = new Map(derived.sprints.map((s) => [s.id, s]));
  const roles = rates.map((r) => r.role);
  const COLS = `110px 56px ${roles.map(() => "72px").join(" ")} 70px 90px 80px 96px`;

  return (
    <div>
      {/* Approval bar — one-click */}
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
            <form action={approvePlanAction}>
              <input type="hidden" name="inquiryId" value={inquiryId} />
              <button className="btn-primary">✓ Approve plan</button>
            </form>
          ) : (
            <>
              <span className="text-sm font-medium text-emerald-700">✓ Plan approved</span>
              <form action={rejectPlanAction}>
                <input type="hidden" name="inquiryId" value={inquiryId} />
                <button className="btn-secondary !py-1.5 text-xs">Reopen</button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Matrix */}
      <div className="scrollbar-thin card overflow-x-auto">
        <div style={{ minWidth: `${560 + roles.length * 72}px` }}>
          <div className="grid items-end gap-1 border-b border-border bg-muted/50 px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" style={{ gridTemplateColumns: COLS }}>
            <span>Release</span><span>Sprint</span>
            {roles.map((r) => <span key={r} title={r} className="truncate">{r}</span>)}
            <span className="text-right">Hours</span><span className="text-right">Cost</span><span className="text-right">Blended</span><span>Actions</span>
          </div>
          {plan.sprints.map((sp) => {
            const d = derivedById.get(sp.id);
            const fteFor = (role: string) => sp.allocations.find((a) => a.role === role)?.fteFraction ?? "";
            return (
              <form key={sp.id} action={updateSprintAction} className="grid items-center gap-1 border-t border-border px-2 py-1.5 text-sm transition hover:bg-muted/30" style={{ gridTemplateColumns: COLS }}>
                <input type="hidden" name="inquiryId" value={inquiryId} />
                <input type="hidden" name="sprintId" value={sp.id} />
                <input name="releaseGroup" defaultValue={sp.releaseGroup ?? ""} className="rounded border border-transparent px-1.5 py-1 transition hover:border-border focus:border-primary focus:bg-card focus:outline-none" />
                <input name="sprintNo" defaultValue={sp.sprintNo} className="rounded border border-transparent px-1 py-1 text-center transition hover:border-border focus:border-primary focus:bg-card focus:outline-none" />
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
            <span className="col-span-2">Totals</span>
            {roles.map((r) => <span key={r} />)}
            <span className="text-right">{derived.totalHours}</span>
            <span className="text-right">{money(derived.totalCost)}</span>
            <span /><span />
          </div>
        </div>
      </div>

      <form action={addSprintAction} className="mt-2">
        <input type="hidden" name="inquiryId" value={inquiryId} />
        <input type="hidden" name="planId" value={plan.id} />
        <button className="btn-secondary !py-1.5 text-xs">+ Add sprint</button>
      </form>

      {/* Derived summary */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card title="Budget by release">
          <ul className="space-y-1 text-sm">
            {derived.budgetByRelease.map((b) => (
              <li key={b.releaseGroup} className="flex justify-between"><span>{b.releaseGroup}</span><span className="text-muted-foreground">{money(b.low)} – {money(b.high)}</span></li>
            ))}
            <li className="flex justify-between border-t border-border pt-1 font-semibold"><span>Overall</span><span>{money(derived.totalCost)}</span></li>
          </ul>
        </Card>
        <Card title="Team summary">
          <ul className="space-y-1 text-sm">
            {derived.team.map((t) => <li key={t.role} className="flex justify-between"><span className="truncate">{t.role}</span><span className="text-muted-foreground">{t.avgFte.toFixed(2)} FTE</span></li>)}
          </ul>
        </Card>
        <Card title="Totals">
          <dl className="space-y-1.5 text-sm">
            <Row label="Total cost">{money(derived.totalCost)}</Row>
            <Row label="Total hours">{derived.totalHours}</Row>
            <Row label="Monthly burn">{money(derived.monthlyBurn)}</Row>
            <Row label="Margin">±{Math.round(plan.marginPct * 100)}%</Row>
          </dl>
        </Card>
      </div>

      {/* Import */}
      <details className="mt-4 max-w-2xl text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Import edited Excel</summary>
        <form action={importPlanAction} className="mt-2 flex items-center gap-2">
          <input type="hidden" name="inquiryId" value={inquiryId} />
          <input type="file" name="file" accept=".xlsx" required className="text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs" />
          <button className="btn-secondary !py-1.5 text-xs">↑ Import</button>
        </form>
      </details>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="card p-4"><h3 className="mb-2 text-sm font-semibold">{title}</h3>{children}</section>;
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{children}</dd></div>;
}
