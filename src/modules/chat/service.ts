import type { Complexity } from "@prisma/client";
import type { ChatContext } from "@/modules/ai/schema";
import { prisma } from "@/lib/db";
import { getProvider } from "@/modules/ai";
import { logActivity } from "@/modules/activity/service";
import { combinedSourceText } from "@/modules/sources/service";
import { getWbs, generateWbs, updateWbsItem, addWbsItem, deleteWbsItem, approveWbs, rejectWbs } from "@/modules/wbs/service";
import { generateSummary } from "@/modules/summaries/service";
import { generateDiagram } from "@/modules/diagrams/service";
import { generatePlan, redateSprintsFromStart, approvePlan, rejectPlan, getPlan, setPlanMargin, resyncPlanFromWbs } from "@/modules/plans/service";
import { derivePlan, buildRateMap } from "@/modules/plans/derive";
import { listActiveRates } from "@/modules/rates/service";
import { updateInquiryDetails, transitionInquiry, assignInquiry } from "@/modules/inquiries/service";
import { TRANSITIONS } from "@/modules/inquiries/state-machine";
import { listUsers } from "@/modules/users/service";
import { COMPLEXITY_LABEL, COMPLEXITY_SP, COMPLEXITY_ENGINEERS } from "@/modules/wbs/complexity";
import { STATUS_LABELS } from "@/lib/format";
import type { InquiryStatus } from "@prisma/client";
import { withTimeout, TimeoutError } from "@/lib/timeout";
import { asStr, asComplexity, asPriority, asDate, fmtDate } from "./coerce";
import { buildChatTurns } from "./turns";
import { briefChatMarkdown, wbsChatSummary, planChatSummary, diagramChatSummary } from "./artifact-markdown";

export function listChat(inquiryId: string) {
  return prisma.chatMessage.findMany({ where: { inquiryId }, orderBy: { createdAt: "asc" } });
}

/**
 * Drop an assistant message into the thread directly (not through the model) —
 * used when a Studio button generates an artifact so the result also appears
 * in the chat. `action` tags it so the chat can offer a "View in Studio" chip.
 */
export async function postAssistantMessage(inquiryId: string, content: string, action: string | null = null) {
  const text = content.trim();
  if (!text) return;
  await prisma.chatMessage.create({ data: { inquiryId, role: "ASSISTANT", content: text, action } });
}

/** A compact text digest of the WBS so the assistant can answer about it. */
function wbsDigest(wbs: Awaited<ReturnType<typeof getWbs>>): string | null {
  if (!wbs) return null;
  const items = wbs.items;
  const totalSP = items.reduce((a, b) => a + (b.storyPoints ?? 0), 0);
  const byCx = { LOW: 0, LOW_MEDIUM: 0, MEDIUM: 0 } as Record<string, number>;
  for (const it of items) if (it.complexity) byCx[it.complexity] += 1;
  const lines = [
    `Status: ${wbs.status}. ${items.length} items, ${totalSP} story points.`,
    `Complexity mix: ${COMPLEXITY_LABEL.LOW} ${byCx.LOW}, ${COMPLEXITY_LABEL.LOW_MEDIUM} ${byCx.LOW_MEDIUM}, ${COMPLEXITY_LABEL.MEDIUM} ${byCx.MEDIUM}.`,
    "Items:",
    ...items.slice(0, 80).map(
      (it) => `- [id:${it.id}] [${it.module ?? "—"}] ${it.epic} › ${it.feature}${it.complexity ? ` (${COMPLEXITY_LABEL[it.complexity]})` : ""}${it.release ? ` · ${it.release}` : ""}`,
    ),
  ];
  return lines.join("\n");
}

function cxEffort(c: Complexity): string {
  return `${COMPLEXITY_LABEL[c]} (${COMPLEXITY_SP[c]} SP, ${COMPLEXITY_ENGINEERS[c]} eng)`;
}

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

/**
 * A text digest of the costed project plan (sprints, releases, dates, cost,
 * team) so the assistant can answer schedule/cost/team questions. null when
 * there is no plan yet.
 */
async function planDigest(inquiryId: string): Promise<string | null> {
  const [plan, rates] = await Promise.all([getPlan(inquiryId), listActiveRates()]);
  if (!plan || plan.sprints.length === 0) return null;

  const derived = derivePlan(plan.sprints, buildRateMap(rates), plan.marginPct);
  const starts = plan.sprints.map((s) => s.startDate).filter(Boolean) as Date[];
  const ends = plan.sprints.map((s) => s.endDate).filter(Boolean) as Date[];
  const first = starts.length ? new Date(Math.min(...starts.map((d) => d.getTime()))) : null;
  const last = ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null;

  const byRel = new Map<string, number>();
  for (const s of plan.sprints) {
    const r = (s.releaseGroup ?? "Unassigned").trim() || "Unassigned";
    byRel.set(r, (byRel.get(r) ?? 0) + 1);
  }

  const weeks = plan.sprints.length * 2;
  const lines = [
    `Status: ${plan.status}. ${plan.sprints.length} sprints (2 weeks each) ≈ ${weeks} weeks / ~${(weeks / 4.33).toFixed(1)} months.`,
    first && last ? `Timeline: ${fmtDate(first)} → ${fmtDate(last)}.` : null,
    `Releases: ${[...byRel.entries()].map(([r, n]) => `${r} (${n} sprint${n === 1 ? "" : "s"})`).join(", ")}.`,
    `Estimated effort: ${Math.round(derived.totalHours).toLocaleString()} hours. Estimated cost: ${money(derived.totalCost)} (±${Math.round(derived.marginPct * 100)}% margin → ${money(derived.totalCost * (1 - derived.marginPct))}–${money(derived.totalCost * (1 + derived.marginPct))}).`,
    derived.team.length ? `Team (avg FTE): ${derived.team.map((t) => `${t.role} ${t.avgFte.toFixed(2)}`).join(", ")}.` : null,
    derived.budgetByRelease.length > 1
      ? `Cost by release: ${derived.budgetByRelease.map((b) => `${b.releaseGroup} ${money(b.cost)}`).join(", ")}.`
      : null,
  ].filter(Boolean);
  return lines.join("\n");
}

/** Send a user message, let the assistant answer or run a task, persist both turns. */
export async function sendChat(inquiryId: string, userId: string, message: string) {
  const text = message.trim();
  if (!text) return;

  await prisma.chatMessage.create({ data: { inquiryId, role: "USER", content: text, authorId: userId } });

  const [inquiry, sources, wbs, history, planDetails, users] = await Promise.all([
    prisma.inquiry.findUnique({
      where: { id: inquiryId },
      include: {
        client: { select: { name: true } },
        summary: { select: { document: true } },
        assignee: { select: { name: true, email: true } },
        plan: { select: { status: true, marginPct: true, sprints: { select: { id: true }, take: 1 } } },
      },
    }),
    combinedSourceText(inquiryId),
    getWbs(inquiryId),
    // Fetch the MOST RECENT 30 messages (desc + take), then restore chronological
    // order below. Ordering asc + take:30 returns the OLDEST 30 instead, which on
    // a long thread drops the current question entirely so the model keeps
    // re-answering stale context — the "repeated response" bug.
    prisma.chatMessage.findMany({ where: { inquiryId }, orderBy: { createdAt: "desc" }, take: 30 }),
    planDigest(inquiryId),
    listUsers(),
  ]);
  if (!inquiry) throw new Error("NOT_FOUND");
  history.reverse(); // back to chronological (oldest → newest), newest = current message

  const brief = inquiry.summary?.document ?? null;
  const hasInput = !!(brief?.trim() || sources.trim());
  const planStatus = inquiry.plan?.status ?? null;
  const nextStates = TRANSITIONS[inquiry.status] ?? [];
  const capabilities = {
    canGenerateWbs: inquiry.wbsEnabled && hasInput,
    canGeneratePlan: inquiry.planEnabled && wbs?.status === "APPROVED",
    canRegenerateAnalysis: !!sources.trim(),
    canEditWbs: !!wbs,
    canSetDates: true,
    canApproveWbs: !!wbs && wbs.status !== "APPROVED",
    canReopenWbs: wbs?.status === "APPROVED",
    canApprovePlan: !!planStatus && planStatus !== "APPROVED",
    canReopenPlan: planStatus === "APPROVED",
    canMoveStatus: nextStates.length > 0,
    canReassign: true,
    canSetMargin: !!planStatus,
    canRename: true,
    canExport: !!wbs || !!planStatus,
    canDiagram: hasInput,
  };

  const today = new Date().toISOString().slice(0, 10);
  const planHasSprints = (inquiry.plan?.sprints?.length ?? 0) > 0;
  const dates = [
    `Today's date: ${today}.`,
    `Project start date: ${fmtDate(inquiry.startDate)}.`,
    `Target / due date: ${fmtDate(inquiry.dueDate)}.`,
    planHasSprints ? "A project plan with sprints exists — setting the start date re-dates its sprints." : "No sprints to re-date yet.",
  ].join(" ");

  const assigneeName = inquiry.assignee?.name ?? inquiry.assignee?.email ?? "Unassigned";
  const leadMeta = [
    `Title: "${inquiry.title}".`,
    `Current status: ${STATUS_LABELS[inquiry.status]} (${inquiry.status}).`,
    nextStates.length ? `Legal status moves: ${nextStates.map((s) => `${STATUS_LABELS[s]} (${s})`).join(", ")}.` : "No status moves available.",
    `Assignee: ${assigneeName}.`,
    planStatus ? `Plan margin: ${Math.round((inquiry.plan?.marginPct ?? 0) * 100)}%.` : null,
  ].filter(Boolean).join(" ");

  const team = users.map((u) => `${u.name ?? u.email}${u.email ? ` <${u.email}>` : ""}`).join("; ");

  const ctx: ChatContext = {
    title: inquiry.title,
    client: inquiry.client?.name ?? null,
    sources,
    brief,
    wbsSummary: wbsDigest(wbs),
    planStatus: planStatus
      ? `A project plan exists. Current plan status: ${planStatus} — it is ${planStatus === "APPROVED" ? "APPROVED" : "NOT approved"}.`
      : wbs?.status === "APPROVED"
        ? "No project plan yet, but the WBS is approved so a plan can be generated."
        : "No project plan yet.",
    planDigest: planDetails,
    dates,
    leadMeta,
    team,
    capabilities,
  };

  // Feed the model only genuine conversational turns (see buildChatTurns).
  const turns = buildChatTurns(history);

  const provider = getProvider();
  let result: Awaited<ReturnType<typeof provider.chat>>;
  try {
    result = await withTimeout(provider.chat(turns, ctx), 45_000, "the assistant");
  } catch (e) {
    // The model call failed or timed out — never crash the action. Save a
    // friendly bubble so the user can simply retry.
    console.error("[chat] provider.chat failed", e);
    const reason = e instanceof TimeoutError ? "took too long to respond" : "couldn't be reached just now";
    await prisma.chatMessage.create({
      data: {
        inquiryId,
        role: "ASSISTANT",
        content: `⚠️ Sorry — the assistant ${reason}. Please try sending that again in a moment.`,
        action: null,
      },
    });
    return;
  }

  let assistant = result.content?.trim() ?? "";
  let executed: string | null = null;
  let autoPlan = false; // set when approving the WBS auto-generates the release plan
  const append = (note: string) => {
    assistant = `${assistant ? assistant + "\n\n" : ""}${note}`;
  };
  const wbsItemIds = new Set((wbs?.items ?? []).map((i) => i.id));

  try {
    const tool = result.tool;
    if (tool?.name === "generate_wbs" && capabilities.canGenerateWbs) {
      const requirements = brief?.trim() || sources.trim();
      const freshWbs = await withTimeout(generateWbs(inquiryId, requirements, userId), 90_000, "WBS generation");
      executed = tool.name;
      assistant = wbsChatSummary(freshWbs); // compact card — full table opens in the popup
    } else if (tool?.name === "generate_plan" && capabilities.canGeneratePlan) {
      await withTimeout(generatePlan(inquiryId, userId), 90_000, "plan generation");
      executed = tool.name;
      assistant = await planChatSummary(inquiryId); // compact card — full plan opens in the popup
    } else if (tool?.name === "regenerate_analysis" && capabilities.canRegenerateAnalysis) {
      const s = await withTimeout(generateSummary(inquiryId, sources, userId), 90_000, "analysis");
      executed = tool.name;
      assistant = briefChatMarkdown(s.document ?? ""); // textual — rendered inline in the chat
    } else if (tool?.name === "update_wbs_item" && capabilities.canEditWbs) {
      const itemId = asStr(tool.args.itemId);
      if (!itemId || !wbsItemIds.has(itemId)) {
        append("⚠️ I couldn't find that WBS item to update — tell me which feature by name and I'll try again.");
      } else {
        const complexity = asComplexity(tool.args.complexity);
        const patch = {
          ...(complexity ? { complexity } : {}),
          ...(asStr(tool.args.feature) ? { feature: asStr(tool.args.feature) } : {}),
          ...(asStr(tool.args.epic) ? { epic: asStr(tool.args.epic) } : {}),
          ...(asStr(tool.args.module) !== undefined ? { module: asStr(tool.args.module) ?? null } : {}),
          ...(asStr(tool.args.description) !== undefined ? { description: asStr(tool.args.description) ?? null } : {}),
          ...(asStr(tool.args.release) !== undefined ? { release: asStr(tool.args.release) ?? null } : {}),
          ...(asStr(tool.args.sprint) !== undefined ? { sprint: asStr(tool.args.sprint) ?? null } : {}),
          ...(asPriority(tool.args.priority) ? { priority: asPriority(tool.args.priority) } : {}),
        };
        const current = wbs!.items.find((i) => i.id === itemId)!;
        const updated = await updateWbsItem(itemId, { epic: current.epic ?? "Untitled", feature: current.feature ?? "Untitled", ...patch });
        executed = tool.name;
        append(`✓ Updated **${updated.feature}**${complexity ? ` → complexity **${cxEffort(complexity)}**` : ""}. See the **Estimates** tab.`);
      }
    } else if (tool?.name === "add_wbs_item" && capabilities.canEditWbs) {
      const epic = asStr(tool.args.epic);
      const feature = asStr(tool.args.feature);
      if (!epic || !feature) {
        append("⚠️ To add a feature I need at least an epic and a feature name.");
      } else {
        const complexity = asComplexity(tool.args.complexity);
        const created = await addWbsItem(wbs!.id, {
          epic,
          feature,
          module: asStr(tool.args.module) ?? null,
          description: asStr(tool.args.description) ?? null,
          release: asStr(tool.args.release) ?? null,
          sprint: asStr(tool.args.sprint) ?? null,
          priority: asPriority(tool.args.priority) ?? null,
          ...(complexity ? { complexity } : {}),
        });
        executed = tool.name;
        append(`✓ Added **${created.feature}** under *${created.epic}*${complexity ? ` (${cxEffort(complexity)})` : ""}. See the **Estimates** tab.`);
      }
    } else if (tool?.name === "remove_wbs_item" && capabilities.canEditWbs) {
      const itemId = asStr(tool.args.itemId);
      if (!itemId || !wbsItemIds.has(itemId)) {
        append("⚠️ I couldn't find that WBS item to remove — tell me which feature by name.");
      } else {
        const removed = wbs!.items.find((i) => i.id === itemId)!;
        await deleteWbsItem(itemId);
        executed = tool.name;
        append(`✓ Removed **${removed.feature}** from the WBS.`);
      }
    } else if (tool?.name === "set_dates" && capabilities.canSetDates) {
      const rawStart = asDate(tool.args.startDate);
      const rawDue = asDate(tool.args.dueDate);
      // No-op guard: ignore a date that already equals the current value, so a
      // stray/duplicate tool call can't spuriously re-date the plan's sprints.
      const sameDay = (a: Date | undefined, b: Date | null | undefined) =>
        !!a && !!b && fmtDate(a) === fmtDate(b);
      const startDate = sameDay(rawStart, inquiry.startDate) ? undefined : rawStart;
      const dueDate = sameDay(rawDue, inquiry.dueDate) ? undefined : rawDue;
      if (!startDate && !dueDate) {
        append(
          rawStart || rawDue
            ? "Those dates are already set — nothing to change."
            : "⚠️ Tell me the start date and/or target date (e.g. “start on 2026-11-10”) and I'll set it.",
        );
      } else {
        await updateInquiryDetails(inquiryId, {
          ...(startDate ? { startDate } : {}),
          ...(dueDate ? { dueDate } : {}),
        });
        let note = "✓ Set ";
        note += [startDate ? `**start date → ${fmtDate(startDate)}**` : null, dueDate ? `**target date → ${fmtDate(dueDate)}**` : null].filter(Boolean).join(" and ");
        if (startDate) {
          const moved = await redateSprintsFromStart(inquiryId, startDate);
          if (moved > 0) note += `. Re-dated **${moved} sprint${moved === 1 ? "" : "s"}** in the plan to start from then`;
        }
        note += ".";
        executed = tool.name;
        append(note);
      }
    } else if (tool?.name === "approve_wbs" && capabilities.canApproveWbs) {
      await approveWbs(inquiryId, userId);
      executed = tool.name;
      if (inquiry.planEnabled) {
        // The plan is produced automatically on approval — no manual step.
        const existingPlan = await getPlan(inquiryId);
        if (!existingPlan || existingPlan.sprints.length === 0) {
          try {
            await withTimeout(generatePlan(inquiryId, userId), 90_000, "plan generation");
            autoPlan = true;
            append("✓ Approved the **WBS** and generated the **release plan** from it.");
          } catch (e) {
            append(`✓ Approved the **WBS**. (I couldn't auto-build the plan: ${(e as Error).message})`);
          }
        } else {
          append("✓ Approved the **WBS**. The release plan is ready in the Studio.");
        }
      } else {
        append("✓ Approved the **WBS**.");
      }
    } else if (tool?.name === "reopen_wbs" && capabilities.canReopenWbs) {
      await rejectWbs(inquiryId, userId);
      executed = tool.name;
      append("✓ Reopened the **WBS** — it's editable again. Approve it when you're done.");
    } else if (tool?.name === "approve_plan" && capabilities.canApprovePlan) {
      await approvePlan(inquiryId, userId);
      executed = tool.name;
      append("✓ Approved the **project plan**. The lead is moving to handoff.");
    } else if (tool?.name === "reopen_plan" && capabilities.canReopenPlan) {
      await rejectPlan(inquiryId, userId);
      executed = tool.name;
      append("✓ Reopened the **project plan** — it's editable again.");
    } else if (tool?.name === "move_status" && capabilities.canMoveStatus) {
      const raw = (asStr(tool.args.status) ?? "").toUpperCase().replace(/[ /-]+/g, "_");
      const target = nextStates.find((s) => s === raw || STATUS_LABELS[s].toUpperCase().replace(/[ /-]+/g, "_") === raw);
      if (!target) {
        append(`⚠️ I can only move this lead to: ${nextStates.map((s) => STATUS_LABELS[s]).join(", ")}.`);
      } else {
        await transitionInquiry(inquiryId, target, userId);
        executed = tool.name;
        append(`✓ Moved the lead to **${STATUS_LABELS[target]}**.`);
      }
    } else if (tool?.name === "reassign_lead" && capabilities.canReassign) {
      const who = (asStr(tool.args.assignee) ?? "").toLowerCase();
      if (who === "none" || who === "unassign" || who === "unassigned" || who === "nobody") {
        await assignInquiry(inquiryId, null, userId);
        executed = tool.name;
        append("✓ Unassigned the lead.");
      } else {
        const target =
          who === "me" || who === "myself"
            ? users.find((u) => u.id === userId)
            : users.find((u) => (u.name ?? "").toLowerCase() === who || (u.email ?? "").toLowerCase() === who) ??
              users.find((u) => (u.name ?? "").toLowerCase().includes(who) || (u.email ?? "").toLowerCase().includes(who));
        if (!target) {
          append(`⚠️ I couldn't find "${asStr(tool.args.assignee)}" on the team. People I can assign: ${users.map((u) => u.name ?? u.email).join(", ")}.`);
        } else {
          await assignInquiry(inquiryId, target.id, userId);
          executed = tool.name;
          append(`✓ Assigned the lead to **${target.name ?? target.email}**.`);
        }
      }
    } else if (tool?.name === "set_margin" && capabilities.canSetMargin) {
      const n = typeof tool.args.marginPct === "number" ? tool.args.marginPct : Number(asStr(tool.args.marginPct));
      if (!isFinite(n) || n < 0) {
        append("⚠️ Tell me the margin as a percentage, e.g. “set the margin to 15%”.");
      } else {
        const pct = n > 1 ? n / 100 : n; // accept 15 or 0.15
        await setPlanMargin(inquiryId, pct);
        executed = tool.name;
        append(`✓ Set the plan **margin to ${Math.round(pct * 100)}%**. The budget range updates accordingly.`);
      }
    } else if (tool?.name === "rename_lead" && capabilities.canRename) {
      const title = asStr(tool.args.title);
      if (!title) {
        append("⚠️ What would you like to rename the lead to?");
      } else {
        await updateInquiryDetails(inquiryId, { title });
        executed = tool.name;
        append(`✓ Renamed the lead to **${title}**.`);
      }
    } else if (tool?.name === "export_excel" && capabilities.canExport) {
      executed = tool.name;
      append(`✓ Your Excel export is ready: [**Download ${inquiry.key}.xlsx**](/api/inquiries/${inquiryId}/export) (WBS + Project Plan + Rates + Summary).`);
    } else if (tool?.name === "generate_diagram" && capabilities.canDiagram) {
      const instruction = asStr(tool.args.instruction) ?? null;
      const d = await withTimeout(generateDiagram(inquiryId, instruction, userId), 90_000, "diagram generation");
      executed = tool.name;
      assistant = diagramChatSummary(d.version); // compact card — the diagram opens in the popup
    }
  } catch (e) {
    append(`⚠️ I couldn't complete that task: ${(e as Error).message}`);
  }

  // A conversational WBS edit changes story points → re-sync the plan so cost keeps up.
  if (executed && (executed === "update_wbs_item" || executed === "add_wbs_item" || executed === "remove_wbs_item")) {
    try {
      await resyncPlanFromWbs(inquiryId);
    } catch (e) {
      console.error("[chat] plan re-sync failed", e);
    }
  }

  if (!assistant) assistant = "I don't have anything to add from the current sources.";

  await prisma.chatMessage.create({
    data: { inquiryId, role: "ASSISTANT", content: assistant, action: executed },
  });

  // When approving the WBS auto-built the plan, follow the approval note with the
  // plan's result card (so it shows in the chat and opens in the popup).
  if (autoPlan) {
    await postAssistantMessage(inquiryId, await planChatSummary(inquiryId), "generate_plan");
  }

  if (executed) await logActivity({ inquiryId, actorId: userId, action: "chat_action", meta: { action: executed } });
}
