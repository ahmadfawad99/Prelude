import type { WbsItem } from "@prisma/client";
import { getWbs } from "@/modules/wbs/service";
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
const COLS = "150px 170px 1fr 84px 54px 54px 104px 104px 96px";

export function WbsPanel({
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
        <p className="text-sm text-muted-foreground">
          Paste the RFP / requirement text — the AI will build a hierarchical WBS. (Pre-filled from the brief when available.)
        </p>
        <form action={generateWbsAction} className="mt-3 space-y-2">
          <input type="hidden" name="inquiryId" value={inquiryId} />
          <textarea name="requirements" required rows={8} defaultValue={defaultRequirements}
            placeholder="Paste requirements / RFP text…" className="input-base" />
          <button className="btn-primary">Generate WBS</button>
        </form>
      </div>
    );
  }

  const items = wbs.items;
  const totalSP = items.reduce((a, b) => a + (b.storyPoints ?? 0), 0);
  const totalHrs = items.reduce((a, b) => a + (b.hours ?? 0), 0);

  const out: ({ type: "module"; module: string } | { type: "item"; item: WbsItem })[] = [];
  let lastModule: string | null = null;
  for (const it of items) {
    const mod = it.module ?? "General";
    if (mod !== lastModule) { out.push({ type: "module", module: mod }); lastModule = mod; }
    out.push({ type: "item", item: it });
  }

  return (
    <div>
      {/* Approval bar — one-click */}
      <div className="card mb-3 flex flex-wrap items-center gap-3 px-4 py-3">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${APPROVAL_STYLES[wbs.status]}`}>{wbs.status.replace("_", " ")}</span>
        <span className="text-sm text-muted-foreground">{items.length} items · {totalSP} pts · {totalHrs} hrs · v{wbs.version}</span>
        <div className="ml-auto flex items-center gap-2">
          {wbs.status !== "APPROVED" ? (
            <form action={approveWbsAction}>
              <input type="hidden" name="inquiryId" value={inquiryId} />
              <button className="btn-primary">✓ Approve WBS</button>
            </form>
          ) : (
            <>
              <span className="text-sm font-medium text-emerald-700">✓ Approved — Project Plan unlocked</span>
              <form action={rejectWbsAction}>
                <input type="hidden" name="inquiryId" value={inquiryId} />
                <button className="btn-secondary !py-1.5 text-xs">Reopen</button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="scrollbar-thin card overflow-x-auto">
        <div className="min-w-[1080px]">
          <div className="grid gap-1 border-b border-border bg-muted/50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" style={{ gridTemplateColumns: COLS }}>
            <span>Epic</span><span>Feature</span><span>Description</span><span>Sprint</span><span>SP</span><span>Hrs</span><span>Priority</span><span>Release</span><span>Actions</span>
          </div>
          {out.map((row, idx) =>
            row.type === "module" ? (
              <div key={`m-${idx}`} className="border-t border-border bg-primary/[0.04] px-3 py-1.5 text-xs font-semibold text-primary">{row.module}</div>
            ) : (
              <ItemRow key={row.item.id} inquiryId={inquiryId} item={row.item} />
            ),
          )}
        </div>
      </div>

      {/* Add item */}
      <form action={addWbsItemAction} className="card mt-3 flex flex-wrap items-end gap-2 border-dashed p-3">
        <input type="hidden" name="inquiryId" value={inquiryId} />
        <input type="hidden" name="wbsId" value={wbs.id} />
        <AddField name="module" label="Module" w="w-32" />
        <AddField name="epic" label="Epic" w="w-32" />
        <AddField name="feature" label="Feature" w="w-40" />
        <AddField name="description" label="Description" w="w-56" />
        <AddField name="sprint" label="Sprint" w="w-20" />
        <AddField name="storyPoints" label="SP" w="w-14" />
        <AddField name="hours" label="Hrs" w="w-14" />
        <div>
          <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Priority</span>
          <select name="priority" className="rounded-md border border-border bg-card px-2 py-1 text-xs">
            <option value="">—</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
          </select>
        </div>
        <AddField name="release" label="Release" w="w-24" />
        <button className="btn-primary !py-1.5">+ Add item</button>
      </form>

      <details className="mt-3 max-w-3xl text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Regenerate from requirements (new version)</summary>
        <form action={generateWbsAction} className="mt-2 space-y-2">
          <input type="hidden" name="inquiryId" value={inquiryId} />
          <textarea name="requirements" required rows={8} defaultValue={defaultRequirements} className="input-base" />
          <button className="btn-secondary">Regenerate WBS</button>
        </form>
      </details>
    </div>
  );
}

function ItemRow({ inquiryId, item }: { inquiryId: string; item: WbsItem }) {
  return (
    <form action={updateWbsItemAction} className="grid items-center gap-1 border-t border-border px-3 py-1 text-sm transition hover:bg-muted/30" style={{ gridTemplateColumns: COLS }}>
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <input type="hidden" name="itemId" value={item.id} />
      <input type="hidden" name="module" value={item.module ?? ""} />
      <Cell name="epic" defaultValue={item.epic ?? ""} />
      <Cell name="feature" defaultValue={item.feature ?? ""} />
      <Cell name="description" defaultValue={item.description ?? ""} />
      <Cell name="sprint" defaultValue={item.sprint ?? ""} />
      <Cell name="storyPoints" defaultValue={item.storyPoints?.toString() ?? ""} />
      <Cell name="hours" defaultValue={item.hours?.toString() ?? ""} />
      <PrioritySelect value={item.priority ?? ""} />
      <Cell name="release" defaultValue={item.release ?? ""} />
      <div className="flex gap-1">
        <button className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">Save</button>
        <button formAction={deleteWbsItemAction} className="rounded-md border border-border px-2 py-1 text-xs text-red-500 hover:bg-muted">Del</button>
      </div>
    </form>
  );
}
function Cell({ name, defaultValue, placeholder }: { name: string; defaultValue?: string; placeholder?: string }) {
  return <input name={name} defaultValue={defaultValue} placeholder={placeholder} className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm transition hover:border-border focus:border-primary focus:bg-card focus:outline-none" />;
}
function AddField({ name, label, w }: { name: string; label: string; w: string }) {
  return (
    <div>
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      <input name={name} className={`${w} rounded-md border border-border bg-card px-2 py-1 text-xs`} />
    </div>
  );
}
function PrioritySelect({ value }: { value?: string }) {
  return (
    <select name="priority" defaultValue={value ?? ""} className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-sm transition hover:border-border focus:border-primary focus:bg-card focus:outline-none">
      <option value="">—</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
    </select>
  );
}
