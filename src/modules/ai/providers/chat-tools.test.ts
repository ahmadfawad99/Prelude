import { describe, it, expect } from "vitest";
import { chatToolsFor, safeJson } from "./chat-tools";
import type { ChatContext } from "../schema";

function ctx(caps: Partial<ChatContext["capabilities"]>): ChatContext {
  return {
    title: "Test lead",
    sources: "some source text",
    capabilities: {
      canGenerateWbs: false,
      canGeneratePlan: false,
      canRegenerateAnalysis: false,
      canEditWbs: false,
      canSetDates: false,
      canApproveWbs: false,
      canReopenWbs: false,
      canApprovePlan: false,
      canReopenPlan: false,
      canMoveStatus: false,
      canReassign: false,
      canSetMargin: false,
      canRename: false,
      canExport: false,
      canDiagram: false,
      ...caps,
    },
  };
}

describe("chatToolsFor — capability gating", () => {
  it("offers nothing when every capability is off", () => {
    const { allowed, specs } = chatToolsFor(ctx({}));
    expect(allowed.size).toBe(0);
    expect(specs).toHaveLength(0);
  });

  it("canEditWbs unlocks exactly the three edit tools", () => {
    const { allowed } = chatToolsFor(ctx({ canEditWbs: true }));
    expect([...allowed].sort()).toEqual(["add_wbs_item", "remove_wbs_item", "update_wbs_item"]);
  });

  it("maps each capability flag to its tool", () => {
    expect(chatToolsFor(ctx({ canGenerateWbs: true })).allowed.has("generate_wbs")).toBe(true);
    expect(chatToolsFor(ctx({ canGeneratePlan: true })).allowed.has("generate_plan")).toBe(true);
    expect(chatToolsFor(ctx({ canRegenerateAnalysis: true })).allowed.has("regenerate_analysis")).toBe(true);
    expect(chatToolsFor(ctx({ canSetDates: true })).allowed.has("set_dates")).toBe(true);
    expect(chatToolsFor(ctx({ canApproveWbs: true })).allowed.has("approve_wbs")).toBe(true);
    expect(chatToolsFor(ctx({ canReopenWbs: true })).allowed.has("reopen_wbs")).toBe(true);
    expect(chatToolsFor(ctx({ canApprovePlan: true })).allowed.has("approve_plan")).toBe(true);
    expect(chatToolsFor(ctx({ canReopenPlan: true })).allowed.has("reopen_plan")).toBe(true);
    expect(chatToolsFor(ctx({ canMoveStatus: true })).allowed.has("move_status")).toBe(true);
    expect(chatToolsFor(ctx({ canReassign: true })).allowed.has("reassign_lead")).toBe(true);
    expect(chatToolsFor(ctx({ canSetMargin: true })).allowed.has("set_margin")).toBe(true);
    expect(chatToolsFor(ctx({ canRename: true })).allowed.has("rename_lead")).toBe(true);
    expect(chatToolsFor(ctx({ canExport: true })).allowed.has("export_excel")).toBe(true);
    expect(chatToolsFor(ctx({ canDiagram: true })).allowed.has("generate_diagram")).toBe(true);
  });

  it("specs are a subset of the allowed set and carry JSON-schema parameters", () => {
    const { allowed, specs } = chatToolsFor(ctx({ canEditWbs: true, canSetDates: true }));
    expect(specs.length).toBe(allowed.size);
    for (const s of specs) {
      expect(allowed.has(s.name)).toBe(true);
      expect(s.parameters).toHaveProperty("type", "object");
    }
  });
});

describe("safeJson", () => {
  it("passes through objects", () => {
    expect(safeJson({ a: 1 })).toEqual({ a: 1 });
  });
  it("parses JSON strings (how OpenAI returns tool args)", () => {
    expect(safeJson('{"itemId":"abc","complexity":"MEDIUM"}')).toEqual({ itemId: "abc", complexity: "MEDIUM" });
  });
  it("returns {} on garbage, non-object JSON, or wrong types", () => {
    expect(safeJson("not json")).toEqual({});
    expect(safeJson("123")).toEqual({});
    expect(safeJson(null)).toEqual({});
    expect(safeJson(undefined)).toEqual({});
  });
});
