import type { Metadata } from "next";
import Link from "next/link";
import { CompareBuilder } from "@/components/CompareBuilder";
import { listGpuModels, listProviders } from "@/lib/api";
import { seoGpuSlug } from "@/lib/aliases";
import { JsonLd } from "@/components/JsonLd";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Compare Cloud GPU Providers & GPUs - H100 vs A100, Lambda vs RunPod",
  description:
    "Side-by-side GPU cloud comparisons with real pricing data. Compare H100 vs A100 ($2-4/hr vs $1-2/hr), Lambda Labs vs RunPod, and 50+ provider/GPU combinations.",
  alternates: { canonical: "/compare" },
  openGraph: {
    title: "Compare Cloud GPU Providers & GPUs - H100 vs A100, Lambda vs RunPod",
    description:
      "Side-by-side GPU cloud comparisons with real pricing data. Compare H100 vs A100, Lambda Labs vs RunPod, and 50+ combinations.",
    url: "https://cloudgpus.io/compare",
  },
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

      {/* SEO Content Section */}
      <section className="card" style={{ marginTop: 24, padding: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 20 }}>How to Compare Cloud GPUs and Providers</h2>

        <div style={{ lineHeight: 1.8, fontSize: 15 }}>
          <p>
            Effective GPU comparison requires looking beyond headline prices. I focus on four
            dimensions: raw pricing, total cost of ownership, performance characteristics, and
            reliability guarantees.
          </p>

          <h3 style={{ marginTop: 24 }}>GPU Comparison: What Matters Most</h3>
          <p>
            <strong>VRAM Capacity:</strong> The primary differentiator for AI workloads. H100 SXM
            (80GB) vs A100 80GB are comparable, but the H200 (141GB) enables single-GPU inference
            for 70B models that would require multi-GPU setups otherwise.
          </p>

          <p>
            <strong>Memory Bandwidth:</strong> H100 delivers 3.35 TB/s vs A100 at 2.0 TB/s. For
            memory-bound workloads (most LLM inference), this 67% advantage directly translates to
            faster token generation.
          </p>

          <p>
            <strong>Interconnect:</strong> For multi-GPU training, NVLink bandwidth matters. H100
            SXM offers 900 GB/s vs A100 at 600 GB/s. PCIe GPUs (including RTX 4090) are limited to
            64 GB/s, making distributed training 5-10x less efficient.
          </p>

          <p>
            <strong>Price/Performance:</strong> A100 80GB often delivers better value than H100 for
            workloads that do not benefit from H100 specific features (FP8, Transformer Engine). RTX
            4090 offers the best tokens-per-dollar for inference when single-GPU capacity suffices.
          </p>

          <h3 style={{ marginTop: 24 }}>Provider Comparison: Beyond Hourly Rates</h3>
          <p>
            <strong>Billing Increments:</strong> Lambda Labs bills per-second; some providers
            require hourly minimums. For short jobs, this difference matters significantly.
          </p>

          <p>
            <strong>Spot Availability:</strong> RunPod and Vast.ai offer extensive spot capacity at
            50-70% discounts. CoreWeave and Lambda Labs have more limited spot options but better
            reliability.
          </p>

          <p>
            <strong>Multi-GPU Pricing:</strong> 8x H100 nodes are not simply 8x the single-GPU
            price. Check node-level pricing for distributed training workloads.
          </p>

          <p>
            <strong>Hidden Costs:</strong> Some providers charge for egress, storage, or networking
            separately. Factor these into total cost calculations for data-intensive workloads.
          </p>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Related Pages</h2>
        <div className="muted" style={{ lineHeight: 1.8 }}>
          <div>
            Not sure which GPU fits your workload? Start with{" "}
            <Link href="/best-gpu-for">use case guides</Link>.
          </div>
          <div>
            Want raw data? Use <Link href="/cloud-gpu">GPU pricing pages</Link> or download CSV from
            the API.
          </div>
          <div>
            Looking for specific providers? Browse the{" "}
            <Link href="/provider">provider directory</Link>.
          </div>
        </div>
      </section>
    </div>
  );
}
