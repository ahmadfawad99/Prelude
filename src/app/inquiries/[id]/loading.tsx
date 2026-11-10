export default function Loading() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-background">
      <div className="grad-fill animate-splashpop flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold shadow-lg shadow-primary/30">
        P
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Opening your lead…</p>
      <div className="mt-4 flex gap-1.5">
        <span className="dotpulse h-2 w-2 rounded-full bg-primary" />
        <span className="dotpulse h-2 w-2 rounded-full bg-primary" style={{ animationDelay: "160ms" }} />
        <span className="dotpulse h-2 w-2 rounded-full bg-primary" style={{ animationDelay: "320ms" }} />
      </div>
    </div>
  );
}
