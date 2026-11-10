import ExcelJS from "exceljs";
import { prisma } from "../src/lib/db";
import { buildInquiryWorkbook } from "../src/modules/export/workbook";
import { importPlanFromWorkbook } from "../src/modules/export/import-plan";

async function main() {
  const inquiry = await prisma.inquiry.findUnique({ where: { key: "PRE-1001" } });
  const dev = await prisma.user.findUnique({ where: { email: "dev@clustox.com" } });
  if (!inquiry || !dev) throw new Error("missing fixtures");

  // 1. Export current plan
  const { buffer } = await buildInquiryWorkbook(inquiry.id);

  // 2. Edit the Release Plan sheet (simulate admin editing in Excel)
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const ws = wb.getWorksheet("Release Plan")!;
  const header: Record<string, number> = {};
  ws.getRow(1).eachCell((c, col) => (header[String(c.value)] = col));
  // Change sprint 1 (row 2): PM -> 2.0 FTE, release group label
  ws.getRow(2).getCell(header["PM"]).value = 2;
  ws.getRow(2).getCell(header["Release Group"]).value = "Release 1 (edited in Excel)";
  const edited = Buffer.from(await wb.xlsx.writeBuffer());

  // 3. Import it back
  await importPlanFromWorkbook(inquiry.id, edited, dev.id);

  // 4. Verify
  const plan = await prisma.projectPlan.findUnique({
    where: { inquiryId: inquiry.id },
    include: { sprints: { include: { allocations: true }, orderBy: { order: "asc" } } },
  });
  const s1 = plan!.sprints[0];
  const pmFte = s1.allocations.find((a) => a.role === "PM")?.fteFraction;
  console.log("sprints after import:", plan!.sprints.length);
  console.log("sprint1 releaseGroup:", s1.releaseGroup);
  console.log("sprint1 PM FTE:", pmFte);
  const ok = s1.releaseGroup === "Release 1 (edited in Excel)" && pmFte === 2;
  console.log("IMPORT ROUND-TRIP:", ok ? "PASS ✓" : "FAIL ✗");
  process.exit(ok ? 0 : 1);
}

main().finally(() => prisma.$disconnect());
