import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { buildInquiryWorkbook } from "@/modules/export/workbook";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  try {
    const { buffer, filename } = await buildInquiryWorkbook(id);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.byteLength),
      },
    });
  } catch (e) {
    console.error("[export] failed", e);
    return new NextResponse("Export failed", { status: 500 });
  }
}
