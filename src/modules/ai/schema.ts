import { z } from "zod";

// ---- Call summary (rich markdown brief) ----

export interface GenerateSummaryResult {
  document: string; // rich markdown
  provider: string; // "anthropic" | "openai" | "mock"
  model: string;
  promptVer: string;
  tokensCost?: { inputTokens?: number; outputTokens?: number };
}

// ---- WBS ----

export const wbsItemSchema = z.object({
  module: z.string().optional().nullable(),
  epic: z.string(),
  feature: z.string(),
  description: z.string().optional().nullable(),
  sprint: z.string().optional().nullable(),
  // Feature complexity drives story points (3/5/13) and engineers (1/1/2).
  complexity: z.enum(["LOW", "LOW_MEDIUM", "MEDIUM"]).optional().nullable(),
  storyPoints: z.number().optional().nullable(),
  hours: z.number().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional().nullable(),
  release: z.string().optional().nullable(),
});

export const wbsOutputSchema = z.object({
  items: z.array(wbsItemSchema),
  budget: z.string().optional().nullable(), // budget stated in the RFP, if any
  timeline: z.string().optional().nullable(), // timeline stated in the RFP, if any
});

export type WbsItemOutput = z.infer<typeof wbsItemSchema>;
export type WbsOutput = z.infer<typeof wbsOutputSchema>;

export interface GenerateWbsResult {
  output: WbsOutput;
  provider: string;
  model: string;
  promptVer: string;
  tokensCost?: { inputTokens?: number; outputTokens?: number };
}

// ---- Release summaries ----

export const releaseSummariesSchema = z.object({
  summaries: z.array(z.object({ release: z.string(), summary: z.string() })),
});
export type ReleaseSummariesOutput = z.infer<typeof releaseSummariesSchema>;

export interface ReleaseInput {
  release: string;
  features: string[];
}
export interface GenerateReleaseSummariesResult {
  summaries: { release: string; summary: string }[];
  provider: string;
  model: string;
  promptVer: string;
}

// ---- Overall project overview ----

export interface ProjectOverviewContext {
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
}

export interface GenerateOverviewResult {
  document: string; // markdown
  provider: string;
  model: string;
  promptVer: string;
}

// ---- Diagram (Mermaid) ----

export interface DiagramContext {
  title: string;
  brief?: string | null;
  sources: string;
  wbsSummary?: string | null;
  instruction?: string | null; // what to draw / how to change it
  current?: string | null; // existing mermaid, when editing
}

export interface GenerateDiagramResult {
  code: string; // mermaid source
  title: string;
  provider: string;
  model: string;
}

// ---- Chat (grounded assistant with tools) ----

export type ChatAction =
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

export interface ChatToolCall {
  name: ChatAction;
  args: Record<string, unknown>;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatContext {
  title: string;
  client?: string | null;
  sources: string; // combined source text (truncated by caller)
  brief?: string | null;
  wbsSummary?: string | null; // text digest of the WBS + complexity totals
  planStatus?: string | null;
  planDigest?: string | null; // sprints, releases, dates, cost, team (when a plan exists)
  dates?: string | null; // current start/target dates + today, for the assistant
  leadMeta?: string | null; // title, status + legal moves, assignee, margin
  team?: string | null; // assignable people, for reassignment
  // What the assistant is allowed to trigger right now.
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
}

export interface ChatResult {
  content: string; // assistant text to display (may be empty when a tool is called)
  tool?: ChatToolCall; // a task the app should execute, with its arguments
  provider: string;
  model: string;
}

export interface AiProvider {
  readonly name: string;
  generateSummary(transcript: string): Promise<GenerateSummaryResult>;
  generateWbs(requirements: string): Promise<GenerateWbsResult>;
  generateReleaseSummaries(releases: ReleaseInput[]): Promise<GenerateReleaseSummariesResult>;
  generateProjectOverview(ctx: ProjectOverviewContext): Promise<GenerateOverviewResult>;
  generateDiagram(ctx: DiagramContext): Promise<GenerateDiagramResult>;
  chat(history: ChatTurn[], ctx: ChatContext): Promise<ChatResult>;
}
