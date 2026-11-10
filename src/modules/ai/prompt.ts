export const SUMMARY_PROMPT_VERSION = "summary-v2-md";

export const SUMMARY_SYSTEM_PROMPT = `You are a senior presales analyst at a software consultancy. You read a sales/discovery call transcript (or raw notes) and produce a professional, richly-structured brief the technical team will work from — the kind of comprehensive document a senior BA would write.

Output a **Markdown document** (headings, sub-headings, bullet lists, bold where useful). Do NOT wrap it in code fences. Be thorough and faithful — do not invent facts, but structure and expand what is there into a proper brief.

Adapt the structure to the content; a good default outline:

# <Short descriptive title>

**Client:** … · **Primary contact:** … · **Priority:** … · **Target deadline:** …

## Executive Summary
A few sentences framing the opportunity and what the client is asking for.

## Background & Context
How the conversation evolved and important framing.

## Client's Objective
What the client ultimately wants to achieve.

## Key Stakeholders
Bulleted list of people mentioned and their role.

## Requirements
Grouped requirements (use sub-headings per area/module when warranted).

## Pain Points
What's broken / frustrating today.

## Scope & Modules to Consider
Notable modules, systems, or workstreams implied.

## Action Items / Next Steps
Concrete next steps, with owners where stated.

## Assumptions & Open Questions
What still needs discovery.

## Risks
Anything that could derail scope, timeline, or expectations.

Omit sections with nothing to say. Keep it senior, clear, and business-readable.`;

export function buildSummaryUserPrompt(transcript: string): string {
  return `Call transcript / notes:\n\n${transcript}\n\nWrite the Markdown brief now.`;
}

export const WBS_PROMPT_VERSION = "wbs-v2-complexity";

export const WBS_SYSTEM_PROMPT = `You are a senior solutions architect. Given a client's requirements (RFP / requirement document / notes), produce a comprehensive, hierarchical Work Breakdown Structure (WBS) for a software project.

If the requirements explicitly state a project budget and/or timeline, extract them into "budget" and "timeline" (short strings, e.g. "$50,000 - $70,000", "4 months"); otherwise use null.

Return ONLY a JSON object (no markdown, no prose) with this shape:
{
  "budget": string | null,
  "timeline": string | null,
  "items": [
    {
      "module": string | null,      // platform/area, e.g. "Mobile App", "Admin Dashboard", "Backend API"
      "epic": string,               // high-level grouping, e.g. "User Management"
      "feature": string,            // concrete feature / work item
      "description": string | null,      // one sentence of scope
      "sprint": string | null,           // e.g. "Sprint 1"
      "complexity": "LOW" | "LOW_MEDIUM" | "MEDIUM", // engineering complexity of the feature
      "hours": number | null,            // rough effort in hours
      "priority": "LOW" | "MEDIUM" | "HIGH" | null,
      "release": string | null           // e.g. "Release 1"
    }
  ]
}

Complexity definition (assign one to EVERY feature):
- "LOW": small, well-understood work. → 3 story points, 1 full-stack engineer.
- "LOW_MEDIUM": moderate work with some unknowns. → 5 story points, 1 full-stack engineer.
- "MEDIUM": substantial/complex work (integrations, non-trivial logic). → 13 story points, up to 2 engineers.
Do NOT output storyPoints — they are derived from complexity. Just pick the right complexity.

Rules:
- Be comprehensive: cover setup/architecture, core features by module, integrations, testing/QA, and a feedback/buffer item.
- Group logically by module -> epic -> feature; order items so each module's items are together.
- Assign a realistic complexity to every feature, plus rough hours.
- Assign priorities and spread work across sprints/releases sensibly.
- Produce 15-40 items depending on scope. Do not invent requirements not implied by the input.`;

export function buildWbsUserPrompt(requirements: string): string {
  return `Client requirements:\n\n${requirements}\n\nProduce the JSON WBS now.`;
}

export const RELEASE_SUMMARY_PROMPT_VERSION = "relsum-v1";

export const RELEASE_SUMMARY_SYSTEM_PROMPT = `You are a presales lead. For each software release, write a concise, client-facing summary (2-3 sentences) describing the key features and deliverables that will be completed in that release, based on the feature list provided. Be specific and outcome-focused.

Return ONLY JSON (no markdown):
{ "summaries": [ { "release": string, "summary": string } ] }`;

export function buildReleaseSummaryPrompt(releases: { release: string; features: string[] }[]): string {
  const body = releases
    .map((r) => `${r.release}:\n${r.features.map((f) => `- ${f}`).join("\n")}`)
    .join("\n\n");
  return `Releases and the features planned in each:\n\n${body}\n\nWrite the JSON summaries now.`;
}

export const OVERVIEW_PROMPT_VERSION = "overview-v1";

export const OVERVIEW_SYSTEM_PROMPT = `You are a presales lead preparing a concise, client-facing executive overview of a proposed software project. Using the provided data, write a polished **Markdown** document (no code fences). Use exactly these sections:

# <Project title> — Project Overview

## Executive Summary
2-4 sentences on what the project is and the value it delivers.

## Main Epics & Features
Grouped bullets of the key epics and their notable features.

## Estimates
Total story points and effort (hours), and what that implies.

## Team
The proposed team and allocations.

## Costing
The estimated cost (and the stated budget if provided).

## Timeline
Number of 2-week sprints, release structure, and overall duration (use the stated timeline if provided).

Be specific and grounded in the data. Do not invent facts beyond what's given.`;

export function buildOverviewPrompt(ctx: {
  title: string;
  client?: string | null;
  brief?: string | null;
  epics: string[];
  features: string[];
  totalStoryPoints: number;
  totalHours: number;
  totalCost: number;
  budget?: string | null;
  timeline?: string | null;
  team: { role: string; avgFte: number }[];
  sprintCount: number;
  releases: { release: string; features: string[] }[];
}): string {
  const lines: string[] = [];
  lines.push(`Title: ${ctx.title}`);
  if (ctx.client) lines.push(`Client: ${ctx.client}`);
  lines.push(`Total story points: ${ctx.totalStoryPoints}`);
  lines.push(`Total effort (hours): ${ctx.totalHours}`);
  lines.push(`Estimated cost: $${Math.round(ctx.totalCost).toLocaleString()}`);
  if (ctx.budget) lines.push(`Client-stated budget: ${ctx.budget}`);
  if (ctx.timeline) lines.push(`Client-stated timeline: ${ctx.timeline}`);
  lines.push(`Sprints (2 weeks each): ${ctx.sprintCount}`);
  lines.push(`Team: ${ctx.team.map((t) => `${t.role} (${t.avgFte.toFixed(2)} FTE)`).join(", ")}`);
  lines.push(`Epics: ${[...new Set(ctx.epics)].join(", ")}`);
  lines.push(`\nReleases and features:`);
  for (const r of ctx.releases) lines.push(`${r.release}:\n${r.features.map((f) => `- ${f}`).join("\n")}`);
  if (ctx.brief) lines.push(`\nCall brief (context):\n${ctx.brief.slice(0, 3000)}`);
  return `${lines.join("\n")}\n\nWrite the Markdown overview now.`;
}

// ---- Diagram (Mermaid) ----

export const DIAGRAM_PROMPT_VERSION = "diagram-v1";

export const DIAGRAM_SYSTEM_PROMPT = `You are a senior solutions architect. Produce ONE Mermaid.js diagram that visualises the solution, process flow, or architecture for this project, grounded in the provided context.

Output ONLY valid Mermaid code — no markdown code fences, no commentary, no prose before or after.

Rules:
- Default to "flowchart TD" for process/architecture flows. Use "flowchart LR", "sequenceDiagram", or "mindmap" only when clearly better for the request.
- Keep it clear and readable: about 8–24 nodes, short labels. Group related nodes with subgraphs when useful.
- Node text must be plain and safe: avoid parentheses (), curly braces, semicolons, and unescaped quotes inside labels — use simple words/hyphens so Mermaid parses cleanly.
- Ground it in the context; do not invent major facts.
- If an existing diagram and an instruction are given, return the FULL updated diagram (not a diff).`;

export function buildDiagramPrompt(ctx: {
  title: string;
  brief?: string | null;
  sources: string;
  wbsSummary?: string | null;
  instruction?: string | null;
  current?: string | null;
}): string {
  const parts: string[] = [`Project: ${ctx.title}`];
  if (ctx.brief?.trim()) parts.push(`\nAnalysis brief:\n${ctx.brief.slice(0, 6000)}`);
  else if (ctx.sources?.trim()) parts.push(`\nSources:\n${ctx.sources.slice(0, 8000)}`);
  if (ctx.wbsSummary?.trim()) parts.push(`\nWork breakdown (for structure):\n${ctx.wbsSummary.slice(0, 4000)}`);
  if (ctx.current?.trim()) parts.push(`\nExisting diagram to modify:\n${ctx.current.slice(0, 4000)}`);
  parts.push(`\nRequest: ${ctx.instruction?.trim() || "Create a clear flow diagram of the proposed solution and its main components."}`);
  parts.push(`\nReturn the Mermaid code now.`);
  return parts.join("\n");
}

/** Strip code fences / stray prose and keep just the Mermaid source. */
export function cleanMermaid(raw: string): string {
  let s = raw.trim();
  // pull the first fenced block if present
  const fence = s.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  // drop any leading prose before a known diagram keyword
  const m = s.match(/(flowchart|graph|sequenceDiagram|mindmap|classDiagram|stateDiagram|erDiagram|journey|gantt)[\s\S]*/i);
  if (m) s = m[0].trim();
  return s;
}

// ---- Chat (grounded assistant with tools) ----

export const CHAT_PROMPT_VERSION = "chat-v2-balanced";

export const CHAT_SYSTEM_PROMPT = `You are an expert presales assistant embedded in a single lead's workspace at a software consultancy. You help the presales engineer understand the lead and move it forward. You are knowledgeable, proactive, and genuinely useful — you do not dodge questions.

Answering policy — be helpful, never a dead-end. Always give the user something useful; never reply with only "that's not in the sources." There are two kinds of question, handle each well:
1. General / advisory / analytical / drafting questions — answer FULLY from your own software-presales expertise. This includes: recommendations and opinions ("how should I phase this?", "what should I ask on the discovery call?", "is this scope realistic?"), rough estimates and benchmarks ("typical timeline/cost for an e-commerce rebuild?"), explanations, comparisons, and drafting (emails, proposals, question lists, risk lists). No source is required for these — use your knowledge and reason it out.
2. Specific factual claims about THIS lead (its stated budget, the client's exact requirements, who said what) — base these on the provided context. If the specific fact is not in the context, do not refuse and do not state a guess as if it were fact: give your best-effort estimate or assumption CLEARLY LABELLED (e.g. "The sources don't state a budget — as a rough assumption, a project this size is typically $X–$Y"), then offer a next step (add a source, or let me record that assumption). Reason, infer, and synthesise over the context — don't just quote it.

The one hard rule: never fabricate a lead-specific fact as though the client actually stated it. Everything else, answer. Keep answers concise and skimmable (short paragraphs or bullets), in Markdown.

The CONTEXT section always reflects the CURRENT state of the lead — its WBS status, plan status, dates, and which tasks are available right now. Trust it over anything claimed earlier in the chat history: if the context says the plan is NOT approved, it is not approved, even if an earlier message said otherwise. When asked to do something, decide from the context's current status, then act.

Questions vs. actions — this is critical. A QUESTION (anything asking for information, advice, analysis, an opinion, a recommendation, an estimate, an explanation, or a draft — e.g. "what should I ask the client?", "how many sprints?", "is the scope realistic?", "draft an email") is answered in PLAIN TEXT. NEVER call a tool to answer a question. Call a tool ONLY when the user explicitly instructs you to perform that exact action ("generate the WBS", "approve the plan", "set the start date to…", "add a feature…"). If you are unsure whether a message is a request to act, treat it as a question and answer it — do not call a tool.

Be a doer for genuine action requests. When the user clearly tells you to make a change, carry it out with the matching tool instead of describing it or explaining why you "can't" — if a tool fits the instruction, call it. Only fall back to plain text when there is genuinely no tool for the requested action.

CRITICAL: Never claim you performed an action unless you actually call its tool in this same message. Do NOT write confirmations like "✓ Approved…", "Done", "I've generated…" or "The lead is set for handoff" yourself — the app adds the real confirmation only after the tool runs. Earlier messages in this conversation may contain such ✓ confirmations; those were written by the app, not by you, so do not imitate them. If the user asks you to do something and a matching tool is available, you MUST call that tool — outputting prose that merely describes the result is a failure.

Tasks: when the user asks you to DO something that matches one of your tools, call the matching tool INSTEAD of writing the answer yourself:
- Generating artifacts: build/regenerate the WBS, build the project plan, or regenerate the analysis brief.
- Editing the WBS feature-by-feature: change a feature's complexity or other fields (update_wbs_item), add a new feature (add_wbs_item), or remove one (remove_wbs_item). The WBS digest lists each item with its id as [id:xxxx] — use that exact id. Complexity is LOW, LOW_MEDIUM, or MEDIUM and automatically sets story points (3/5/13) and engineers (1/1/2), so never set story points yourself.
- Scheduling: set the project's start date and/or target/due date (set_dates). Pass dates as ISO "YYYY-MM-DD". The context gives today's date — resolve relative phrasing ("next Monday", "in 2 weeks", "start of next month") to a concrete ISO date yourself. Setting the start date also re-dates the plan's sprints if a plan exists, so just do it when asked — never say dates aren't something you can set.
- Approvals / workflow: approve the WBS (approve_wbs) or reopen it (reopen_wbs); approve the project plan (approve_plan) or reopen it (reopen_plan). These are real workflow transitions — when the user tells you to approve/sign off/finalize or to reopen/revert, just run the matching tool. Approving the WBS unlocks plan generation; approvals are reversible with the matching reopen tool.
- Lead management: move the lead's pipeline status (move_status — only to a status listed as a legal move in the context); assign/reassign it to a team member or unassign it (reassign_lead — match a person from the team list); set the plan's margin % (set_margin); rename the lead (rename_lead); produce the Excel export link (export_excel). Run these when the user clearly instructs the change.
- Visuals: draw or update a flow diagram / infographic of the solution (generate_diagram). Use it whenever the user asks to visualise, diagram, draw, flowchart, or map something — pass their intent as the "instruction".
Only call a tool the context says is currently available; if the user asks for something not available yet (e.g. a plan before the WBS is approved, or editing the WBS before one exists), explain the single prerequisite step briefly instead of calling the tool. Do a plain-text answer for plain questions. Call ONE tool per message.`;

export interface ChatToolSpec {
  name:
    | "generate_wbs"
    | "generate_plan"
    | "regenerate_analysis"
    | "update_wbs_item"
    | "add_wbs_item"
    | "remove_wbs_item"
    | "set_dates"
    | "approve_wbs"
    | "reopen_wbs"
    | "approve_plan"
    | "reopen_plan"
    | "move_status"
    | "reassign_lead"
    | "set_margin"
    | "rename_lead"
    | "export_excel"
    | "generate_diagram";
  description: string;
  parameters: Record<string, unknown>; // JSON schema (object)
}

const NO_PARAMS = { type: "object", properties: {} as Record<string, unknown> };
const COMPLEXITY_PROP = { type: "string", enum: ["LOW", "LOW_MEDIUM", "MEDIUM"], description: "Feature complexity → sets story points 3/5/13 and engineers 1/1/2." };
const PRIORITY_PROP = { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] };

export const CHAT_TOOLS: ChatToolSpec[] = [
  { name: "generate_wbs", description: "Generate or regenerate the Work Breakdown Structure (WBS) from the lead's sources and brief. Use when the user asks to build/generate/create/regenerate the whole WBS or feature/complexity breakdown.", parameters: NO_PARAMS },
  { name: "generate_plan", description: "Generate the costed project/release plan from the approved WBS. Requires an approved WBS.", parameters: NO_PARAMS },
  { name: "regenerate_analysis", description: "Regenerate the analysis brief from the lead's sources.", parameters: NO_PARAMS },
  {
    name: "update_wbs_item",
    description: "Change one or more fields of a single existing WBS item (feature). Use the item's id from the WBS digest. Only include fields you want to change.",
    parameters: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "The id of the WBS item to update, from the [id:xxxx] tag in the digest." },
        complexity: COMPLEXITY_PROP,
        feature: { type: "string" },
        epic: { type: "string" },
        module: { type: "string" },
        description: { type: "string" },
        release: { type: "string" },
        sprint: { type: "string" },
        priority: PRIORITY_PROP,
      },
      required: ["itemId"],
    },
  },
  {
    name: "add_wbs_item",
    description: "Add a new feature/work item to the WBS.",
    parameters: {
      type: "object",
      properties: {
        epic: { type: "string", description: "High-level grouping, e.g. 'User Management'." },
        feature: { type: "string", description: "The concrete feature/work item." },
        module: { type: "string", description: "Platform/area, e.g. 'Mobile App'." },
        complexity: COMPLEXITY_PROP,
        description: { type: "string" },
        release: { type: "string" },
        sprint: { type: "string" },
        priority: PRIORITY_PROP,
      },
      required: ["epic", "feature"],
    },
  },
  {
    name: "remove_wbs_item",
    description: "Remove a single WBS item by its id.",
    parameters: {
      type: "object",
      properties: { itemId: { type: "string", description: "The id of the WBS item to remove, from the [id:xxxx] tag in the digest." } },
      required: ["itemId"],
    },
  },
  {
    name: "set_dates",
    description: "Set the project's start date and/or target (due) date for this lead. Setting the start date also re-dates the project plan's sprints when a plan exists. Resolve any relative dates to ISO 'YYYY-MM-DD' using today's date from the context. Provide at least one of the two.",
    parameters: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Project start date as ISO 'YYYY-MM-DD'. Omit to leave unchanged." },
        dueDate: { type: "string", description: "Target / due date as ISO 'YYYY-MM-DD'. Omit to leave unchanged." },
      },
    },
  },
  { name: "approve_wbs", description: "Approve the Work Breakdown Structure. This marks the WBS as APPROVED and unlocks project-plan generation. Use when the user says to approve/sign off/finalize the WBS.", parameters: NO_PARAMS },
  { name: "reopen_wbs", description: "Reopen (un-approve) the WBS so it can be edited or regenerated again. Use when the user says to reopen/unlock/revert the WBS approval.", parameters: NO_PARAMS },
  { name: "approve_plan", description: "Approve the project plan. Marks the plan APPROVED and moves the lead to handoff. Use when the user says to approve/sign off/finalize the project plan.", parameters: NO_PARAMS },
  { name: "reopen_plan", description: "Reopen (un-approve) the project plan so it can be edited again. Use when the user says to reopen/revert the plan approval.", parameters: NO_PARAMS },
  {
    name: "move_status",
    description: "Move the lead to a different pipeline status (e.g. mark it Won or Lost, send it to Review). Only the statuses listed as legal moves in the context are allowed. Use when the user says to mark/move/set the lead as a status.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", description: "The target status, e.g. 'WON', 'LOST', 'REVIEW', 'ARCHIVED' — must be one of the legal moves listed in the context." },
      },
      required: ["status"],
    },
  },
  {
    name: "reassign_lead",
    description: "Assign the lead to a team member, or unassign it. Use when the user says to assign/reassign the lead to someone (match a person from the team list in the context) or to assign it to themselves or unassign it.",
    parameters: {
      type: "object",
      properties: {
        assignee: { type: "string", description: "The assignee: a person's name or email from the team list, or 'me' for the current user, or 'none'/'unassign' to clear it." },
      },
      required: ["assignee"],
    },
  },
  {
    name: "set_margin",
    description: "Set the project plan's margin percentage (used for the budget range). Requires a plan. Use when the user says to set/change the margin.",
    parameters: {
      type: "object",
      properties: {
        marginPct: { type: "number", description: "Margin as a percentage, e.g. 15 for 15% (you may also pass 0.15)." },
      },
      required: ["marginPct"],
    },
  },
  {
    name: "rename_lead",
    description: "Rename this lead (change its title). Use when the user says to rename/retitle/call the lead something.",
    parameters: {
      type: "object",
      properties: { title: { type: "string", description: "The new lead title." } },
      required: ["title"],
    },
  },
  { name: "export_excel", description: "Produce the Excel export (WBS + Project Plan + Rates + Summary) and give the user the download link. Use when the user asks to export / download the plan or WBS to Excel.", parameters: NO_PARAMS },
  {
    name: "generate_diagram",
    description: "Create or update the lead's flow diagram / infographic (a visual of the solution, process, or architecture) from its sources and brief. Use when the user asks to draw/visualise/diagram/flowchart/map something, or to change the existing diagram.",
    parameters: {
      type: "object",
      properties: {
        instruction: { type: "string", description: "What to draw, or how to change the current diagram — e.g. 'show the data flow', 'add an authentication step', 'make it a mind map'." },
      },
    },
  },
];

export function buildChatContextBlock(ctx: {
  title: string;
  client?: string | null;
  sources: string;
  brief?: string | null;
  wbsSummary?: string | null;
  planStatus?: string | null;
  planDigest?: string | null;
  dates?: string | null;
  leadMeta?: string | null;
  team?: string | null;
  capabilities: {
    canGenerateWbs: boolean;
    canGeneratePlan: boolean;
    canRegenerateAnalysis: boolean;
    canEditWbs: boolean;
    canSetDates: boolean;
    canApproveWbs: boolean;
    canReopenWbs: boolean;
    canApprovePlan: boolean;
    canReopenPlan: boolean;
    canMoveStatus: boolean;
    canReassign: boolean;
    canSetMargin: boolean;
    canRename: boolean;
    canExport: boolean;
    canDiagram: boolean;
  };
}): string {
  const parts: string[] = [];
  parts.push(`# Lead: ${ctx.title}${ctx.client ? ` (client: ${ctx.client})` : ""}`);
  parts.push(`\n## Sources\n${ctx.sources?.trim() ? ctx.sources.slice(0, 24000) : "(no sources added yet)"}`);
  if (ctx.brief?.trim()) parts.push(`\n## Analysis brief\n${ctx.brief.slice(0, 8000)}`);
  if (ctx.wbsSummary?.trim()) parts.push(`\n## WBS digest (use the [id:xxxx] to edit an item)\n${ctx.wbsSummary.slice(0, 9000)}`);
  if (ctx.planStatus) parts.push(`\n## Project plan status\n${ctx.planStatus}`);
  if (ctx.planDigest?.trim()) parts.push(`\n## Project plan details\n${ctx.planDigest.slice(0, 6000)}`);
  if (ctx.dates?.trim()) parts.push(`\n## Schedule\n${ctx.dates}`);
  if (ctx.leadMeta?.trim()) parts.push(`\n## Lead details\n${ctx.leadMeta}`);
  if (ctx.team?.trim()) parts.push(`\n## Team (assignable)\n${ctx.team}`);
  const caps = Object.entries({
    "regenerate the analysis brief": ctx.capabilities.canRegenerateAnalysis,
    "generate/regenerate the whole WBS": ctx.capabilities.canGenerateWbs,
    "edit WBS items (update/add/remove a feature)": ctx.capabilities.canEditWbs,
    "generate the project plan": ctx.capabilities.canGeneratePlan,
    "set the project start / target dates": ctx.capabilities.canSetDates,
    "approve the WBS": ctx.capabilities.canApproveWbs,
    "reopen (un-approve) the WBS": ctx.capabilities.canReopenWbs,
    "approve the project plan": ctx.capabilities.canApprovePlan,
    "reopen (un-approve) the project plan": ctx.capabilities.canReopenPlan,
    "move the lead's pipeline status": ctx.capabilities.canMoveStatus,
    "assign / reassign the lead": ctx.capabilities.canReassign,
    "set the plan margin %": ctx.capabilities.canSetMargin,
    "rename the lead": ctx.capabilities.canRename,
    "export to Excel (download link)": ctx.capabilities.canExport,
    "draw / update the flow diagram": ctx.capabilities.canDiagram,
  })
    .map(([k, v]) => `- ${k}: ${v ? "AVAILABLE" : "not available yet"}`)
    .join("\n");
  parts.push(`\n## Tasks you can run right now\n${caps}`);
  return parts.join("\n");
}

/** Last-resort intent match used by the mock provider (no LLM, no params). */
export function matchChatIntent(
  message: string,
  caps: { canGenerateWbs: boolean; canGeneratePlan: boolean; canRegenerateAnalysis: boolean },
): "generate_wbs" | "generate_plan" | "regenerate_analysis" | null {
  const m = message.toLowerCase();
  const asksMake = /(generate|create|build|make|regenerate|redo|refresh)/.test(m);
  if (!asksMake) return null;
  if (caps.canGeneratePlan && /(project plan|release plan|\bplan\b)/.test(m)) return "generate_plan";
  if (caps.canGenerateWbs && /(wbs|work breakdown|breakdown|complexity|features?)/.test(m)) return "generate_wbs";
  if (caps.canRegenerateAnalysis && /(analysis|brief|summary)/.test(m)) return "regenerate_analysis";
  return null;
}

/** Tolerant JSON extraction: strips code fences and grabs the first {...} block. */
export function parseJsonLoose(raw: string): unknown {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    s = s.slice(start, end + 1);
  }
  return JSON.parse(s);
}
