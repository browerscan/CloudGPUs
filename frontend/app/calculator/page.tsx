import type { Metadata } from "next";
import Link from "next/link";
import { CALCULATOR_PAGES } from "@/lib/pseo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "GPU cloud calculators",
  description:
    "Tools for estimating GPU cloud spend, selecting GPUs by budget/VRAM, and comparing ROI across providers.",
  alternates: { canonical: "/calculator" },
};

export default function CalculatorHubPage() {
  return (
    <div className="container">
      <div className="card" style={{ padding: 22 }}>
        <h1 style={{ marginTop: 0 }}>GPU cloud calculators</h1>
        <p className="muted" style={{ maxWidth: 920, lineHeight: 1.7 }}>
          These tools help you translate hourly prices into real spend. Use the cost estimator for
          quick training run planning, the GPU selector to find options by VRAM and budget, and the
          ROI calculator to sanity‑check savings vs hyperscalers or reserved commitments.
        </p>
      </div>

      <section style={{ marginTop: 18 }}>
        <h2 style={{ margin: "12px 0" }}>Tools</h2>
        <div className="grid grid3">
          {CALCULATOR_PAGES.map((c) => (
            <Link
              key={c.slug}
              href={`/calculator/${c.slug}`}
              className="card"
              style={{ padding: 18 }}
            >
              <div style={{ fontWeight: 800 }}>{c.name}</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>
                {c.summary}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Related pages</h2>
        <div className="muted" style={{ lineHeight: 1.8 }}>
          <div>
            Looking for raw pricing? Browse <Link href="/cloud-gpu">GPU pricing pages</Link>.
          </div>
          <div>
            Choosing hardware for a workload? Start with{" "}
            <Link href="/best-gpu-for">use case guides</Link>.
          </div>
        </div>
      </section>
    </div>
  );
}
