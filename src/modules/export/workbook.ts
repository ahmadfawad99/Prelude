import path from "node:path";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { buildRateMap, derivePlan, type DerivedPlan } from "@/modules/plans/derive";

const TEMPLATE_PATH = path.join(process.cwd(), "templates", "project-plan.xlsx");

/** Map an app rate-card role to the template's fixed Release-Plan columns (F..J). */
function roleColumn(role: string): number | null {
  const r = role.toLowerCase();
  if (r.includes("devops")) return 10; // J DevOps
  if (r.includes("qa")) return 9; // I QA Engineer
  if (r.includes("mobile")) return 7; // G SE (Mobile)
  if (r.includes("full stack") || r.includes("fullstack")) return 8; // H SE (Fullstack)
  if (r.includes("pm") || r.includes("project manager") || r.includes("tech lead")) return 6; // F PM
  return null;
}

function clearDataRows(ws: ExcelJS.Worksheet, from: number) {
  for (let r = ws.rowCount; r >= from; r--) {
    const row = ws.getRow(r);
    row.eachCell({ includeEmpty: true }, (c) => (c.value = null));
  }
}

const GREEN_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB6D7A8" } };

type SummaryData = {
  team?: { role?: string; responsibilities?: string; avgAllocation?: string }[];
  budget?: { platform?: string; budgetRange?: string; timeDuration?: string }[];
  deliverables?: { platform?: string; budgetRange?: string }[];
  overallBudget?: string;
  overallDuration?: string;
  monthlyBurn?: string;
};

function defaultSummary(derived: DerivedPlan | null): SummaryData {
  if (!derived) return {};
  const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
  return {
    team: derived.team.map((t) => ({ role: t.role, responsibilities: "", avgAllocation: t.avgFte.toFixed(2) })),
    budget: derived.budgetByRelease.map((b) => ({ platform: b.releaseGroup, budgetRange: `${money(b.low)} - ${money(b.high)}`, timeDuration: "" })),
    deliverables: derived.budgetByRelease.map((b) => ({ platform: b.releaseGroup, budgetRange: money(b.cost) })),
    overallBudget: `${money(derived.totalCost * (1 - derived.marginPct))} - ${money(derived.totalCost * (1 + derived.marginPct))}`,
    overallDuration: "",
    monthlyBurn: money(derived.monthlyBurn),
  };
}

/** Build a filled copy of the standard Project Plan template (exact tabs & cells). */
export async function buildInquiryWorkbook(inquiryId: string): Promise<{ buffer: Buffer; filename: string }> {
  const [inquiry, wbs, plan, rates] = await Promise.all([
    prisma.inquiry.findUnique({ where: { id: inquiryId }, select: { key: true } }),
    prisma.wbs.findUnique({ where: { inquiryId }, include: { items: { orderBy: { order: "asc" } } } }),
    prisma.projectPlan.findUnique({ where: { inquiryId }, include: { sprints: { include: { allocations: true }, orderBy: { order: "asc" } } } }),
    prisma.resourceRate.findMany({ where: { active: true }, orderBy: { ratePerHour: "desc" } }),
  ]);
  if (!inquiry) throw new Error("NOT_FOUND");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE_PATH);

  const rateMap = buildRateMap(rates);
  const derived = plan ? derivePlan(plan.sprints, rateMap, plan.marginPct) : null;
  const items = wbs?.items ?? [];

  // ---------- Resource Rates ----------
  const rr = wb.getWorksheet("Resource Rates");
  if (rr) {
    clearDataRows(rr, 2);
    rates.forEach((r, i) => {
      const row = rr.getRow(2 + i);
      row.getCell(1).value = r.role;
      row.getCell(2).value = r.monthlyHours;
      row.getCell(3).value = r.ratePerHour;
      row.getCell(4).value = r.monthlyHours * r.ratePerHour;
      row.getCell(5).value = r.effectiveMonthly ?? r.monthlyHours * r.ratePerHour;
    });
  }

  // ---------- WBS master ----------
  const wbsSheet = wb.getWorksheet("WBS");
  if (wbsSheet) {
    clearDataRows(wbsSheet, 2);
    items.forEach((it, i) => {
      const row = wbsSheet.getRow(2 + i);
      row.getCell(1).value = it.epic ?? "";
      row.getCell(2).value = it.feature ?? "";
      row.getCell(3).value = it.description ?? "";
      row.getCell(4).value = it.sprint ?? "";
      row.getCell(5).value = it.storyPoints ?? "";
      row.getCell(6).value = it.hours ?? "";
      row.getCell(7).value = it.startDate ?? "";
      row.getCell(8).value = it.endDate ?? "";
      row.getCell(9).value = it.priority ?? "";
      row.getCell(10).value = it.release ?? "";
    });
  }

  // Remove the sample per-module tab — modules are already listed in the WBS sheet.
  const sample = wb.getWorksheet("Static Landing Page");
  if (sample) wb.removeWorksheet(sample.id);

  // ---------- Release Plan ----------
  const rp = wb.getWorksheet("Release Plan");
  if (rp && plan) {
    ["A2:A3", "B2:B3", "A4:A5", "B4:B5"].forEach((rng) => {
      try { rp.unMergeCells(rng); } catch { /* not merged */ }
    });
    clearDataRows(rp, 2);
    const derivedById = new Map((derived?.sprints ?? []).map((s) => [s.id, s]));

    // group sprints by release group, preserving order
    const groups: { group: string; sprints: typeof plan.sprints }[] = [];
    for (const sp of plan.sprints) {
      const g = sp.releaseGroup ?? "";
      const last = groups[groups.length - 1];
      if (last && last.group === g) last.sprints.push(sp);
      else groups.push({ group: g, sprints: [sp] });
    }

    let r = 2;
    for (const { group, sprints } of groups) {
      const start = r;
      for (let idx = 0; idx < sprints.length; idx++) {
        const sp = sprints[idx];
        const row = rp.getRow(r);
        if (idx === 0) {
          row.getCell(1).value = group;
          row.getCell(2).value = sp.summary ?? "";
        }
        row.getCell(3).value = sp.sprintNo;
        if (sp.startDate) { row.getCell(4).value = sp.startDate; row.getCell(4).numFmt = "yyyy-mm-dd"; }
        if (sp.endDate) { row.getCell(5).value = sp.endDate; row.getCell(5).numFmt = "yyyy-mm-dd"; }
        const fte = [0, 0, 0, 0, 0]; // F..J
        for (const a of sp.allocations) {
          const col = roleColumn(a.role);
          if (col) fte[col - 6] += a.fteFraction;
        }
        fte.forEach((v, i2) => (row.getCell(6 + i2).value = v || null));
        const d = derivedById.get(sp.id);
        row.getCell(11).value = Math.round(d?.cost ?? 0);
        row.getCell(12).value = d?.hours ?? 0;
        row.getCell(13).value = d?.blendedRate != null ? Number(d.blendedRate.toFixed(2)) : "";
        r++;
      }
      // Uniform green on every release-group label cell (template only pre-colors some rows).
      for (let rr = start; rr <= r - 1; rr++) rp.getCell(rr, 1).fill = GREEN_FILL;
      if (r - 1 > start) {
        rp.mergeCells(start, 1, r - 1, 1);
        rp.mergeCells(start, 2, r - 1, 2);
      }
    }
    // Totals row (club of expected cost per sprint + hours).
    if (derived) {
      const totalRow = rp.getRow(r);
      totalRow.getCell(3).value = "Total";
      totalRow.getCell(11).value = Math.round(derived.totalCost);
      totalRow.getCell(12).value = derived.totalHours;
      totalRow.getCell(3).font = { bold: true };
      totalRow.getCell(11).font = { bold: true };
      totalRow.getCell(11).numFmt = "$#,##0";
      totalRow.getCell(12).font = { bold: true };
    }
  }

  // ---------- Summary ----------
  const sum = wb.getWorksheet("Summary");
  if (sum) {
    const sd: SummaryData = (plan?.summaryData as unknown as SummaryData | null) ?? defaultSummary(derived);
    (sd.team ?? []).forEach((t, i) => {
      const row = sum.getRow(5 + i);
      row.getCell(2).value = t.role ?? "";
      row.getCell(3).value = t.responsibilities ?? "";
      const n = parseFloat(t.avgAllocation ?? "");
      row.getCell(4).value = Number.isFinite(n) ? n : (t.avgAllocation ?? "");
    });
    (sd.budget ?? []).forEach((b, i) => {
      const row = sum.getRow(16 + i);
      row.getCell(2).value = b.platform ?? "";
      row.getCell(3).value = b.budgetRange ?? "";
      row.getCell(4).value = b.timeDuration ?? "";
    });
    sum.getCell("C20").value = sd.overallBudget ?? "";
    sum.getCell("D20").value = sd.overallDuration ?? "";
    sum.getCell("C22").value = sd.monthlyBurn ?? "";
    (sd.deliverables ?? []).forEach((d, i) => {
      const row = sum.getRow(28 + i);
      row.getCell(2).value = d.platform ?? "";
      row.getCell(3).value = d.budgetRange ?? "";
    });
    if (derived) sum.getCell("C33").value = Math.round(derived.totalCost);
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, filename: `${inquiry.key}-project-plan.xlsx` };
}
