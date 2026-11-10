import { prisma } from "@/lib/db";
import { createClientSchema, type CreateClientInput } from "./schema";

export function listClients() {
  return prisma.client.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { inquiries: true } } },
  });
}

export function getClient(id: string) {
  return prisma.client.findUnique({ where: { id } });
}

/** Resolve a typed client name to a client row, creating it if new. */
export async function findOrCreateClientByName(name: string) {
  const n = name.trim();
  if (!n) return null;
  const existing = await prisma.client.findFirst({ where: { name: n } });
  return existing ?? prisma.client.create({ data: { name: n } });
}

export async function createClient(input: CreateClientInput) {
  const data = createClientSchema.parse(input);
  return prisma.client.create({
    data: {
      name: data.name,
      domain: data.domain || null,
      notes: data.notes || null,
    },
  });
}
