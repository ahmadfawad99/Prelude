import OpenAI from "openai";
import type { AiProvider, GenerateSummaryResult, GenerateWbsResult, GenerateReleaseSummariesResult, ReleaseInput, ProjectOverviewContext, GenerateOverviewResult, DiagramContext, GenerateDiagramResult, ChatTurn, ChatContext, ChatResult, ChatAction } from "../schema";
import { chatToolsFor, safeJson } from "./chat-tools";
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

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

async function complete(system: string, user: string, json: boolean) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: MODEL,
    ...(json ? { response_format: { type: "json_object" as const } } : {}),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return {
    text: response.choices[0]?.message?.content ?? "",
    model: response.model ?? MODEL,
    tokensCost: {
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
    },
  };
}

export const openaiProvider: AiProvider = {
  name: "openai",

  async generateSummary(transcript: string): Promise<GenerateSummaryResult> {
    const { text, model, tokensCost } = await complete(
      SUMMARY_SYSTEM_PROMPT,
      buildSummaryUserPrompt(transcript),
      false,
    );
    return {
      provider: "openai",
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
      true,
    );
    return {
      provider: "openai",
      model,
      promptVer: WBS_PROMPT_VERSION,
      output: wbsOutputSchema.parse(parseJsonLoose(text)),
      tokensCost,
    };
  },

  async generateReleaseSummaries(releases: ReleaseInput[]): Promise<GenerateReleaseSummariesResult> {
    const { text, model } = await complete(RELEASE_SUMMARY_SYSTEM_PROMPT, buildReleaseSummaryPrompt(releases), true);
    const parsed = releaseSummariesSchema.parse(parseJsonLoose(text));
    return { summaries: parsed.summaries, provider: "openai", model, promptVer: RELEASE_SUMMARY_PROMPT_VERSION };
  },

  async generateProjectOverview(ctx: ProjectOverviewContext): Promise<GenerateOverviewResult> {
    const { text, model } = await complete(OVERVIEW_SYSTEM_PROMPT, buildOverviewPrompt(ctx), false);
    return { document: text.trim(), provider: "openai", model, promptVer: OVERVIEW_PROMPT_VERSION };
  },

  async generateDiagram(ctx: DiagramContext): Promise<GenerateDiagramResult> {
    const { text, model } = await complete(DIAGRAM_SYSTEM_PROMPT, buildDiagramPrompt(ctx), false);
    return { code: cleanMermaid(text), title: "Flow diagram", provider: "openai", model };
  },

  async chat(history: ChatTurn[], ctx: ChatContext): Promise<ChatResult> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { allowed, specs } = chatToolsFor(ctx);
    const tools = specs.map((t) => ({
      type: "function" as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    const response = await client.chat.completions.create({
      model: MODEL,
      ...(tools.length ? { tools, tool_choice: "auto" as const } : {}),
      messages: [
        { role: "system", content: CHAT_SYSTEM_PROMPT },
        { role: "system", content: `CONTEXT\n\n${buildChatContextBlock(ctx)}` },
        ...history.map((t) => ({ role: t.role, content: t.content })),
      ],
    });

    const msg = response.choices[0]?.message;
    const call = msg?.tool_calls?.find((c) => c.type === "function");
    const name = call?.function?.name as ChatAction | undefined;
    return {
      content: msg?.content?.trim() ?? "",
      tool: name && allowed.has(name) ? { name, args: safeJson(call?.function?.arguments) } : undefined,
      provider: "openai",
      model: response.model ?? MODEL,
    };
  },
};
