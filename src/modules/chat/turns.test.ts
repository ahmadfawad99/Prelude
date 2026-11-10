import { describe, it, expect } from "vitest";
import { buildChatTurns, type HistoryMsg } from "./turns";

const user = (content: string): HistoryMsg => ({ role: "USER", content, action: null });
const asst = (content: string, action: string | null = null): HistoryMsg => ({ role: "ASSISTANT", content, action });

describe("buildChatTurns", () => {
  it("maps plain user/assistant turns and preserves order", () => {
    const turns = buildChatTurns([user("hi"), asst("hello there")]);
    expect(turns).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello there" },
    ]);
  });

  it("KEEPS executed-tool assistant turns (so stale requests aren't re-triggered) but strips the ✓ glyph", () => {
    const turns = buildChatTurns([
      user("approve the plan"),
      asst("✓ Approved the project plan.", "approve_plan"),
      user("thanks"),
    ]);
    expect(turns).toEqual([
      { role: "user", content: "approve the plan" },
      { role: "assistant", content: "Approved the project plan." }, // glyph gone, sentence kept
      { role: "user", content: "thanks" },
    ]);
  });

  it("strips the leading ✓ / ⚠️ glyph and [executed tool:] marker but keeps the words", () => {
    const turns = buildChatTurns([
      asst("✓ Assigned the lead to Dev Admin."),
      asst("⚠️ I couldn't find that item."),
      asst("[executed tool: foo] done"),
    ]);
    expect(turns).toEqual([
      { role: "assistant", content: "Assigned the lead to Dev Admin." },
      { role: "assistant", content: "I couldn't find that item." },
      { role: "assistant", content: "done" },
    ]);
  });

  it("drops assistant turns that become empty after stripping", () => {
    const turns = buildChatTurns([user("q"), asst("✓")]);
    expect(turns).toEqual([{ role: "user", content: "q" }]);
  });

  it("keeps the current (last) user message as the final turn", () => {
    const history = [
      user("old q"),
      asst("old answer"),
      asst("✓ Generated the WBS.", "generate_wbs"),
      user("current question"),
    ];
    const turns = buildChatTurns(history);
    expect(turns.at(-1)).toEqual({ role: "user", content: "current question" });
  });
});
