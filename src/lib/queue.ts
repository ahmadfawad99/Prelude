import { Queue } from "bullmq";
import IORedis from "ioredis";

// Shared Redis connection for BullMQ (lazily created).
const globalForQueue = globalThis as unknown as {
  connection?: IORedis;
  queues?: Map<string, Queue>;
};

export function getConnection(): IORedis {
  if (!globalForQueue.connection) {
    globalForQueue.connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
    });
  }
  return globalForQueue.connection;
}

// Named queues used by the worker process.
export const QUEUES = {
  AI_SUMMARY: "ai-summary",
  AI_WBS: "ai-wbs",
  PLAN_SEED: "plan-seed",
  EXPORT: "export",
  GMAIL_SYNC: "gmail-sync",
  NOTIFY: "notify",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export function getQueue(name: QueueName): Queue {
  if (!globalForQueue.queues) globalForQueue.queues = new Map();
  let q = globalForQueue.queues.get(name);
  if (!q) {
    q = new Queue(name, { connection: getConnection() });
    globalForQueue.queues.set(name, q);
  }
  return q;
}
