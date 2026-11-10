"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { addCommentAction } from "../actions";

export interface CommentItem {
  id: string;
  authorName: string;
  authorEmail: string | null;
  body: string;
  createdAt: string;
}
export interface HistoryItem {
  id: string;
  actorName: string;
  action: string;
  createdAt: string;
}

type Tab = "all" | "comments" | "history" | "worklog";

export function ActivityTabs({
  inquiryId,
  comments,
  history,
}: {
  inquiryId: string;
  comments: CommentItem[];
  history: HistoryItem[];
}) {
  const [tab, setTab] = useState<Tab>("comments");

  const tabs: { id: Tab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "comments", label: "Comments" },
    { id: "history", label: "History" },
    { id: "worklog", label: "Work log" },
  ];

  const showComments = tab === "all" || tab === "comments";
  const showHistory = tab === "all" || tab === "history";

  return (
    <div>
      <div className="mb-3 flex items-center gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium transition ${
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {showComments && (
        <form action={addCommentAction} className="mb-4 flex gap-2">
          <input type="hidden" name="inquiryId" value={inquiryId} />
          <div className="flex-1">
            <textarea
              name="body"
              required
              rows={2}
              placeholder="Add a comment…  (use @ to mention)"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <div className="mt-1.5">
              <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:brightness-110">
                Comment
              </button>
            </div>
          </div>
        </form>
      )}

      <ul className="space-y-4">
        {showComments &&
          comments.map((c) => (
            <li key={`c-${c.id}`} className="flex gap-3">
              <Avatar name={c.authorName} email={c.authorEmail} size={28} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-foreground">{c.authorName}</span>
                  <span className="text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.body}</p>
              </div>
            </li>
          ))}

        {showHistory &&
          history.map((h) => (
            <li key={`h-${h.id}`} className="flex gap-2 text-xs text-muted-foreground">
              <span className="w-28 shrink-0">{formatDateTime(h.createdAt)}</span>
              <span>
                <span className="font-medium text-foreground">{h.actorName}</span> {h.action.replace(/_/g, " ")}
              </span>
            </li>
          ))}

        {tab === "worklog" && <li className="text-sm text-muted-foreground">No work logged.</li>}
        {showComments && comments.length === 0 && tab === "comments" && (
          <li className="text-sm text-muted-foreground">No comments yet.</li>
        )}
      </ul>
    </div>
  );
}
