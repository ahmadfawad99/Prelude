import type { ChatTurn } from "@/modules/ai/schema";

export interface HistoryMsg {
  role: "USER" | "ASSISTANT";
  content: string;
  action: string | null;
}

/**
 * Turn stored chat messages (already in chronological order) into the turns fed
 * to the model. Assistant turns are KEPT (so the conversation stays properly
 * alternating and the model can see that a past action request was already
 * handled — otherwise it re-triggers the stale request), but the app-authored
 * "✓"/"⚠️" glyphs and any "[executed tool: …]" marker are stripped so the model
 * doesn't imitate them and fake a confirmation without calling the tool. The
 * system prompt separately forbids claiming an action without calling its tool.
 * Emptied turns are dropped.
 */
/** Short markers so a long generated artifact doesn't get re-fed verbatim. */
const ARTIFACT_MARKER: Record<string, string> = {
  generate_wbs: "[Generated the Work Breakdown and showed it to the user.]",
  generate_plan: "[Generated the release plan and showed it to the user.]",
  regenerate_analysis: "[Regenerated the analysis brief and showed it to the user.]",
  generate_diagram: "[Drew the flow diagram and showed it to the user.]",
};

export function buildChatTurns(history: HistoryMsg[]): ChatTurn[] {
  return history
    .map((m): ChatTurn => {
      if (m.role === "USER") return { role: "user", content: m.content };
      // A generated artifact was rendered in the chat for the user — the model
      // only needs to know it happened, not re-read the whole table/brief.
      if (m.action && ARTIFACT_MARKER[m.action]) {
        return { role: "assistant", content: ARTIFACT_MARKER[m.action] };
      }
      const content = m.content
        .split("\n")
        .map((l) =>
          l
            .replace(/^\s*[✓⚠]️?\s*/u, "") // leading ✓ / ⚠️ glyph
            .replace(/^\s*\[executed tool:[^\]]*\]\s*/i, ""), // stale marker
        )
        .join("\n")
        .trim();
      return { role: "assistant", content };
    })
    .filter((t) => t.content.length > 0);
}
