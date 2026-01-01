import type { Metadata } from "next";
import Link from "next/link";
import { CompareBuilder } from "@/components/CompareBuilder";
import { listGpuModels, listProviders } from "@/lib/api";
import { seoGpuSlug } from "@/lib/aliases";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Compare GPU clouds and GPUs",
  description:
    "Compare GPU cloud providers (pricing + features) or compare two GPUs (specs + live price ranges). Includes verdicts, tables, and internal links to detail pages.",
  alternates: { canonical: "/compare" },
};

const FEATURED_PROVIDER_COMPARISONS = (
  [
    ["lambda-labs", "runpod"],
    ["coreweave", "lambda-labs"],
    ["runpod", "vast-ai"],
    ["nebius", "lambda-labs"],
    ["gmi-cloud", "runpod"],
    ["voltage-park", "lambda-labs"],
  ] as const
).map(([a, b]) => ({ slug: [a, b].sort().join("-vs-"), a, b }));

const FEATURED_GPU_COMPARISONS = (
  [
    ["h100-sxm", "h200-sxm"],
    ["h100-sxm", "a100-80gb"],
    ["rtx-4090", "rtx-5090"],
    ["b200-sxm", "h200-sxm"],
    ["l40s", "rtx-4090"],
  ] as const
).map(([a, b]) => {
  const x = seoGpuSlug(a);
  const y = seoGpuSlug(b);
  return { slug: [x, y].sort().join("-vs-"), a: x, b: y };
});

export default async function CompareHubPage() {
  const [providers, gpus] = await Promise.all([listProviders(), listGpuModels()]).catch(() => [
    null,
    null,
  ]);

  return (
    <div className="container">
      <div className="card" style={{ padding: 22 }}>
        <h1 style={{ marginTop: 0 }}>Compare</h1>
        <p className="muted" style={{ maxWidth: 900, lineHeight: 1.7 }}>
          Head‑to‑head comparisons help you decide faster. Provider comparisons focus on pricing
          across shared GPUs plus reliability and product features (API access, spot/preemptible,
          regions). GPU comparisons focus on specifications (VRAM, architecture, bandwidth) and live
          price ranges across providers.
        </p>

        <div className="grid grid2" style={{ marginTop: 14, alignItems: "start" }}>
          <CompareBuilder
            providers={(providers?.docs ?? []).map((p) => ({ slug: p.slug, name: p.name }))}
            gpus={(gpus?.docs ?? []).map((g) => ({ slug: seoGpuSlug(g.slug), name: g.name }))}
          />
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 800 }}>How to read comparisons</div>
            <div className="muted" style={{ marginTop: 8, lineHeight: 1.7 }}>
              <p style={{ marginTop: 0 }}>
                For pricing, we normalize to <strong>$/GPU‑hour</strong> so multi‑GPU nodes and
                single‑GPU instances can be compared. If you care about distributed training, also
                check networking (InfiniBand / NVLink), minimum billing increments, and availability
                by region.
              </p>
              <p style={{ marginBottom: 0 }}>
                For spot/preemptible capacity, assume interruptions and checkpoint frequently. For
                production inference, prefer providers with stronger reliability tiers and broad
                region coverage.
              </p>
            </div>
          </div>
        </div>
      </div>

      <section style={{ marginTop: 18 }}>
        <h2 style={{ margin: "12px 0" }}>Popular provider comparisons</h2>
        <div className="grid grid3">
          {FEATURED_PROVIDER_COMPARISONS.map((c) => (
            <Link key={c.slug} href={`/compare/${c.slug}`} className="card" style={{ padding: 18 }}>
              <div style={{ fontWeight: 800 }}>
                {c.a} vs {c.b}
              </div>
              <div className="muted" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>
                Pricing + feature matrix + verdict
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 18 }}>
        <h2 style={{ margin: "12px 0" }}>Popular GPU comparisons</h2>
        <div className="grid grid3">
          {FEATURED_GPU_COMPARISONS.map((c) => (
            <Link key={c.slug} href={`/compare/${c.slug}`} className="card" style={{ padding: 18 }}>
              <div style={{ fontWeight: 800 }}>
                {c.a} vs {c.b}
              </div>
              <div className="muted" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>
                Specs + live price ranges
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Related pages</h2>
        <div className="muted" style={{ lineHeight: 1.8 }}>
          <div>
            Not sure which GPU fits your workload? Start with{" "}
            <Link href="/best-gpu-for">use case guides</Link>.
          </div>
          <div>
            Want raw data? Use <Link href="/cloud-gpu">GPU pricing pages</Link> or download CSV from
            the API.
          </div>
        </div>
      </section>
    </div>
  );
}
