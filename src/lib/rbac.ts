import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { getCurrentUser } from "@/lib/session";

export function hasRole(roles: Role[] | undefined, ...allowed: Role[]): boolean {
  if (!roles) return false;
  return roles.some((r) => allowed.includes(r));
}

/**
 * Throws if the current user lacks all of the allowed roles. Admins always pass.
 * Uses getCurrentUser() (not auth() directly) so it honors the dev-auth bypass —
 * otherwise every role-gated action throws FORBIDDEN in local/dev mode.
 */
export async function requireRole(...allowed: Role[]) {
  const user = await getCurrentUser();
  const roles = user?.roles;
  if (!roles || (!roles.includes("ADMIN") && !hasRole(roles, ...allowed))) {
    throw new Error("FORBIDDEN");
  }
  return user!;
}

/** Returns the current session or throws if unauthenticated. */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHENTICATED");
  return session;
}
