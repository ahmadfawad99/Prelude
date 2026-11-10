export const dynamic = "force-dynamic";

import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { listClients } from "@/modules/clients/service";
import { createClientAction } from "../inquiries/actions";

export default async function ClientsPage() {
  const clients = await listClients();

  return (
    <AppShell>
      <h1 className="mb-5 text-xl font-semibold">Clients</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {clients.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              No clients yet. Add one on the right.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Name</th>
                    <th className="px-4 py-2.5 font-semibold">Domain</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Inquiries</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clients.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/50">
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2 font-medium">
                          <Avatar name={c.name} size={24} /> {c.name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.domain ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{c._count.inquiries}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <section className="h-fit rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Add client</h2>
          <form action={createClientAction} className="space-y-3">
            <input name="name" required placeholder="Client name" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            <input name="domain" placeholder="example.com" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            <textarea name="notes" rows={3} placeholder="Notes (optional)" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            <SubmitButton className="btn-primary w-full" pendingText="Adding…">Add client</SubmitButton>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
