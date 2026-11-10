import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Computed inline (not imported from auth.ts) to keep Prisma out of the edge bundle.
const devAuth = process.env.DEV_AUTH === "true";

const { auth } = NextAuth(authConfig);

// In dev-bypass mode, let every request through; otherwise enforce the auth gate.
export default devAuth ? () => NextResponse.next() : auth;

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
