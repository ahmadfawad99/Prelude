export const dynamic = "force-dynamic";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { listClients } from "@/modules/clients/service";
import { listUsers } from "@/modules/users/service";
import { INQUIRY_TYPES, PRIORITIES } from "@/modules/inquiries/schema";
import { TYPE_LABELS, PRIORITY_LABELS } from "@/lib/format";
import { SubmitButton } from "@/components/submit-button";
import { createInquiryAction } from "../actions";

export default async function NewInquiryPage() {
  const [clients, users] = await Promise.all([listClients(), listUsers()]);

  return (
    <AppShell>
      <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/inquiries" className="hover:text-foreground">Inquiries</Link>
        <span>/</span>
        <span className="text-foreground">Create</span>
      </div>
      <h1 className="mb-5 text-xl font-semibold">Create inquiry</h1>

      <form action={createInquiryAction} className="max-w-2xl rounded-lg border border-border bg-card p-6">
        <div className="space-y-5">
          <Field label="Summary" required>
            <input name="title" required placeholder="e.g. Clinic record-sharing platform"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Client">
              <input
                name="clientName"
                list="client-suggestions"
                placeholder="Type the client name…"
                autoComplete="off"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
              <datalist id="client-suggestions">
                {clients.map((c) => <option key={c.id} value={c.name} />)}
              </datalist>
            </Field>
            <Field label="Assignee">
              <select name="assigneeId" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="">— Unassigned —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Priority">
              <select name="priority" defaultValue="MEDIUM" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
              </select>
            </Field>
            <Field label="Due date">
              <input type="date" name="dueDate" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            </Field>
          </div>

          <Field label="Type">
            <div className="flex flex-wrap gap-2">
              {INQUIRY_TYPES.map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
                  <input type="checkbox" name={`type_${t}`} /> {TYPE_LABELS[t]}
                </label>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Source">
              <input name="source" placeholder="Referral, Upwork, Website…" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            </Field>
            <Field label="Labels (comma-separated)">
              <input name="tags" placeholder="healthcare, mobile" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            </Field>
          </div>
        </div>

        <div className="mt-6 flex gap-2 border-t border-border pt-5">
          <SubmitButton pendingText="Creating…">Create</SubmitButton>
          <Link href="/inquiries" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</Link>
        </div>
      </form>
    </AppShell>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
