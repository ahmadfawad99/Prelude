"use client";

import { useFormStatus } from "react-dom";

type Action = (formData: FormData) => void | Promise<void>;

export function SubmitButton({
  children,
  pendingText,
  className = "btn-primary",
  formAction,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  formAction?: Action;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={pending}
      className={`${className} ${pending ? "cursor-wait opacity-80" : ""}`}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Spinner />
          {pendingText ?? "Working…"}
        </span>
      ) : (
        children
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
