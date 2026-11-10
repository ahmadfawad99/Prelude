import { getWbs } from "@/modules/wbs/service";
import { getPlan } from "@/modules/plans/service";
import { listActiveRates } from "@/modules/rates/service";
import { buildRateMap, derivePlan } from "@/modules/plans/derive";
import { Tabs } from "@/components/tabs";
import { WbsWorkbookTab } from "../wbs/wbs-workbook";
import { OverviewTab } from "./overview-tab";
import { SummaryTab } from "./summary-tab";
import { ReleasePlanTab } from "./release-plan-tab";
import { RatesTab } from "./rates-tab";

export async function PlanWorkbook({
  inquiryId,
  defaultRequirements,
  initialTab,
}: {
  inquiryId: string;
  defaultRequirements: string;
  initialTab?: number;
}) {
  const [wbs, plan, rates] = await Promise.all([getWbs(inquiryId), getPlan(inquiryId), listActiveRates()]);
  const wbsApproved = wbs?.status === "APPROVED";
  const derived = plan ? derivePlan(plan.sprints, buildRateMap(rates), plan.marginPct) : null;

  // Default to the tab that needs attention (WBS until approved, then Release Plan),
  // unless the caller forces a specific tab.
  const initial = initialTab ?? (!wbs || !wbsApproved ? 2 : 3);

  return (
    <Tabs labels={["Overview", "Summary", "WBS", "Release Plan", "Resource Rates"]} initial={initial}>
      <OverviewTab inquiryId={inquiryId} overview={plan?.overview ?? null} hasPlan={!!plan} />
      <SummaryTab
        inquiryId={inquiryId}
        summaryData={plan?.summaryData ?? null}
        derived={derived}
        rfpBudget={wbs?.extractedBudget ?? null}
        rfpTimeline={wbs?.extractedTimeline ?? null}
      />
      <WbsWorkbookTab inquiryId={inquiryId} wbs={wbs} defaultRequirements={defaultRequirements} />
      <ReleasePlanTab inquiryId={inquiryId} plan={plan} rates={rates} derived={derived} wbsApproved={wbsApproved} />
      <RatesTab rates={rates} />
    </Tabs>
  );
}
