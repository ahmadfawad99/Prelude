import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authConfig } from "@/auth.config";

const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN?.trim();

// Local-only bypass: when DEV_AUTH=true (never set in production) the app treats
// the visitor as a seeded ADMIN and the middleware skips the auth gate, so the
// app is usable without Google sign-in. Real auth is untouched for when it's on.
// Gated solely on the DEV_AUTH flag so it also works under `next start` (local
// demo). Keep DEV_AUTH unset/false on any real deployment.
export const devAuthEnabled = process.env.DEV_AUTH === "true";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ profile, user }) {
      const email = profile?.email ?? user?.email ?? undefined;
      if (allowedDomain && email && !email.endsWith(`@${allowedDomain}`)) {
        return false; // reject sign-ups outside the allowed domain
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.uid = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { roles: true },
        });
        token.roles = dbUser?.roles ?? ["VIEWER"];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? session.user.id;
        session.user.roles = (token.roles as Role[]) ?? [];
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Bootstrap: the very first user becomes ADMIN; everyone else is VIEWER
      // until an admin elevates them.
      const count = await prisma.user.count();
      if (count === 1 && user.id) {
        await prisma.user.update({ where: { id: user.id }, data: { roles: ["ADMIN"] } });
      }
    },
  },
});
