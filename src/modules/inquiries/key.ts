import { prisma } from "@/lib/db";

const KEY_PREFIX = "PSD";
const KEY_START = 1000;

/**
 * Atomically allocate the next human-friendly inquiry key (PRE-1001, ...).
 * Uses a Counter row incremented inside a transaction to avoid races.
 */
export async function getNextInquiryKey(): Promise<string> {
  const counter = await prisma.counter.upsert({
    where: { name: "inquiry" },
    create: { name: "inquiry", value: KEY_START + 1 },
    update: { value: { increment: 1 } },
  });
  return `${KEY_PREFIX}-${counter.value}`;
}
