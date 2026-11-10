import type { DerivedPlan } from "@/modules/plans/derive";
import { SubmitButton } from "@/components/submit-button";
import { updateSummaryDataAction } from "./actions";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

interface SummaryData {
  team: { role: string; responsibilities: string; avgAllocation: string }[];
  budget: { platform: string; budgetRange: string; timeDuration: string }[];
  deliverables: { platform: string; budgetRange: string }[];
  overallBudget: string;
  overallDuration: string;
  monthlyBurn: string;
}

function defaults(derived: DerivedPlan | null): SummaryData {
  if (!derived) return { team: [], budget: [], deliverables: [], overallBudget: "", overallDuration: "", monthlyBurn: "" };
  return {
    team: derived.team.map((t) => ({ role: t.role, responsibilities: "", avgAllocation: t.avgFte.toFixed(2) })),
    budget: derived.budgetByRelease.map((b) => ({ platform: b.releaseGroup, budgetRange: `${money(b.low)} - ${money(b.high)}`, timeDuration: "" })),
    deliverables: derived.budgetByRelease.map((b) => ({ platform: b.releaseGroup, budgetRange: money(b.cost) })),
    overallBudget: `${money(derived.totalCost * (1 - derived.marginPct))} - ${money(derived.totalCost * (1 + derived.marginPct))}`,
    overallDuration: "",
    monthlyBurn: money(derived.monthlyBurn),
  };
}

export function SummaryTab({
  inquiryId,
  summaryData,
  derived,
  rfpBudget,
  rfpTimeline,
}: {
  inquiryId: string;
  summaryData: unknown;
  derived: DerivedPlan | null;
  rfpBudget?: string | null;
  rfpTimeline?: string | null;
}) {
  const saved = summaryData as SummaryData | null;
  const sd = saved ?? defaults(derived);
  // When nothing is saved yet, prefer budget/timeline stated in the RFP.
  if (!saved) {
    if (rfpBudget) sd.overallBudget = rfpBudget;
    if (rfpTimeline) sd.overallDuration = rfpTimeline;
  }
  const team = sd.team ?? [];
  const budget = sd.budget ?? [];
  const deliverables = sd.deliverables ?? [];

  return (
    <form action={updateSummaryDataAction} className="space-y-6">
      <input type="hidden" name="inquiryId" value={inquiryId} />

      {/* Team Summary */}
      <Section title="Team Summary">
        <Grid cols="180px 1fr 120px" head={["Roles", "Responsibilities", "Avg Allocation"]}>
          {[...team, { role: "", responsibilities: "", avgAllocation: "" }].map((r, i) => (
            <Row key={`t${i}`} cols="180px 1fr 120px">
              <In name={`team_role_${i}`} v={r.role} />
              <In name={`team_responsibilities_${i}`} v={r.responsibilities} />
              <In name={`team_avgAllocation_${i}`} v={r.avgAllocation} />
            </Row>
          ))}
        </Grid>
      </Section>

      {/* Summary of Budget */}
      <Section title="Summary of Budget">
        <Grid cols="200px 1fr 160px" head={["Platform", "Budget Range", "Time Duration"]}>
          {[...budget, { platform: "", budgetRange: "", timeDuration: "" }].map((r, i) => (
            <Row key={`b${i}`} cols="200px 1fr 160px">
              <In name={`budget_platform_${i}`} v={r.platform} />
              <In name={`budget_budgetRange_${i}`} v={r.budgetRange} />
              <In name={`budget_timeDuration_${i}`} v={r.timeDuration} />
            </Row>
          ))}
        </Grid>
        <div className="mt-3 grid max-w-xl gap-2 sm:grid-cols-2">
          <Field label="Overall Project Budget"><input name="overallBudget" defaultValue={sd.overallBudget} className="input-base !py-1.5 text-sm" /></Field>
          <Field label="Overall Duration"><input name="overallDuration" defaultValue={sd.overallDuration} className="input-base !py-1.5 text-sm" /></Field>
          <Field label="Monthly Burn Rate"><input name="monthlyBurn" defaultValue={sd.monthlyBurn} className="input-base !py-1.5 text-sm" /></Field>
        </div>
      </Section>

      {/* Summary of Budget by Deliverables */}
      <Section title="Summary of Budget by Deliverables">
        <Grid cols="1fr 200px" head={["Platform", "Budget Range"]}>
          {[...deliverables, { platform: "", budgetRange: "" }].map((r, i) => (
            <Row key={`d${i}`} cols="1fr 200px">
              <In name={`deliv_platform_${i}`} v={r.platform} />
              <In name={`deliv_budgetRange_${i}`} v={r.budgetRange} />
            </Row>
          ))}
        </Grid>
      </Section>

      <SubmitButton pendingText="Saving…">Save Summary</SubmitButton>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="card overflow-hidden">{children}</div>
    </section>
  );
}
function Grid({ cols, head, children }: { cols: string; head: string[]; children: React.ReactNode }) {
  return (
    <div>
      <div className="grid gap-1 border-b border-border bg-muted/50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" style={{ gridTemplateColumns: cols }}>
        {head.map((h) => <span key={h}>{h}</span>)}
      </div>
      {children}
    </div>
  );
}
function Row({ cols, children }: { cols: string; children: React.ReactNode }) {
  return <div className="grid items-center gap-1 border-t border-border px-3 py-1" style={{ gridTemplateColumns: cols }}>{children}</div>;
}
function In({ name, v }: { name: string; v: string }) {
  return <input name={name} defaultValue={v} className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm transition hover:border-border focus:border-primary focus:bg-card focus:outline-none" />;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>{children}</label>;
}
