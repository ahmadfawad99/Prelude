import { getProvider } from "../src/modules/ai";

const REQS = `
Build a secure medical record-sharing platform for a network of 8 clinics (Acme Health).
- Vets upload patient records via a secure tokenized link (no account needed).
- Admin dashboard to track every record request with status and audit trail (HIPAA).
- Mobile app for field staff to view/request records.
- Backend API with authentication, RBAC, and notifications.
- Phased rollout: POC in 6 weeks, then Release 1 and Release 2.
`;

async function main() {
  const provider = getProvider();
  console.log("Provider:", provider.name);
  const t0 = Date.now();
  const result = await provider.generateWbs(REQS);
  const items = result.output.items;
  console.log(`Generated ${items.length} items in ${((Date.now() - t0) / 1000).toFixed(1)}s via ${result.provider}/${result.model}`);
  const sp = items.reduce((a, b) => a + (b.storyPoints ?? 0), 0);
  const hrs = items.reduce((a, b) => a + (b.hours ?? 0), 0);
  const modules = [...new Set(items.map((i) => i.module).filter(Boolean))];
  console.log(`Modules: ${modules.join(", ")}`);
  console.log(`Totals: ${sp} story points, ${hrs} hours`);
  console.log("Sample items:");
  for (const it of items.slice(0, 5)) {
    console.log(`  [${it.module}] ${it.epic} > ${it.feature} (${it.storyPoints}sp/${it.hours}h, ${it.priority}, ${it.release})`);
  }
  console.log("tokens:", result.tokensCost);
}

main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  process.exit(1);
});
