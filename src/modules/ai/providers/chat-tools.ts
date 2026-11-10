import type { ChatContext, ChatAction } from "../schema";
import { CHAT_TOOLS } from "../prompt";

/** Which tools are available given the lead's current capabilities. */
export function chatToolsFor(ctx: ChatContext) {
  const allowed = new Set<ChatAction>();
  if (ctx.capabilities.canGenerateWbs) allowed.add("generate_wbs");
  if (ctx.capabilities.canGeneratePlan) allowed.add("generate_plan");
  if (ctx.capabilities.canRegenerateAnalysis) allowed.add("regenerate_analysis");
  if (ctx.capabilities.canEditWbs) {
    allowed.add("update_wbs_item");
    allowed.add("add_wbs_item");
    allowed.add("remove_wbs_item");
  }
  if (ctx.capabilities.canSetDates) allowed.add("set_dates");
  if (ctx.capabilities.canApproveWbs) allowed.add("approve_wbs");
  if (ctx.capabilities.canReopenWbs) allowed.add("reopen_wbs");
  if (ctx.capabilities.canApprovePlan) allowed.add("approve_plan");
  if (ctx.capabilities.canReopenPlan) allowed.add("reopen_plan");
  if (ctx.capabilities.canMoveStatus) allowed.add("move_status");
  if (ctx.capabilities.canReassign) allowed.add("reassign_lead");
  if (ctx.capabilities.canSetMargin) allowed.add("set_margin");
  if (ctx.capabilities.canRename) allowed.add("rename_lead");
  if (ctx.capabilities.canExport) allowed.add("export_excel");
  if (ctx.capabilities.canDiagram) allowed.add("generate_diagram");
  return { allowed, specs: CHAT_TOOLS.filter((t) => allowed.has(t.name)) };
}

export function safeJson(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}
