import type { Role } from "@prisma/client";
import { auth, devAuthEnabled } from "@/auth";
import { prisma } from "@/lib/db";

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  roles: Role[];
}

const DEV_EMAIL = "dev@clustox.com";

/**
 * The single source of truth for "who is the current user" across the app.
 * In dev-bypass mode it returns a seeded ADMIN; otherwise the real Auth.js
 * session. App code should use this instead of calling `auth()` directly.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (devAuthEnabled) {
    const user = await prisma.user.upsert({
      where: { email: DEV_EMAIL },
      update: {},
      create: { email: DEV_EMAIL, name: "Dev Admin", roles: ["ADMIN"] },
    });
    return { id: user.id, email: user.email, name: user.name, roles: user.roles };
  }

  const session = await auth();
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? null,
    roles: session.user.roles ?? [],
  };
}
