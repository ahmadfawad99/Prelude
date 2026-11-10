import type { AiProvider, GenerateSummaryResult, GenerateWbsResult, GenerateReleaseSummariesResult, ReleaseInput, ProjectOverviewContext, GenerateOverviewResult, DiagramContext, GenerateDiagramResult, ChatTurn, ChatContext, ChatResult } from "../schema";
import { SUMMARY_PROMPT_VERSION, WBS_PROMPT_VERSION, RELEASE_SUMMARY_PROMPT_VERSION, OVERVIEW_PROMPT_VERSION, matchChatIntent } from "../prompt";

/**
 * Deterministic, offline provider used when no API key is configured.
 * Produces plausible structured output so the whole flow works without
 * external calls.
 */
export const mockProvider: AiProvider = {
  name: "mock",

  async generateSummary(transcript: string): Promise<GenerateSummaryResult> {
    const first = transcript.split(/\n+/).map((l) => l.trim()).filter(Boolean).slice(0, 2).join(" ");
    const document = `# Discovery Brief (mock)

**Client:** — · **Priority:** Medium

## Executive Summary
${first.slice(0, 300) || "Configure an AI provider key for real generation."}

## Pain Points
- Manual, time-consuming current process
- Lack of visibility across teams

## Client's Objective
- A single system to manage the workflow with clear estimates and timelines

## Action Items / Next Steps
- Prepare a WBS from the requirements
- Schedule a follow-up call

_This is mock output. Set an AI provider key to generate a real brief._`;
    return { provider: "mock", model: "mock-1", promptVer: SUMMARY_PROMPT_VERSION, document };
  },

  async generateWbs(): Promise<GenerateWbsResult> {
    const mk = (
      module: string,
      epic: string,
      feature: string,
      complexity: "LOW" | "LOW_MEDIUM" | "MEDIUM",
      hours: number,
      priority: "LOW" | "MEDIUM" | "HIGH",
      release: string,
      sprint: string,
    ) => ({ module, epic, feature, description: `[mock] ${feature}`, sprint, complexity, hours, priority, release });

    return {
      provider: "mock",
      model: "mock-1",
      promptVer: WBS_PROMPT_VERSION,
      output: {
        items: [
          mk("Foundation", "Project Setup", "Architecture & scaffolding", "LOW", 16, "HIGH", "Release 1", "Sprint 1"),
          mk("Backend API", "Auth", "Authentication & RBAC", "LOW_MEDIUM", 24, "HIGH", "Release 1", "Sprint 1"),
          mk("Backend API", "Core", "Primary domain APIs", "MEDIUM", 40, "HIGH", "Release 1", "Sprint 2"),
          mk("Web Frontend", "Core", "Main user flows", "MEDIUM", 40, "MEDIUM", "Release 1", "Sprint 2"),
          mk("Admin Dashboard", "Admin", "Admin management screens", "LOW_MEDIUM", 24, "MEDIUM", "Release 2", "Sprint 3"),
          mk("Testing & QA", "Quality", "End-to-end testing & regression", "MEDIUM", 24, "HIGH", "Release 2", "Sprint 3"),
          mk("Feedback & Buffer", "Buffer", "Feedback and outstanding issues", "LOW_MEDIUM", 16, "MEDIUM", "Release 2", "Sprint 3"),
        ],
      },
    };
  },

  async generateReleaseSummaries(releases: ReleaseInput[]): Promise<GenerateReleaseSummariesResult> {
    return {
      provider: "mock",
      model: "mock-1",
      promptVer: RELEASE_SUMMARY_PROMPT_VERSION,
      summaries: releases.map((r) => ({
        release: r.release,
        summary: `Delivers: ${r.features.slice(0, 8).join("; ")}.`,
      })),
    };
  },

  async generateProjectOverview(ctx: ProjectOverviewContext): Promise<GenerateOverviewResult> {
    const document = `# ${ctx.title} — Project Overview

## Executive Summary
(mock) A proposed project delivering the capabilities below.

## Main Epics & Features
${[...new Set(ctx.epics)].map((e) => `- ${e}`).join("\n")}

## Estimates
${ctx.totalStoryPoints} story points · ${ctx.totalHours} hours.

## Team
${ctx.team.map((t) => `- ${t.role}: ${t.avgFte.toFixed(2)} FTE`).join("\n")}

## Costing
Estimated $${Math.round(ctx.totalCost).toLocaleString()}${ctx.budget ? ` (client budget: ${ctx.budget})` : ""}.

## Timeline
${ctx.sprintCount} × 2-week sprints${ctx.timeline ? ` (client timeline: ${ctx.timeline})` : ""}.

_Mock output — set an AI key for a real overview._`;
    return { document, provider: "mock", model: "mock-1", promptVer: OVERVIEW_PROMPT_VERSION };
  },

  async generateDiagram(_ctx: DiagramContext): Promise<GenerateDiagramResult> {
    const code = [
      "flowchart TD",
      "  A[Client sources] --> B[Analysis brief]",
      "  B --> C[Work Breakdown]",
      "  C --> D[Project Plan]",
      "  D --> E[Costed estimate]",
      "  E --> F[Proposal]",
    ].join("\n");
    return { code, title: "Flow diagram (mock)", provider: "mock", model: "mock-1" };
  },

  async chat(history: ChatTurn[], ctx: ChatContext): Promise<ChatResult> {
    const last = [...history].reverse().find((t) => t.role === "user")?.content ?? "";
    const action = matchChatIntent(last, ctx.capabilities) ?? undefined;
    if (action) {
      return { content: "", tool: { name: action, args: {} }, provider: "mock", model: "mock-1" };
    }
    const hint = ctx.sources.trim()
      ? "I can answer from the sources, or run a task — try “generate the WBS”, “regenerate the analysis”, or “build the project plan”."
      : "Add a source first, then I can analyze it. (Mock mode — set an AI provider key for grounded answers.)";
    return { content: `_(mock)_ ${hint}`, provider: "mock", model: "mock-1" };
  },
};
