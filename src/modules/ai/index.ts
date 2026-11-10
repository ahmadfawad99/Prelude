import type { AiProvider } from "./schema";
import { mockProvider } from "./providers/mock";
import { anthropicProvider } from "./providers/anthropic";
import { openaiProvider } from "./providers/openai";

/**
 * Pick the AI provider based on config + available keys.
 * - Honors AI_PROVIDER when its key is present.
 * - Falls back to whichever provider has a key.
 * - Falls back to the offline mock when no key is configured (so the app
 *   works end-to-end without credentials).
 */
export function getProvider(): AiProvider {
  const pref = (process.env.AI_PROVIDER ?? "anthropic").toLowerCase();
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenai = !!process.env.OPENAI_API_KEY;

  if (pref === "anthropic" && hasAnthropic) return anthropicProvider;
  if (pref === "openai" && hasOpenai) return openaiProvider;

  if (hasAnthropic) return anthropicProvider;
  if (hasOpenai) return openaiProvider;

  return mockProvider;
}

export * from "./schema";
