import type { WbsItem, Complexity } from "@prisma/client";
import { getWbs } from "@/modules/wbs/service";
import { COMPLEXITY_SP, COMPLEXITY_ENGINEERS, COMPLEXITY_LABEL, averageComplexity } from "@/modules/wbs/complexity";
import { SubmitButton } from "@/components/submit-button";
import {
  generateWbsAction,
  updateWbsItemAction,
  addWbsItemAction,
  deleteWbsItemAction,
  approveWbsAction,
  rejectWbsAction,
} from "./actions";

const APPROVAL_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  IN_REVIEW: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};
const di = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export function WbsWorkbookTab({
  inquiryId,
  wbs,
  defaultRequirements,
}: {
  inquiryId: string;
  wbs: Awaited<ReturnType<typeof getWbs>>;
  defaultRequirements: string;
}) {
  if (!wbs) {
    return (
      <div className="card max-w-3xl p-5">
        <p className="text-sm text-muted-foreground"><strong>Upload the RFP / requirement document</strong> (PDF, Word, txt) or paste the text — the AI builds a hierarchical WBS from it. Pre-filled from the brief when available.</p>
        <form action={generateWbsAction} className="mt-3 space-y-3">
          <input type="hidden" name="inquiryId" value={inquiryId} />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Upload RFP:</span>
            <input type="file" name="file" accept=".txt,.pdf,.docx,.doc,.md,.csv" className="text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs" />
          </label>
          <textarea name="requirements" rows={8} defaultValue={defaultRequirements} placeholder="…or paste requirements / RFP text here" className="input-base" />
          <SubmitButton pendingText="Generating WBS… (~10s)">Generate WBS</SubmitButton>
        </form>
      </div>
    );
  }

  const items = wbs.items;
  const totalSP = items.reduce((a, b) => a + (b.storyPoints ?? 0), 0);
  const totalHrs = items.reduce((a, b) => a + (b.hours ?? 0), 0);
  const cxCount = (c: Complexity) => items.filter((i) => i.complexity === c).length;
  // Engineers are allocated per EPIC (from the epic's average complexity), not per
  // feature. Total = sum of each epic's engineer allocation.
  const epicEng = engineersByEpic(items);
  const totalEng = [...epicEng.values()].reduce((a, b) => a + b, 0);

  return (
    <div>
      {/* Approval bar */}
      <div className="card mb-3 flex flex-wrap items-center gap-3 px-4 py-3">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${APPROVAL_STYLES[wbs.status]}`}>{wbs.status.replace("_", " ")}</span>
        <span className="text-sm text-muted-foreground">{items.length} items · {totalSP} pts · {totalHrs} hrs · v{wbs.version}</span>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">Low {cxCount("LOW")}</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">Low–Med {cxCount("LOW_MEDIUM")}</span>
          <span className="rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-700">Med {cxCount("MEDIUM")}</span>
          <span className="text-muted-foreground">· {totalEng} engineers</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {wbs.status !== "APPROVED" ? (
            <form action={approveWbsAction}><input type="hidden" name="inquiryId" value={inquiryId} /><SubmitButton pendingText="Approving…">✓ Approve WBS</SubmitButton></form>
          ) : (
            <>
              <span className="text-sm font-medium text-emerald-700">✓ Approved — Release Plan unlocked</span>
              <form action={rejectWbsAction}><input type="hidden" name="inquiryId" value={inquiryId} /><button className="btn-secondary !py-1.5 text-xs">Reopen</button></form>
            </>
          )}
        </div>
      </div>

      <EpicOverview items={items} />

      <WbsGrid inquiryId={inquiryId} wbsId={wbs.id} items={items} showModule />

      <details className="mt-3 max-w-3xl text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Regenerate from requirements</summary>
        <form action={generateWbsAction} className="mt-2 space-y-2">
          <input type="hidden" name="inquiryId" value={inquiryId} />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Upload RFP:</span>
            <input type="file" name="file" accept=".txt,.pdf,.docx,.doc,.md,.csv" className="text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs" />
          </label>
          <textarea name="requirements" rows={8} defaultValue={defaultRequirements} className="input-base" />
          <SubmitButton className="btn-secondary" pendingText="Regenerating WBS… (~10s)">Regenerate WBS</SubmitButton>
        </form>
      </details>
    </div>
  );
}

const CX_DOT: Record<Complexity, string> = {
  LOW: "bg-emerald-500",
  LOW_MEDIUM: "bg-amber-500",
  MEDIUM: "bg-rose-500",
};
const CX_BADGE_BG: Record<Complexity, string> = {
  LOW: "bg-emerald-100 text-emerald-700",
  LOW_MEDIUM: "bg-amber-100 text-amber-800",
  MEDIUM: "bg-rose-100 text-rose-700",
};

const epicKey = (it: WbsItem) => it.epic?.trim() || "—";

/** Engineers per epic: derived from the epic's AVERAGE complexity (1/1/2), since
 *  engineers are allocated at the epic level, not per feature. */
function engineersByEpic(items: WbsItem[]): Map<string, number> {
  const byEpic = new Map<string, WbsItem[]>();
  for (const it of items) {
    const k = epicKey(it);
    (byEpic.get(k) ?? byEpic.set(k, []).get(k)!).push(it);
  }
  const out = new Map<string, number>();
  for (const [k, g] of byEpic) {
    const cx = averageComplexity(g.map((i) => i.complexity));
    out.set(k, cx ? COMPLEXITY_ENGINEERS[cx] : 0);
  }
  return out;
}

/** A visual, grouped overview of the WBS: one highlighted block per epic with its
 *  complexity mix, story points and features. Read-only; the grid below edits. */
function EpicOverview({ items }: { items: WbsItem[] }) {
  const order: string[] = [];
  const groups = new Map<string, WbsItem[]>();
  for (const it of items) {
    const epic = it.epic?.trim() || "Untitled epic";
    if (!groups.has(epic)) {
      groups.set(epic, []);
      order.push(epic);
    }
    groups.get(epic)!.push(it);
  }
  if (order.length === 0) return null;
  const grandSp = items.reduce((a, b) => a + (b.storyPoints ?? 0), 0);

  return (
    <div className="mb-4">
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider grad-text">Epics</h3>
        <span className="text-[11px] text-muted-foreground">{order.length} epic{order.length === 1 ? "" : "s"} · grouped by complexity</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
          {grandSp} story points total
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {order.map((epic) => {
          const g = groups.get(epic)!;
          const totalSp = g.reduce((a, b) => a + (b.storyPoints ?? 0), 0);
          const withSp = g.filter((i) => i.storyPoints != null).length;
          const avgSp = withSp ? Math.round(totalSp / withSp) : 0;
          const epicCx = averageComplexity(g.map((i) => i.complexity));
          const eng = epicCx ? COMPLEXITY_ENGINEERS[epicCx] : 0; // engineers are per-epic
          const cx: Record<Complexity, number> = { LOW: 0, LOW_MEDIUM: 0, MEDIUM: 0 };
          for (const it of g) if (it.complexity) cx[it.complexity] += 1;
          const modules = [...new Set(g.map((i) => i.module).filter(Boolean))] as string[];
          return (
            <div key={epic} className="card card-lift overflow-hidden">
              <div className="flex items-start justify-between gap-2 border-b border-border bg-gradient-to-r from-primary/10 to-transparent px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold" title={epic}>{epic}</p>
                  {modules.length > 0 && <p className="truncate text-[10px] text-muted-foreground">{modules.join(" · ")}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {epicCx ? (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${CX_BADGE_BG[epicCx]}`} title="Average complexity of this epic's features">
                      {COMPLEXITY_LABEL[epicCx]}
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">—</span>
                  )}
                  <span className="text-[10px] text-muted-foreground" title="Average story points per feature · total">
                    avg {avgSp} SP · {totalSp} total
                  </span>
                </div>
              </div>
              {/* Complexity mix bar */}
              <div className="flex h-1.5 w-full">
                {cx.LOW > 0 && <span className="bg-emerald-500" style={{ flex: cx.LOW }} />}
                {cx.LOW_MEDIUM > 0 && <span className="bg-amber-500" style={{ flex: cx.LOW_MEDIUM }} />}
                {cx.MEDIUM > 0 && <span className="bg-rose-500" style={{ flex: cx.MEDIUM }} />}
                {cx.LOW + cx.LOW_MEDIUM + cx.MEDIUM === 0 && <span className="w-full bg-slate-200" />}
              </div>
              <div className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-1 text-[10px]">
                  {cx.LOW > 0 && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-700">Low {cx.LOW}</span>}
                  {cx.LOW_MEDIUM > 0 && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">Low–Med {cx.LOW_MEDIUM}</span>}
                  {cx.MEDIUM > 0 && <span className="rounded-full bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-700">Med {cx.MEDIUM}</span>}
                  <span className="ml-auto text-muted-foreground">{g.length} feat · {eng} eng</span>
                </div>
                <ul className="mt-2 space-y-1 border-t border-border/60 pt-2">
                  {g.slice(0, 5).map((f) => (
                    <li key={f.id} className="flex items-center gap-1.5 text-xs">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${f.complexity ? CX_DOT[f.complexity] : "bg-slate-300"}`} />
                      <span className="truncate" title={f.feature ?? ""}>{f.feature}</span>
                    </li>
                  ))}
                  {g.length > 5 && <li className="pl-3 text-[10px] text-muted-foreground">+{g.length - 5} more…</li>}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WbsGrid({
  inquiryId,
  wbsId,
  items,
  module,
  showModule,
}: {
  inquiryId: string;
  wbsId: string;
  items: WbsItem[];
  module?: string;
  showModule?: boolean;
}) {
  // Engineers are per-epic (from the epic's average complexity), so every feature
  // row in an epic shows that epic's engineer count.
  const epicEng = engineersByEpic(items);
  const COLS = showModule
    ? "120px 140px 150px 1fr 74px 128px 56px 46px 44px 112px 112px 88px 90px 86px"
    : "140px 160px 1fr 74px 128px 56px 46px 44px 112px 112px 88px 90px 86px";
  const minW = showModule ? 1410 : 1290;

  return (
    <div className="scrollbar-thin card overflow-x-auto">
      <div style={{ minWidth: minW }}>
        <div className="grid gap-1 border-b border-border bg-muted/50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" style={{ gridTemplateColumns: COLS }}>
          {showModule && <span>Module</span>}
          <span>Epic</span><span>Feature</span><span>Description</span><span>Sprint</span><span>Complexity</span><span>Pts</span><span>Eng</span><span>Hrs</span><span>Start</span><span>End</span><span>Priority</span><span>Release</span><span>Actions</span>
        </div>
        {items.map((item) => (
          <form key={item.id} action={updateWbsItemAction} className="grid items-center gap-1 border-t border-border px-3 py-1 text-sm transition hover:bg-muted/30" style={{ gridTemplateColumns: COLS }}>
            <input type="hidden" name="inquiryId" value={inquiryId} />
            <input type="hidden" name="itemId" value={item.id} />
            {showModule ? <Cell name="module" defaultValue={item.module ?? ""} /> : <input type="hidden" name="module" value={item.module ?? ""} />}
            <Cell name="epic" defaultValue={item.epic ?? ""} />
            <Cell name="feature" defaultValue={item.feature ?? ""} />
            <Cell name="description" defaultValue={item.description ?? ""} />
            <Cell name="sprint" defaultValue={item.sprint ?? ""} />
            <ComplexitySelect value={item.complexity ?? ""} />
            <PtsCell complexity={item.complexity} storyPoints={item.storyPoints} />
            <EpicEngCell eng={epicEng.get(epicKey(item)) ?? 0} />
            <Cell name="hours" defaultValue={item.hours?.toString() ?? ""} />
            <DateCell name="startDate" defaultValue={di(item.startDate)} />
            <DateCell name="endDate" defaultValue={di(item.endDate)} />
            <PrioritySelect value={item.priority ?? ""} />
            <Cell name="release" defaultValue={item.release ?? ""} />
            <div className="flex gap-1">
              <SubmitButton className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted" pendingText="Saving…">Save</SubmitButton>
              <button formAction={deleteWbsItemAction} className="rounded-md border border-border px-2 py-1 text-xs text-red-500 hover:bg-muted">Del</button>
            </div>
          </form>
        ))}
        {/* Add row */}
        <form action={addWbsItemAction} className="grid items-center gap-1 border-t border-border bg-primary/[0.03] px-3 py-1.5" style={{ gridTemplateColumns: COLS }}>
          <input type="hidden" name="inquiryId" value={inquiryId} />
          <input type="hidden" name="wbsId" value={wbsId} />
          {showModule ? <Cell name="module" placeholder="Module" /> : <input type="hidden" name="module" value={module ?? ""} />}
          <Cell name="epic" placeholder="Epic" />
          <Cell name="feature" placeholder="Feature" />
          <Cell name="description" placeholder="Description" />
          <Cell name="sprint" placeholder="Sprint" />
          <ComplexitySelect />
          <input name="storyPoints" type="number" min="0" step="1" placeholder="auto" className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-center text-xs transition hover:border-border focus:border-primary focus:bg-card focus:outline-none" />
          <span className="text-center text-[11px] text-muted-foreground">epic</span>
          <Cell name="hours" placeholder="Hrs" />
          <DateCell name="startDate" />
          <DateCell name="endDate" />
          <PrioritySelect />
          <Cell name="release" placeholder="Release" />
          <SubmitButton className="grad-fill rounded-md px-2 py-1 text-xs font-semibold shadow-sm hover:brightness-110" pendingText="Adding…">+ Add</SubmitButton>
        </form>
      </div>
    </div>
  );
}

const CX_BADGE: Record<Complexity, string> = {
  LOW: "text-emerald-700",
  LOW_MEDIUM: "text-amber-700",
  MEDIUM: "text-rose-700",
};
function ComplexitySelect({ value }: { value?: string }) {
  return (
    <select name="complexity" defaultValue={value ?? ""} className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-xs transition hover:border-border focus:border-primary focus:bg-card focus:outline-none">
      <option value="">—</option>
      <option value="LOW">{COMPLEXITY_LABEL.LOW}</option>
      <option value="LOW_MEDIUM">{COMPLEXITY_LABEL.LOW_MEDIUM}</option>
      <option value="MEDIUM">{COMPLEXITY_LABEL.MEDIUM}</option>
    </select>
  );
}
/** Editable story points. Defaults to the complexity's value, but you can type
 *  any number — it won't be overwritten on save. */
function PtsCell({ complexity, storyPoints }: { complexity: Complexity | null; storyPoints: number | null }) {
  const value = storyPoints ?? (complexity ? COMPLEXITY_SP[complexity] : null);
  return (
    <input
      name="storyPoints"
      type="number"
      min="0"
      step="1"
      defaultValue={value ?? ""}
      className={`w-full rounded border border-transparent bg-transparent px-1 py-1 text-center text-xs font-semibold transition hover:border-border focus:border-primary focus:bg-card focus:outline-none ${complexity ? CX_BADGE[complexity] : ""}`}
    />
  );
}
/** Engineer count for the feature's epic (same for every feature in that epic). */
function EpicEngCell({ eng }: { eng: number }) {
  return <span className="text-center text-xs font-medium text-muted-foreground" title="Engineers allocated to this epic">{eng || "—"}</span>;
}

function Cell({ name, defaultValue, placeholder }: { name: string; defaultValue?: string; placeholder?: string }) {
  return <input name={name} defaultValue={defaultValue} placeholder={placeholder} className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm transition hover:border-border focus:border-primary focus:bg-card focus:outline-none" />;
}
function DateCell({ name, defaultValue }: { name: string; defaultValue?: string }) {
  return <input type="date" name={name} defaultValue={defaultValue} className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-xs transition hover:border-border focus:border-primary focus:bg-card focus:outline-none" />;
}
function PrioritySelect({ value }: { value?: string }) {
  return (
    <select name="priority" defaultValue={value ?? ""} className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-sm transition hover:border-border focus:border-primary focus:bg-card focus:outline-none">
      <option value="">—</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
    </select>
  );
}
