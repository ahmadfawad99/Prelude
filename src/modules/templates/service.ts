import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export function listTemplates() {
  return prisma.projectPlanTemplate.findMany({ orderBy: { id: "desc" } });
}

/** Store an uploaded .xlsx as the active Project Plan template (captures its sheet/column layout). */
export async function createTemplateFromWorkbook(name: string, buffer: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const sheets = wb.worksheets.map((ws) => {
    const headerRow = ws.getRow(1).values as unknown[];
    const headers = Array.isArray(headerRow)
      ? headerRow.slice(1).map((v) => String(v ?? "").trim()).filter(Boolean)
      : [];
    return { name: ws.name, headers };
  });

  await prisma.projectPlanTemplate.updateMany({ where: { active: true }, data: { active: false } });

  return prisma.projectPlanTemplate.create({
    data: { name, layout: { sheets } as unknown as Prisma.InputJsonValue, active: true },
  });
}

export function deleteTemplate(id: string) {
  return prisma.projectPlanTemplate.delete({ where: { id } });
}
