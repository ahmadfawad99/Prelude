export const dynamic = "force-dynamic";

import { AppShell } from "@/components/app-shell";
import { KanbanBoard, type BoardCard } from "@/components/kanban-board";
import { listInquiries } from "@/modules/inquiries/service";

export default async function BoardPage() {
  const inquiries = await listInquiries();

  const cards: BoardCard[] = inquiries.map((i) => ({
    id: i.id,
    key: i.key,
    title: i.title,
    status: i.status,
    priority: i.priority,
    clientName: i.client?.name ?? null,
    assigneeName: i.assignee?.name ?? null,
    assigneeEmail: i.assignee?.email ?? null,
    tags: i.tags,
    dueDate: i.dueDate ? i.dueDate.toISOString() : null,
  }));

  return (
    <AppShell fullWidth>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Board</h1>
        <p className="text-sm text-muted-foreground">Drag cards across the pipeline — only valid moves are allowed.</p>
      </div>
      <KanbanBoard initialCards={cards} />
    </AppShell>
  );
}
