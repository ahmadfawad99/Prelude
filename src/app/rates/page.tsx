export const dynamic = "force-dynamic";

import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/session";
import { listRates } from "@/modules/rates/service";
import { listTemplates } from "@/modules/templates/service";
import {
  createRateAction,
  updateRateAction,
  deleteRateAction,
  uploadTemplateAction,
  deleteTemplateAction,
} from "./actions";

const COLS = "1fr 110px 110px 130px 70px 120px";

export default async function RatesPage() {
  const user = await getCurrentUser();
  const isAdmin = user?.roles?.includes("ADMIN");

  if (!isAdmin) {
    return (
      <AppShell>
        <h1 className="text-2xl font-semibold">Resource Rates</h1>
        <p className="mt-4 text-sm text-muted-foreground">Admin access required.</p>
      </AppShell>
    );
  }

  const [rates, templates] = await Promise.all([listRates(), listTemplates()]);

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Resource Rates</h1>
      <p className="text-sm text-muted-foreground">
        The rate card that powers all Project Plan costs. Effective monthly auto-computes from hours × rate when left blank.
      </p>

      <div className="mt-5 overflow-x-auto rounded-xl border border-border bg-card">
        <div className="min-w-[680px]">
          <div
            className="grid gap-1 border-b border-border bg-muted/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            style={{ gridTemplateColumns: COLS }}
          >
            <span>Role</span><span>Monthly hrs</span><span>Rate/hr</span><span>Effective/mo</span><span>Active</span><span>Actions</span>
          </div>

          {rates.map((r) => (
            <form
              key={r.id}
              action={updateRateAction}
              className="grid items-center gap-1 border-t border-border px-3 py-1.5 text-sm"
              style={{ gridTemplateColumns: COLS }}
            >
              <input type="hidden" name="id" value={r.id} />
              <input name="role" defaultValue={r.role} className="rounded border border-transparent px-1.5 py-1 hover:border-border focus:border-primary focus:bg-card focus:outline-none" />
              <input name="monthlyHours" defaultValue={r.monthlyHours} className="rounded border border-transparent px-1.5 py-1 hover:border-border focus:border-primary focus:bg-card focus:outline-none" />
              <input name="ratePerHour" defaultValue={r.ratePerHour} className="rounded border border-transparent px-1.5 py-1 hover:border-border focus:border-primary focus:bg-card focus:outline-none" />
              <input name="effectiveMonthly" defaultValue={r.effectiveMonthly ?? ""} placeholder="auto" className="rounded border border-transparent px-1.5 py-1 hover:border-border focus:border-primary focus:bg-card focus:outline-none" />
              <input type="checkbox" name="active" defaultChecked={r.active} className="ml-2" />
              <div className="flex gap-1">
                <button className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">Save</button>
                <button formAction={deleteRateAction} className="rounded-md border border-border px-2 py-1 text-xs text-red-500 hover:bg-muted">Del</button>
              </div>
            </form>
          ))}

          {/* Add */}
          <form
            action={createRateAction}
            className="grid items-center gap-1 border-t border-border bg-emerald-50/40 px-3 py-1.5 text-sm"
            style={{ gridTemplateColumns: COLS }}
          >
            <input name="role" placeholder="New role" className="rounded border border-border px-1.5 py-1" />
            <input name="monthlyHours" placeholder="160" className="rounded border border-border px-1.5 py-1" />
            <input name="ratePerHour" placeholder="Rate" className="rounded border border-border px-1.5 py-1" />
            <input name="effectiveMonthly" placeholder="auto" className="rounded border border-border px-1.5 py-1" />
            <input type="checkbox" name="active" defaultChecked className="ml-2" />
            <button className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90">+ Add</button>
          </form>
        </div>
      </div>

      {/* Project Plan template */}
      <section className="mt-8 max-w-2xl rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Project Plan Template</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload an Excel template (.xlsx) to capture its sheet/column layout. The newest upload becomes active.
        </p>
        <form action={uploadTemplateAction} className="mt-3 flex items-center gap-2">
          <input type="file" name="file" accept=".xlsx" required className="text-sm file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs" />
          <button className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">Upload</button>
        </form>

        {templates.length > 0 && (
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
            {templates.map((t) => {
              const sheets = (t.layout as { sheets?: { name: string }[] } | null)?.sheets ?? [];
              return (
                <li key={t.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="flex-1 truncate font-medium">{t.name}</span>
                  {t.active && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">active</span>}
                  <span className="text-xs text-muted-foreground">{sheets.length} sheets</span>
                  <form action={deleteTemplateAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="text-xs text-red-500 hover:underline">Remove</button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
