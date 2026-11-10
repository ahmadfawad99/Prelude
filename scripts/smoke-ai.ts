import { getProvider } from "../src/modules/ai";

const TRANSCRIPT = `
Sales call with Northwind Retail, 2026-10-21.
Client: We're drowning in manual order reconciliation across 12 stores. Our team spends 3 days each month matching payments to orders in spreadsheets.
Us: What does the current tooling look like?
Client: Mostly Excel and a legacy POS export. No single view. Errors cost us about $4k/month in missed refunds.
Client: We'd love a dashboard that pulls it together and flags mismatches automatically. Mobile access for store managers would be a big plus.
Us: Timeline?
Client: We'd like a POC in 6 weeks, and go-live before the holiday season. Budget is flexible if the ROI is clear.
Action: We'll send an RFP response and schedule a technical deep-dive next week with their CTO, Priya.
`;

async function main() {
  const provider = getProvider();
  console.log("Provider selected:", provider.name);
  const t0 = Date.now();
  const result = await provider.generateSummary(TRANSCRIPT);
  console.log(`Generated in ${((Date.now() - t0) / 1000).toFixed(1)}s via ${result.provider}/${result.model}`);
  console.log(JSON.stringify(result.output, null, 2));
  console.log("tokens:", result.tokensCost);
}

main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  process.exit(1);
});
