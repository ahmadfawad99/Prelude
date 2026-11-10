import { Worker } from "bullmq";
import { getConnection, QUEUES } from "@/lib/queue";

/**
 * Background worker process (run separately: `npm run worker`).
 * Milestone 0 registers placeholder processors; real jobs (AI summary, WBS,
 * plan seed, export, gmail sync, notify) land in their respective milestones.
 */
const connection = getConnection();

const workers = Object.values(QUEUES).map(
  (name) =>
    new Worker(
      name,
      async (job) => {
        console.log(`[worker:${name}] processing job ${job.id}`, job.data);
        // TODO: dispatch to the module handler for this queue.
        return { ok: true };
      },
      { connection },
    ),
);

for (const w of workers) {
  w.on("failed", (job, err) => console.error(`[worker:${w.name}] job ${job?.id} failed`, err));
}

console.log(`Worker started. Listening on queues: ${Object.values(QUEUES).join(", ")}`);

async function shutdown() {
  console.log("Shutting down workers...");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
