import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { generateOverviewAction } from "./actions";

export function OverviewTab({
  inquiryId,
  overview,
  hasPlan,
}: {
  inquiryId: string;
  overview: string | null;
  hasPlan: boolean;
}) {
  if (!hasPlan) {
    return (
      <div className="card max-w-2xl p-5 text-sm text-muted-foreground">
        Generate the Release Plan first — the overview pulls estimates, team, costing and timeline from it.{" "}
        <Link href={`/inquiries/${inquiryId}/plan`} className="text-primary underline">Open plan →</Link>
      </div>
    );
  }
  if (!overview) {
    return (
      <div className="card max-w-2xl p-5">
        <p className="text-sm text-muted-foreground">
          Generate a client-facing executive overview: executive summary, main epics &amp; features, estimates, team, costing, and timeline.
        </p>
        <form action={generateOverviewAction} className="mt-3">
          <input type="hidden" name="inquiryId" value={inquiryId} />
          <SubmitButton pendingText="Generating overview… (~10s)">Generate overview</SubmitButton>
        </form>
      </div>
    );
  }
  return (
    <div>
      <div className="prose-brief card p-6">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{overview}</ReactMarkdown>
      </div>
      <form action={generateOverviewAction} className="mt-3">
        <input type="hidden" name="inquiryId" value={inquiryId} />
        <SubmitButton className="btn-secondary" pendingText="Regenerating… (~10s)">Regenerate overview</SubmitButton>
      </form>
    </div>
  );
}
