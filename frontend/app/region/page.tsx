import type { Metadata } from "next";
import Link from "next/link";
import { REGION_PAGES } from "@/lib/pseo";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "GPU cloud regions",
  description:
    "Browse region landing pages to find GPU cloud providers with capacity in your target geography (US East, Europe, APAC).",
  alternates: { canonical: "/region" },
};

export default function RegionHubPage() {
  return (
    <div className="container">
      <div className="card" style={{ padding: 22 }}>
        <h1 style={{ marginTop: 0 }}>GPU cloud regions</h1>
        <p className="muted" style={{ maxWidth: 920, lineHeight: 1.7 }}>
          Region matters for latency, compliance, and availability. These pages help you find
          providers with capacity in a specific geography. If you are training large models, also
          consider data egress costs, network topology for distributed training, and whether the
          provider offers predictable scaling in your target region.
        </p>
      </div>

      <section style={{ marginTop: 18 }}>
        <h2 style={{ margin: "12px 0" }}>Regions</h2>
        <div className="grid grid3">
          {REGION_PAGES.map((r) => (
            <Link key={r.slug} href={`/region/${r.slug}`} className="card" style={{ padding: 18 }}>
              <div style={{ fontWeight: 800 }}>{r.name}</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>
                {r.summary}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Related pages</h2>
        <div className="muted" style={{ lineHeight: 1.8 }}>
          <div>
            Need specific hardware? Browse <Link href="/cloud-gpu">GPU pricing pages</Link>.
          </div>
          <div>
            Evaluating providers? Use <Link href="/provider">provider hub</Link> and{" "}
            <Link href="/compare">comparisons</Link>.
          </div>
        </div>
      </section>
    </div>
  );
}
