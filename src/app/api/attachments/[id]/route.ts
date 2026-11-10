import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getAttachment } from "@/modules/attachments/service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const result = await getAttachment(id);
  if (!result) return new NextResponse("Not found", { status: 404 });

  const { att, data } = result;
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": att.mime,
      "Content-Disposition": `inline; filename="${encodeURIComponent(att.filename)}"`,
      "Content-Length": String(att.size),
    },
  });
}
