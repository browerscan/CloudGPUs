import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "GPU cloud ROI calculator",
  description:
    "Estimate ROI and savings when switching providers or using spot/preemptible and reserved pricing.",
  alternates: { canonical: "/calculator/roi-calculator" },
};

export default function RoiCalculatorPage() {
  return (
    <div className="container">
      <div className="card" style={{ padding: 22 }}>
        <h1 style={{ marginTop: 0 }}>GPU cloud ROI calculator</h1>
        <p className="muted" style={{ maxWidth: 980, lineHeight: 1.7 }}>
          ROI depends on more than hourly price. Faster networking can reduce training time, and
          higher availability can reduce idle engineer time. Use this page as a checklist: compare
          hourly rates, model the expected runtime, and account for hidden costs like egress and
          storage. For large workloads, even a 10–20% runtime reduction can outweigh a higher
          $/GPU‑hour rate.
        </p>

        <section className="card" style={{ marginTop: 18, padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>ROI checklist</h2>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            <div>• Compare $/GPU‑hour for the same GPU model and variant (SXM vs PCIe).</div>
            <div>
              • Estimate runtime differences from networking (NVLink/InfiniBand) and CPU/RAM.
            </div>
            <div>• Include spot interruption overhead (checkpointing + retries).</div>
            <div>• Include egress + storage for datasets and checkpoints.</div>
            <div>• Prefer providers with clearer SLAs for production inference.</div>
          </div>
        </section>

        <section className="card" style={{ marginTop: 18, padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Related pages</h2>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            <div>
              Compare providers: <Link href="/compare">comparisons</Link>
            </div>
            <div>
              Browse providers: <Link href="/provider">provider hub</Link>
            </div>
            <div>
              Estimate spend: <Link href="/calculator/cost-estimator">cost estimator</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
