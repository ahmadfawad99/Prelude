import type { InquiryStatus } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { createClient } from "../src/modules/clients/service";
import { createInquiry, transitionInquiry } from "../src/modules/inquiries/service";

// Walk an inquiry along a valid path of transitions.
const PATHS: Record<string, InquiryStatus[]> = {
  triaged: ["TRIAGED"],
  inprogress: ["TRIAGED", "IN_PROGRESS"],
  wbs: ["TRIAGED", "IN_PROGRESS", "WBS_DRAFTING"],
  wbsreview: ["TRIAGED", "IN_PROGRESS", "WBS_DRAFTING", "WBS_REVIEW"],
  poc: ["TRIAGED", "IN_PROGRESS", "POC_IN_PROGRESS"],
  plan: ["TRIAGED", "IN_PROGRESS", "WBS_DRAFTING", "WBS_REVIEW", "PLAN_DRAFTING"],
};

async function main() {
  const dev = await prisma.user.upsert({
    where: { email: "dev@clustox.com" },
    update: {},
    create: { email: "dev@clustox.com", name: "Dev Admin", roles: ["ADMIN"] },
  });

  const clients = await Promise.all([
    createClient({ name: "Northwind Retail", domain: "northwind.com", notes: "" }),
    createClient({ name: "Globex Fintech", domain: "globex.io", notes: "" }),
  ]);

  const demos: Array<{ title: string; path: keyof typeof PATHS; client: number; prio: "LOW" | "MEDIUM" | "HIGH" }> = [
    { title: "E-commerce replatform (headless)", path: "triaged", client: 0, prio: "MEDIUM" },
    { title: "Loyalty mobile app", path: "inprogress", client: 0, prio: "HIGH" },
    { title: "KYC onboarding automation", path: "wbs", client: 1, prio: "HIGH" },
    { title: "Payments reconciliation dashboard", path: "wbsreview", client: 1, prio: "MEDIUM" },
    { title: "AI support assistant POC", path: "poc", client: 1, prio: "LOW" },
    { title: "Warehouse inventory portal", path: "plan", client: 0, prio: "MEDIUM" },
  ];

  for (const d of demos) {
    const inq = await createInquiry(
      {
        title: d.title,
        clientId: clients[d.client].id,
        assigneeId: dev.id,
        type: ["RFP_BASED"],
        priority: d.prio,
        source: "Demo",
        dueDate: "",
        tags: [],
      },
      dev.id,
    );
    for (const step of PATHS[d.path]) {
      await transitionInquiry(inq.id, step, dev.id);
    }
    console.log(`${inq.key}  ${d.path.padEnd(10)}  ${d.title}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
