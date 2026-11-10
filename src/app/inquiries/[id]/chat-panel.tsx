"use client";

import { useEffect, useOptimistic, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { sendChatAction } from "../actions";
import { useArtifact, type ArtifactId } from "@/components/notebook-shell";
import { MermaidView } from "./diagram-view";

export interface ChatMsg {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  action: string | null;
}

// Empty-state prompts — only real things this workspace can do.
const STARTERS = [
  "Analyze the sources into a brief",
  "Generate the Work Breakdown",
  "Approve the WBS and build the plan",
  "Draw a flow diagram of the solution",
];

// Contextual follow-ups shown under the latest answer.
const FOLLOWUPS = [
  "What are the main risks?",
  "Generate the Work Breakdown",
  "Draft the release plan",
  "Draw a flow diagram",
];

/** Which artifact a chat action maps to (for the "View in Studio" chip). */
function artifactForAction(action: string | null): { id: ArtifactId; label: string } | null {
  switch (action) {
    case "generate_wbs":
    case "update_wbs_item":
    case "add_wbs_item":
    case "remove_wbs_item":
      return { id: "estimates", label: "Work Breakdown" };
    case "generate_plan":
      return { id: "plan", label: "Release plan" };
    case "regenerate_analysis":
      return { id: "analysis", label: "Analysis brief" };
    case "generate_diagram":
      return { id: "diagram", label: "Flow diagram" };
    default:
      return null;
  }
}

// Large / visual outputs that open in the popup instead of filling the chat.
// (Textual ones — the analysis brief — render inline; see Message.)
const CARD_META: Record<string, { id: ArtifactId; title: string; tint: string; icon: string }> = {
  generate_wbs: { id: "estimates", title: "Work Breakdown", tint: "bg-violet-500/15 text-violet-300", icon: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" },
  generate_plan: { id: "plan", title: "Release plan", tint: "bg-emerald-500/15 text-emerald-300", icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" },
  generate_diagram: { id: "diagram", title: "Flow diagram", tint: "bg-cyan-500/15 text-cyan-300", icon: "M5 3h5v5H5zM14 16h5v5h-5zM7.5 8v4a2 2 0 002 2h4.5M16.5 16v-2" },
};

export function ChatPanel({
  inquiryId,
  messages,
  sourceCount,
}: {
  inquiryId: string;
  messages: ChatMsg[];
  sourceCount: number;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const { open, setOpen } = useArtifact();

  const [optimistic, addOptimistic] = useOptimistic<ChatMsg[], string>(
    messages,
    (state, content) => [...state, { id: `temp-${Date.now()}`, role: "USER", content, action: null }],
  );

  const scrollToEnd = () => endRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => {
    scrollToEnd();
  }, [optimistic.length]);

  // Auto-open the popup when a fresh generation lands. We baseline to the last
  // message on mount so loading a lead with past generations doesn't pop a modal;
  // only a NEW artifact card (arriving after a send) opens its view — and only
  // when no popup is already open (so we never yank a popup the user is using).
  const openRef = useRef(open);
  openRef.current = open;
  const seenLastId = useRef<string | null>(null);
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    if (seenLastId.current === null) {
      seenLastId.current = last.id; // baseline — don't open on initial load
      return;
    }
    if (last.id !== seenLastId.current) {
      seenLastId.current = last.id;
      if (last.role === "ASSISTANT" && last.action && CARD_META[last.action] && openRef.current === null) {
        setOpen(CARD_META[last.action].id);
      }
    }
  }, [messages, setOpen]);

  const submitPrompt = (text: string) => {
    if (inputRef.current) inputRef.current.value = text;
    formRef.current?.requestSubmit();
  };

  const empty = optimistic.length === 0;
  const lastAssistantId = [...optimistic].reverse().find((m) => m.role === "ASSISTANT")?.id ?? null;

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        const content = ((formData.get("message") as string) ?? "").trim();
        if (content) addOptimistic(content);
        await sendChatAction(formData);
      }}
      className="flex h-full flex-col"
      onSubmit={() => {
        requestAnimationFrame(() => {
          scrollToEnd();
          if (inputRef.current) {
            inputRef.current.value = "";
            inputRef.current.style.height = "auto";
          }
        });
      }}
    >
      <input type="hidden" name="inquiryId" value={inquiryId} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {empty ? (
          <EmptyState onPick={submitPrompt} />
        ) : (
          <div className="mx-auto max-w-3xl space-y-7 py-2 pb-6">
            {optimistic.map((m) => (
              <Message
                key={m.id}
                msg={m}
                isLastAssistant={m.id === lastAssistantId}
                onPickFollowup={submitPrompt}
              />
            ))}
            <Thinking onShow={scrollToEnd} />
          </div>
        )}
        <div ref={endRef} />
      </div>

      <Composer inputRef={inputRef} formRef={formRef} sourceCount={sourceCount} />
    </form>
  );
}

/* ---------------- Empty state (NotebookLM-style) ---------------- */

function EmptyState({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col justify-center py-10">
      <div className="animate-rise">
        <div className="mb-5 text-5xl">👋</div>
        <h2 className="text-3xl font-bold tracking-tight">Let&apos;s dig into this lead…</h2>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Ask anything about the sources, or tell me to run a task — I can analyze the brief, build the Work
          Breakdown, cost the release plan, draw a flow diagram, set dates, reassign, or approve the estimates.
          Everything shows up right here in the chat.
        </p>
        <div className="mt-7 flex flex-col items-start gap-2.5">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              className="group flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground/90 shadow-sm transition hover:border-primary/50 hover:bg-muted"
            >
              {s}
              <svg className="text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M9 7h8v8" /></svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Messages ---------------- */

function AssistantAvatar() {
  return (
    <div className="grad-fill flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-sm shadow-primary/20">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.09 6.26L20 10l-5 3.5L16.5 20 12 16.5 7.5 20 9 13.5 4 10l5.91-.74z" /></svg>
    </div>
  );
}

/** Flatten a ReactMarkdown code node's children to a plain string. */
function nodeText(children: unknown): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(nodeText).join("");
  if (children && typeof children === "object" && "props" in (children as Record<string, unknown>)) {
    return nodeText((children as { props?: { children?: unknown } }).props?.children);
  }
  return "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MD_COMPONENTS: Record<string, any> = {
  // Render ```mermaid fences as live diagrams; everything else as a normal <pre>.
  pre({ children }: { children: ReactNode }) {
    const child = Array.isArray(children) ? children[0] : children;
    const cls = (child as { props?: { className?: string } })?.props?.className ?? "";
    if (typeof cls === "string" && cls.includes("language-mermaid")) {
      const code = nodeText((child as { props?: { children?: unknown } }).props?.children).replace(/\n$/, "");
      return (
        <div className="my-3 overflow-x-auto rounded-xl border border-border bg-card/60 p-3">
          <MermaidView code={code} />
        </div>
      );
    }
    return <pre className="my-2 overflow-x-auto rounded-lg border border-border bg-muted p-3 text-xs">{children}</pre>;
  },
};

function Message({
  msg,
  isLastAssistant,
  onPickFollowup,
}: {
  msg: ChatMsg;
  isLastAssistant: boolean;
  onPickFollowup: (t: string) => void;
}) {
  if (msg.role === "USER") {
    return (
      <div className="animate-rise flex justify-end">
        <div className="chat-bubble-user max-w-[82%] whitespace-pre-wrap rounded-2xl rounded-br-md px-4 py-2.5 text-sm font-medium">
          {msg.content}
        </div>
      </div>
    );
  }

  const card = msg.action ? CARD_META[msg.action] : undefined;
  const artifact = artifactForAction(msg.action);

  return (
    <div className="animate-rise flex gap-3">
      <AssistantAvatar />
      <div className="min-w-0 flex-1">
        {card ? (
          <ArtifactCard meta={card} summary={msg.content} />
        ) : (
          <>
            <div className="prose-chat text-[15px] leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                {msg.content}
              </ReactMarkdown>
            </div>
            <ActionRow content={msg.content} artifact={artifact} />
          </>
        )}

        {isLastAssistant && (
          <div className="mt-4 flex flex-wrap gap-2">
            {FOLLOWUPS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onPickFollowup(f)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition hover:border-primary/50 hover:text-primary"
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** A compact result card for a large output — opens the full view in the popup. */
function ArtifactCard({ meta, summary }: { meta: { id: ArtifactId; title: string; tint: string; icon: string }; summary: string }) {
  const { setOpen } = useArtifact();
  return (
    <button
      type="button"
      onClick={() => setOpen(meta.id)}
      className="nb-card group flex w-full items-center gap-3 p-3 text-left transition hover:bg-muted"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${meta.tint}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={meta.icon} /></svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{meta.title}</span>
        <span className="block truncate text-xs text-muted-foreground">{summary}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition group-hover:border-primary/50 group-hover:text-primary">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /></svg>
        View
      </span>
    </button>
  );
}

/** Copy + (for generated artifacts) a View-in-Studio chip, under each answer. */
function ActionRow({
  content,
  artifact,
}: {
  content: string;
  artifact: { id: ArtifactId; label: string } | null;
}) {
  const { setOpen } = useArtifact();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  return (
    <div className="mt-2 flex items-center gap-1">
      <button
        type="button"
        onClick={copy}
        title="Copy"
        className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        {copied ? (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            Copied
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
            Copy
          </>
        )}
      </button>

      {artifact && (
        <button
          type="button"
          onClick={() => setOpen(artifact.id)}
          title={`Open ${artifact.label} in Studio`}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-primary transition hover:bg-muted"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /></svg>
          Open in Studio
        </button>
      )}
    </div>
  );
}

/** Assistant "thinking" row, shown only while the form is pending. */
function Thinking({ onShow }: { onShow?: () => void }) {
  const { pending } = useFormStatus();
  useEffect(() => {
    if (pending) onShow?.();
  }, [pending, onShow]);
  if (!pending) return null;
  return (
    <div className="animate-rise flex items-center gap-3">
      <AssistantAvatar />
      <div className="flex items-center gap-1.5 py-1">
        <span className="dotpulse h-2 w-2 rounded-full bg-primary" style={{ animationDelay: "0ms" }} />
        <span className="dotpulse h-2 w-2 rounded-full bg-primary" style={{ animationDelay: "160ms" }} />
        <span className="dotpulse h-2 w-2 rounded-full bg-primary" style={{ animationDelay: "320ms" }} />
      </div>
    </div>
  );
}

/* ---------------- Composer ---------------- */

function Composer({
  inputRef,
  formRef,
  sourceCount,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  formRef: React.RefObject<HTMLFormElement | null>;
  sourceCount: number;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl shrink-0 pt-2">
      <div className="ring-focus flex items-end gap-2 rounded-[22px] border border-border bg-card p-2 pl-4 shadow-sm transition">
        <textarea
          ref={inputRef}
          name="message"
          rows={1}
          required
          placeholder="Ask a question or tell me to create something…"
          className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-sm focus:outline-none"
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
        />
        <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {sourceCount} source{sourceCount === 1 ? "" : "s"}
        </span>
        <SendButton />
      </div>
      <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
        Grounded in this lead&apos;s sources · analyses, estimates, plans &amp; diagrams appear in the chat and save to Studio
      </p>
    </div>
  );
}

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`btn-send flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${pending ? "cursor-wait opacity-70" : ""}`}
      aria-label="Send"
    >
      {pending ? <Spinner /> : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
      )}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
