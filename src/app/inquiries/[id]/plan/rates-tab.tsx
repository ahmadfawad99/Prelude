import type { ResourceRate } from "@prisma/client";
import { createRateAction, updateRateAction, deleteRateAction } from "@/app/rates/actions";

const COLS = "1fr 110px 96px 110px 110px 60px 100px";
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export function RatesTab({ rates }: { rates: ResourceRate[] }) {
  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        The rate card that powers Release-Plan costs (shared across projects). Actual Cost = Monthly hours × Rate/hour; Monthly is the effective (discounted) cost.
      </p>
      <div className="scrollbar-thin card overflow-x-auto">
        <div className="min-w-[700px]">
          <div className="grid gap-1 border-b border-border bg-muted/50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" style={{ gridTemplateColumns: COLS }}>
            <span>Role</span><span>Monthly hrs</span><span>Rate/hr</span><span>Actual Cost</span><span>Monthly</span><span>Active</span><span>Actions</span>
          </div>
          {rates.map((r) => (
            <form key={r.id} action={updateRateAction} className="grid items-center gap-1 border-t border-border px-3 py-1.5 text-sm transition hover:bg-muted/30" style={{ gridTemplateColumns: COLS }}>
              <input type="hidden" name="id" value={r.id} />
              <Cell name="role" defaultValue={r.role} />
              <Cell name="monthlyHours" defaultValue={String(r.monthlyHours)} />
              <Cell name="ratePerHour" defaultValue={String(r.ratePerHour)} />
              <span className="px-1.5 text-muted-foreground">{money(r.monthlyHours * r.ratePerHour)}</span>
              <Cell name="effectiveMonthly" defaultValue={r.effectiveMonthly != null ? String(r.effectiveMonthly) : ""} placeholder="auto" />
              <input type="checkbox" name="active" defaultChecked={r.active} className="ml-2" />
              <div className="flex gap-1">
                <button className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">Save</button>
                <button formAction={deleteRateAction} className="rounded-md border border-border px-2 py-1 text-xs text-red-500 hover:bg-muted">Del</button>
              </div>
            </form>
          ))}
          <form action={createRateAction} className="grid items-center gap-1 border-t border-border bg-primary/[0.03] px-3 py-1.5 text-sm" style={{ gridTemplateColumns: COLS }}>
            <input name="role" placeholder="New role" className="rounded-md border border-border bg-card px-1.5 py-1 text-xs" />
            <input name="monthlyHours" placeholder="160" className="rounded-md border border-border bg-card px-1.5 py-1 text-xs" />
            <input name="ratePerHour" placeholder="Rate" className="rounded-md border border-border bg-card px-1.5 py-1 text-xs" />
            <span />
            <input name="effectiveMonthly" placeholder="auto" className="rounded-md border border-border bg-card px-1.5 py-1 text-xs" />
            <input type="checkbox" name="active" defaultChecked className="ml-2" />
            <button className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-white hover:brightness-110">+ Add</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Cell({ name, defaultValue, placeholder }: { name: string; defaultValue?: string; placeholder?: string }) {
  return <input name={name} defaultValue={defaultValue} placeholder={placeholder} className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm transition hover:border-border focus:border-primary focus:bg-card focus:outline-none" />;
}
