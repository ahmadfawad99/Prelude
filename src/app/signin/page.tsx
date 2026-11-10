import Link from "next/link";
import { signIn, devAuthEnabled } from "@/auth";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="grad-fill mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-2xl font-bold shadow-lg shadow-primary/30">P</div>
        <h1 className="text-2xl font-bold tracking-tight">Prelude</h1>
        <p className="mt-1 text-sm text-muted-foreground">from lead to plan · sign in to continue</p>
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Continue with Google
          </button>
        </form>
        <p className="mt-4 text-xs text-muted-foreground">
          Only @clustox.com accounts are allowed.
        </p>

        {devAuthEnabled && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              local only
              <span className="h-px flex-1 bg-border" />
            </div>
            <Link
              href="/"
              className="block w-full rounded-lg border border-border px-4 py-2.5 text-center text-sm font-medium transition hover:bg-muted"
            >
              Enter app (dev mode, ADMIN)
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
