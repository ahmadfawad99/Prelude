"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { InquiryStatus, Priority } from "@prisma/client";
import { STATUS_LABELS, formatDate } from "@/lib/format";
import { canTransition, BOARD_COLUMNS } from "@/modules/inquiries/state-machine";
import { Avatar, LabelChip, PriorityIcon, KeyTag } from "@/components/ui";
import { moveInquiryAction } from "@/app/board/actions";

export interface BoardCard {
  id: string;
  key: string;
  title: string;
  status: InquiryStatus;
  priority: Priority;
  clientName: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  tags: string[];
  dueDate: string | null;
}

const TERMINAL: InquiryStatus[] = ["WON", "LOST", "ARCHIVED"];

export function KanbanBoard({ initialCards }: { initialCards: BoardCard[] }) {
  const router = useRouter();
  const [cards, setCards] = useState<BoardCard[]>(initialCards);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const activeCard = cards.find((c) => c.id === activeId) ?? null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    setError(null);
  }

  async function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    setActiveId(null);
    if (!e.over) return;
    const to = String(e.over.id) as InquiryStatus;
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === to) return;
    if (!canTransition(card.status, to)) {
      setError(`Can't move ${card.key} from ${STATUS_LABELS[card.status]} to ${STATUS_LABELS[to]}.`);
      return;
    }
    const from = card.status;
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status: to } : c)));
    const res = await moveInquiryAction(id, to);
    if (!res.ok) {
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status: from } : c)));
      setError(res.error ?? "Move failed.");
    } else {
      router.refresh();
    }
  }

  return (
    <DndContext id="kanban-board" sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-4">
        {BOARD_COLUMNS.map((status) => (
          <Column
            key={status}
            status={status}
            cards={cards.filter((c) => c.status === status)}
            isValidTarget={activeCard ? canTransition(activeCard.status, status) : null}
            isSource={activeCard?.status === status}
          />
        ))}
      </div>
    </DndContext>
  );
}

function Column({
  status,
  cards,
  isValidTarget,
  isSource,
}: {
  status: InquiryStatus;
  cards: BoardCard[];
  isValidTarget: boolean | null;
  isSource: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const dimmed = isValidTarget === false && !isSource;
  return (
    <div
      ref={setNodeRef}
      className={`flex w-[290px] shrink-0 flex-col rounded-xl border border-border/60 bg-muted/40 transition ${
        isOver && isValidTarget ? "ring-2 ring-primary/40 bg-primary/5" : ""
      } ${dimmed ? "opacity-40" : ""}`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {STATUS_LABELS[status]}
        </span>
        <span className="text-[11px] text-muted-foreground">{cards.length}</span>
      </div>
      <div className="flex min-h-[80px] flex-col gap-2 px-2 pb-3">
        {cards.map((c) => (
          <Card key={c.id} card={c} />
        ))}
      </div>
    </div>
  );
}

function Card({ card }: { card: BoardCard }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;
  const overdue =
    card.dueDate && !TERMINAL.includes(card.status) && new Date(card.dueDate).getTime() < Date.now();

  return (
    <div
      ref={setNodeRef}
      style={style}
      suppressHydrationWarning
      {...listeners}
      {...attributes}
      onClick={() => {
        if (!isDragging) router.push(`/inquiries/${card.id}`);
      }}
      className={`card card-i cursor-pointer p-3 active:cursor-grabbing ${
        isDragging ? "opacity-50 shadow-lg" : "card-lift"
      }`}
    >
      <p className="text-sm font-medium leading-snug">{card.title}</p>
      {card.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.tags.slice(0, 3).map((t) => (
            <LabelChip key={t}>{t}</LabelChip>
          ))}
        </div>
      )}
      {card.dueDate && (
        <p className={`mt-2 flex items-center gap-1 text-[11px] ${overdue ? "text-red-600" : "text-muted-foreground"}`}>
          {overdue && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" strokeLinejoin="round" />
            </svg>
          )}
          {formatDate(card.dueDate)}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between">
        <KeyTag>{card.key}</KeyTag>
        <div className="flex items-center gap-2">
          <PriorityIcon priority={card.priority} />
          <Avatar name={card.assigneeName} email={card.assigneeEmail} size={22} />
        </div>
      </div>
    </div>
  );
}
