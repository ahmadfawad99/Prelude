import { prisma } from "@/lib/db";

/** All users, for assignee pickers. */
export function listUsers() {
  return prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, roles: true },
  });
}
