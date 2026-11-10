import Anthropic from "@anthropic-ai/sdk";
import type { AiProvider, GenerateSummaryResult, GenerateWbsResult, GenerateReleaseSummariesResult, ReleaseInput, ProjectOverviewContext, GenerateOverviewResult, DiagramContext, GenerateDiagramResult, ChatTurn, ChatContext, ChatResult, ChatAction } from "../schema";
import { wbsOutputSchema, releaseSummariesSchema } from "../schema";
import {
  SUMMARY_SYSTEM_PROMPT,
  SUMMARY_PROMPT_VERSION,
  buildSummaryUserPrompt,
  WBS_SYSTEM_PROMPT,
  WBS_PROMPT_VERSION,
  buildWbsUserPrompt,
  RELEASE_SUMMARY_SYSTEM_PROMPT,
  RELEASE_SUMMARY_PROMPT_VERSION,
  buildReleaseSummaryPrompt,
  OVERVIEW_SYSTEM_PROMPT,
  OVERVIEW_PROMPT_VERSION,
  buildOverviewPrompt,
  DIAGRAM_SYSTEM_PROMPT,
  buildDiagramPrompt,
  cleanMermaid,
  CHAT_SYSTEM_PROMPT,
  buildChatContextBlock,
  parseJsonLoose,
} from "../prompt";
import { chatToolsFor, safeJson } from "./chat-tools";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

async function complete(system: string, user: string, maxTokens: number) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    output_config: { effort: "low" },
    messages: [{ role: "user", content: user }],
  });
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return {
    text,
    model: response.model ?? MODEL,
    tokensCost: {
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    },
  };
}

export const anthropicProvider: AiProvider = {
  name: "anthropic",

  async generateSummary(transcript: string): Promise<GenerateSummaryResult> {
    const { text, model, tokensCost } = await complete(
      SUMMARY_SYSTEM_PROMPT,
      buildSummaryUserPrompt(transcript),
      16000,
    );
    return {
      provider: "anthropic",
      model,
      promptVer: SUMMARY_PROMPT_VERSION,
      document: text.trim(),
      tokensCost,
    };
  },

  async generateWbs(requirements: string): Promise<GenerateWbsResult> {
    const { text, model, tokensCost } = await complete(
      WBS_SYSTEM_PROMPT,
      buildWbsUserPrompt(requirements),
      16000,
    );
    return {
      provider: "anthropic",
      model,
      promptVer: WBS_PROMPT_VERSION,
      output: wbsOutputSchema.parse(parseJsonLoose(text)),
      tokensCost,
    };
  },

  async generateReleaseSummaries(releases: ReleaseInput[]): Promise<GenerateReleaseSummariesResult> {
    const { text, model } = await complete(RELEASE_SUMMARY_SYSTEM_PROMPT, buildReleaseSummaryPrompt(releases), 4000);
    const parsed = releaseSummariesSchema.parse(parseJsonLoose(text));
    return { summaries: parsed.summaries, provider: "anthropic", model, promptVer: RELEASE_SUMMARY_PROMPT_VERSION };
  },

  async generateProjectOverview(ctx: ProjectOverviewContext): Promise<GenerateOverviewResult> {
    const { text, model } = await complete(OVERVIEW_SYSTEM_PROMPT, buildOverviewPrompt(ctx), 8000);
    return { document: text.trim(), provider: "anthropic", model, promptVer: OVERVIEW_PROMPT_VERSION };
  },

  async generateDiagram(ctx: DiagramContext): Promise<GenerateDiagramResult> {
    const { text, model } = await complete(DIAGRAM_SYSTEM_PROMPT, buildDiagramPrompt(ctx), 4000);
    return { code: cleanMermaid(text), title: "Flow diagram", provider: "anthropic", model };
  },

  async chat(history: ChatTurn[], ctx: ChatContext): Promise<ChatResult> {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const { allowed, specs } = chatToolsFor(ctx);
    const tools = specs.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool.InputSchema,
    }));

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: `${CHAT_SYSTEM_PROMPT}\n\nCONTEXT\n\n${buildChatContextBlock(ctx)}`,
      ...(tools.length ? { tools } : {}),
      messages: history.map((t) => ({ role: t.role, content: t.content })),
    });

    const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const name = (toolUse?.name as ChatAction | undefined) ?? undefined;
    return {
      content: text,
      tool: name && allowed.has(name) ? { name, args: safeJson(toolUse?.input) } : undefined,
      provider: "anthropic",
      model: response.model ?? MODEL,
    };
  },
};
