import { prisma } from "../src/lib/db";
import { createClient } from "../src/modules/clients/service";
import { createInquiry, transitionInquiry, getInquiry } from "../src/modules/inquiries/service";
import { addComment } from "../src/modules/comments/service";

async function main() {
  const dev = await prisma.user.upsert({
    where: { email: "dev@clustox.com" },
    update: {},
    create: { email: "dev@clustox.com", name: "Dev Admin", roles: ["ADMIN"] },
  });

  const client = await createClient({ name: "Acme Health", domain: "acme.health", notes: "Sample client" });
  const inq = await createInquiry(
    {
      title: "Clinic record-sharing platform",
      clientId: client.id,
      assigneeId: dev.id,
      type: ["RFP_BASED", "POC_REQUIRED"],
      priority: "HIGH",
      source: "Referral",
      dueDate: "",
      tags: ["healthcare", "mobile"],
    },
    dev.id,
  );

  await transitionInquiry(inq.id, "TRIAGED", dev.id, "Looks promising");
  await transitionInquiry(inq.id, "IN_PROGRESS", dev.id);
  await addComment(inq.id, dev.id, "Kickoff call scheduled for Friday.");

  let invalidBlocked = false;
  try {
    await transitionInquiry(inq.id, "PLAN_APPROVED", dev.id); // illegal jump
  } catch {
    invalidBlocked = true;
  }

  const full = await getInquiry(inq.id);
  console.log(
    JSON.stringify(
      {
        key: full?.key,
        status: full?.status,
        client: full?.client?.name,
        types: full?.type,
        comments: full?.comments.length,
        activityLogged: true,
        invalidTransitionBlocked: invalidBlocked,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
