import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { logActivity } from "@/modules/activity/service";

/**
 * Import a Project Plan from an uploaded .xlsx whose "Release Plan" sheet
 * matches our export format. The uploaded sheet becomes the source of truth:
 * sprints and allocations are rebuilt from it. Costs recompute via the derive
 * engine. Round-trips with buildInquiryWorkbook.
 */
export async function importPlanFromWorkbook(inquiryId: string, buffer: Buffer, actorId: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const ws = wb.getWorksheet("Release Plan");
  if (!ws) throw new Error("NO_RELEASE_PLAN_SHEET");

  // Map header label -> column index.
  const header: Record<string, number> = {};
  ws.getRow(1).eachCell((cell, col) => {
    const v = String(cell.value ?? "").trim();
    if (v) header[v] = col;
  });

  const relCol = header["Release Group"];
  const sprintCol = header["Sprint"];
  const hoursCol = header["Hours"];
  if (!relCol || !sprintCol || !hoursCol) throw new Error("BAD_HEADER");

  // Role columns sit between "Sprint" and "Hours".
  const roleCols: { role: string; col: number }[] = [];
  for (const [name, col] of Object.entries(header)) {
    if (col > sprintCol && col < hoursCol) roleCols.push({ role: name, col });
  }

  const sprintsData: { releaseGroup: string; sprintNo: number; allocations: { role: string; fteFraction: number }[] }[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const relRaw = row.getCell(relCol).value;
    const rel = relRaw == null ? "" : String(relRaw).trim();
    if (!rel || rel.toLowerCase() === "totals") continue;

    const sprintNo = Number(row.getCell(sprintCol).value);
    const allocations: { role: string; fteFraction: number }[] = [];
    for (const rc of roleCols) {
      const n = Number(row.getCell(rc.col).value);
      if (Number.isFinite(n) && n > 0) allocations.push({ role: rc.role, fteFraction: n });
    }
    sprintsData.push({
      releaseGroup: rel,
      sprintNo: Number.isFinite(sprintNo) && sprintNo > 0 ? sprintNo : sprintsData.length + 1,
      allocations,
    });
  }

  if (sprintsData.length === 0) throw new Error("NO_ROWS");

  const plan = await prisma.$transaction(async (tx) => {
    let p = await tx.projectPlan.findUnique({ where: { inquiryId }, select: { id: true } });
    if (!p) {
      p = await tx.projectPlan.create({ data: { inquiryId, status: "DRAFT", marginPct: 0.1 }, select: { id: true } });
    } else {
      await tx.sprintPlan.deleteMany({ where: { planId: p.id } });
    }
    for (let i = 0; i < sprintsData.length; i++) {
      const s = sprintsData[i];
      await tx.sprintPlan.create({
        data: {
          planId: p.id,
          sprintNo: s.sprintNo,
          releaseGroup: s.releaseGroup,
          order: i,
          allocations: { create: s.allocations },
        },
      });
    }
    return tx.projectPlan.findUnique({
      where: { inquiryId },
      include: { sprints: { include: { allocations: true }, orderBy: { order: "asc" } } },
    });
  });

  await logActivity({ inquiryId, actorId, action: "plan_imported", meta: { sprints: sprintsData.length } });
  return plan;
}
