import { describe, it, expect } from "vitest";
import { matchChatIntent, parseJsonLoose } from "./prompt";

const ALL = { canGenerateWbs: true, canGeneratePlan: true, canRegenerateAnalysis: true };

describe("matchChatIntent (mock-provider keyword fallback)", () => {
  it("returns null when the message isn't a 'make' request", () => {
    expect(matchChatIntent("what is the budget?", ALL)).toBeNull();
    expect(matchChatIntent("summarize the risks", ALL)).toBeNull(); // no make-verb
  });

  it("detects WBS generation", () => {
    expect(matchChatIntent("generate the WBS", ALL)).toBe("generate_wbs");
    expect(matchChatIntent("build the work breakdown", ALL)).toBe("generate_wbs");
  });

  it("detects plan generation and prefers it over WBS when 'plan' is present", () => {
    expect(matchChatIntent("create the project plan", ALL)).toBe("generate_plan");
  });

  it("detects analysis regeneration", () => {
    expect(matchChatIntent("regenerate the analysis", ALL)).toBe("regenerate_analysis");
  });

  it("respects capabilities — won't return a disabled action", () => {
    // "plan" only triggers the (disabled) plan branch and isn't a WBS keyword → null.
    expect(matchChatIntent("generate the plan", { ...ALL, canGeneratePlan: false })).toBeNull();
    // A WBS-keyword request still falls through to WBS when plan is disabled.
    expect(matchChatIntent("generate the WBS", { ...ALL, canGeneratePlan: false })).toBe("generate_wbs");
    // Nothing enabled → null.
    expect(matchChatIntent("generate the WBS", { canGenerateWbs: false, canGeneratePlan: false, canRegenerateAnalysis: false })).toBeNull();
  });
});

describe("parseJsonLoose", () => {
  it("parses plain JSON", () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 });
  });
  it("strips ```json fences", () => {
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("grabs the first {...} block when wrapped in prose", () => {
    expect(parseJsonLoose('Here you go: {"a":1} — enjoy')).toEqual({ a: 1 });
  });
  it("throws on input with no JSON object", () => {
    expect(() => parseJsonLoose("no json here")).toThrow();
  });
});
