import type { Complexity } from "@prisma/client";
import { getWbs } from "@/modules/wbs/service";
import { getPlan } from "@/modules/plans/service";
import { getDiagram } from "@/modules/diagrams/service";
import { getInquiry } from "@/modules/inquiries/service";
import { derivePlan, buildRateMap } from "@/modules/plans/derive";
import { listActiveRates } from "@/modules/rates/service";
import { COMPLEXITY_LABEL, COMPLEXITY_SP, COMPLEXITY_ENGINEERS, averageComplexity } from "@/modules/wbs/complexity";
import { fmtDate } from "./coerce";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

/** The analysis brief, rendered straight into the chat (it is already markdown). */
export function briefChatMarkdown(doc: string): string {
  const body = (doc ?? "").trim();
  if (!body) return "The analysis brief is empty.";
  // The stored brief usually starts with its own heading; add one only if not.
  const hasHeading = /^#{1,3}\s/.test(body);
  return `${hasHeading ? "" : "## Analysis brief\n\n"}${body}`;
}

type WbsLike = NonNullable<Awaited<ReturnType<typeof getWbs>>>;

/** The Work Breakdown as grouped epic blocks — reads naturally in the chat. */
export function wbsChatMarkdown(wbs: WbsLike): string {
  const items = wbs.items ?? [];
  const totalSP = items.reduce((a, b) => a + (b.storyPoints ?? 0), 0);

  // Group features under their epic, preserving first-seen order.
  const order: string[] = [];
  const groups = new Map<string, WbsLike["items"]>();
  for (const it of items) {
    const epic = it.epic?.trim() || "Untitled";
    if (!groups.has(epic)) {
      groups.set(epic, []);
      order.push(epic);
    }
    groups.get(epic)!.push(it);
  }

  const lines: string[] = [
    `## Work Breakdown`,
    ``,
    `**${items.length} features** across **${order.length} epics** · **${totalSP} story points** total.`,
    ``,
  ];

  for (const epic of order) {
    const feats = groups.get(epic)!;
    const epicSP = feats.reduce((a, b) => a + (b.storyPoints ?? 0), 0);
    const epicCx = averageComplexity(feats.map((f) => f.complexity as Complexity | null));
    const eng = epicCx ? COMPLEXITY_ENGINEERS[epicCx] : null;
    const meta = [
      `${epicSP} pts`,
      epicCx ? `${COMPLEXITY_LABEL[epicCx]} complexity` : null,
      eng ? `${eng} eng` : null,
    ].filter(Boolean).join(" · ");
    lines.push(`### ${epic}  \n*${meta}*`);
    for (const f of feats) {
      const cx = f.complexity as Complexity | null;
      const sp = f.storyPoints ?? (cx ? COMPLEXITY_SP[cx] : null);
      const tag = [cx ? COMPLEXITY_LABEL[cx] : null, sp != null ? `${sp} pts` : null].filter(Boolean).join(", ");
      lines.push(`- **${f.feature}**${tag ? ` — ${tag}` : ""}`);
    }
    lines.push("");
  }

  lines.push(`_Open **Work Breakdown** in the Studio panel to edit complexity, story points, or download the Excel._`);
  return lines.join("\n");
}

/** The costed release plan — timeline, cost range, team and releases. */
export async function planChatMarkdown(inquiryId: string): Promise<string> {
  const [plan, rates] = await Promise.all([getPlan(inquiryId), listActiveRates()]);
  if (!plan || plan.sprints.length === 0) return "There's no project plan yet — approve the WBS and I'll generate one.";

  const derived = derivePlan(plan.sprints, buildRateMap(rates), plan.marginPct);
  const starts = plan.sprints.map((s) => s.startDate).filter(Boolean) as Date[];
  const ends = plan.sprints.map((s) => s.endDate).filter(Boolean) as Date[];
  const first = starts.length ? new Date(Math.min(...starts.map((d) => d.getTime()))) : null;
  const last = ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null;
  const weeks = plan.sprints.length * 2;

  const lines: string[] = [
    `## Release Plan`,
    ``,
    `- **Duration:** ${plan.sprints.length} sprints (2 weeks each) ≈ ${weeks} weeks / ~${(weeks / 4.33).toFixed(1)} months`,
    first && last ? `- **Timeline:** ${fmtDate(first)} → ${fmtDate(last)}` : null,
    `- **Effort:** ${Math.round(derived.totalHours).toLocaleString()} hours`,
    `- **Cost:** ${money(derived.totalCost)} _(±${Math.round(derived.marginPct * 100)}% → ${money(derived.totalCost * (1 - derived.marginPct))}–${money(derived.totalCost * (1 + derived.marginPct))})_`,
  ].filter(Boolean) as string[];

  if (derived.budgetByRelease.length > 0) {
    lines.push(``, `| Release | Sprints | Cost |`, `|---|---|---|`);
    const sprintsByRel = new Map<string, number>();
    for (const s of plan.sprints) {
      const r = (s.releaseGroup ?? "Unassigned").trim() || "Unassigned";
      sprintsByRel.set(r, (sprintsByRel.get(r) ?? 0) + 1);
    }
    for (const b of derived.budgetByRelease) {
      lines.push(`| ${b.releaseGroup} | ${sprintsByRel.get(b.releaseGroup) ?? 0} | ${money(b.cost)} |`);
    }
  }

  if (derived.team.length > 0) {
    lines.push(``, `**Team (avg FTE):** ${derived.team.map((t) => `${t.role} ${t.avgFte.toFixed(2)}`).join(", ")}.`);
  }

  lines.push(``, `_Open **Release plan** in the Studio panel for the full sprint schedule and Excel export._`);
  return lines.join("\n");
}

/** A flow diagram, as a fenced mermaid block the chat renders inline. */
export function diagramChatMarkdown(code: string, version: number): string {
  return `Here's the **flow diagram** (v${version}):\n\n\`\`\`mermaid\n${code.trim()}\n\`\`\`\n\n_Open it from the **Studio** panel to download or ask me to change it._`;
}

/* ---- One-line plain-text summaries (for the compact chat "artifact card"
   that opens the full view in a popup — used for WBS / plan / diagram). ---- */

export function wbsChatSummary(wbs: WbsLike): string {
  const items = wbs.items ?? [];
  const totalSP = items.reduce((a, b) => a + (b.storyPoints ?? 0), 0);
  const epics = new Set(items.map((i) => i.epic?.trim() || "Untitled")).size;
  return `${items.length} features · ${epics} epics · ${totalSP} story points`;
}

export async function planChatSummary(inquiryId: string): Promise<string> {
  const [plan, rates] = await Promise.all([getPlan(inquiryId), listActiveRates()]);
  if (!plan || plan.sprints.length === 0) return "No project plan yet";
  const derived = derivePlan(plan.sprints, buildRateMap(rates), plan.marginPct);
  const weeks = plan.sprints.length * 2;
  return `${plan.sprints.length} sprints ≈ ${weeks} weeks · ${money(derived.totalCost)} (±${Math.round(derived.marginPct * 100)}%)`;
}

export function diagramChatSummary(version: number): string {
  return `Version ${version} · click to open`;
}

// ---- Convenience loaders (used by the Studio generate actions) ----

export async function briefChatFor(inquiryId: string): Promise<string | null> {
  const inq = await getInquiry(inquiryId);
  const doc = inq?.summary?.document?.trim();
  return doc ? briefChatMarkdown(doc) : null;
}

export async function wbsChatFor(inquiryId: string): Promise<string | null> {
  const wbs = await getWbs(inquiryId);
  return wbs ? wbsChatMarkdown(wbs) : null;
}

export async function diagramChatFor(inquiryId: string): Promise<string | null> {
  const d = await getDiagram(inquiryId);
  return d ? diagramChatMarkdown(d.code, d.version) : null;
}
