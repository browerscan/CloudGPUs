import type { Metadata } from "next";
import Link from "next/link";
import { listProviders } from "@/lib/api";
import { JsonLd } from "@/components/JsonLd";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Cloud GPU Providers 2025 - Compare Lambda Labs, RunPod, CoreWeave & More",
  description:
    "Compare 20+ cloud GPU providers by pricing, reliability, and features. Lambda Labs H100 from $2.49/hr, RunPod from $0.34/hr, Vast.ai from $0.20/hr. Find the best provider for AI training and inference.",
  alternates: { canonical: "/provider" },
  openGraph: {
    title: "Cloud GPU Providers 2025 - Compare Lambda Labs, RunPod, CoreWeave & More",
    description:
      "Compare 20+ cloud GPU providers by pricing, reliability, and features. Find the best provider for AI training and inference.",
    url: "https://cloudgpus.io/provider",
  },
};

const PROVIDER_TYPES: Array<{ value: string; label: string }> = [
  { value: "specialized_neocloud", label: "Specialized neocloud" },
  { value: "hyperscaler", label: "Hyperscaler" },
  { value: "regional_cloud", label: "Regional cloud" },
  { value: "marketplace", label: "Marketplace" },
  { value: "depin", label: "DePIN" },
  { value: "bare_metal", label: "Bare metal" },
];

const TIERS: Array<{ value: string; label: string }> = [
  { value: "enterprise", label: "Enterprise" },
  { value: "standard", label: "Standard" },
  { value: "community", label: "Community" },
];

export default async function ProviderHubPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const type = typeof params.type === "string" ? params.type.trim() : "";
  const tier = typeof params.tier === "string" ? params.tier.trim() : "";

  const res = await listProviders().catch(() => null);
  const apiOk = res != null;
  const filtered = (res?.docs ?? []).filter((p) => {
    const haystack = `${p.name} ${p.slug} ${p.provider_type} ${p.reliability_tier}`.toLowerCase();
    if (q && !haystack.includes(q)) return false;
    if (type && p.provider_type !== type) return false;
    if (tier && p.reliability_tier !== tier) return false;
    return true;
  });

  return (
    <div className="container">
      <div className="card" style={{ padding: 22 }}>
        <h1 style={{ marginTop: 0 }}>GPU cloud providers</h1>
        <p className="muted" style={{ maxWidth: 900, lineHeight: 1.7 }}>
          CloudGPUs.io tracks pricing across specialized AI clouds, marketplaces, and DePIN
          networks. Use this hub to filter providers by business model and reliability tier, then
          click through to see available GPUs, on‑demand vs spot pricing, API links, and user
          reviews. For budget‑sensitive workloads, marketplaces and DePIN can be attractive — but
          verify interruption risk and stability before running long training jobs.
        </p>

        <form style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search providers (e.g., lambda, runpod, nebius)"
            style={{
              flex: "1 1 320px",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(15, 23, 42, 0.12)",
            }}
          />
          <select
            name="type"
            defaultValue={type}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(15, 23, 42, 0.12)",
            }}
          >
            <option value="">All types</option>
            {PROVIDER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            name="tier"
            defaultValue={tier}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(15, 23, 42, 0.12)",
            }}
          >
            <option value="">All tiers</option>
            {TIERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <button className="btn" type="submit">
            Filter
          </button>
          {q || type || tier ? (
            <Link className="btn btnSecondary" href="/provider">
              Clear
            </Link>
          ) : null}
        </form>
      </div>

      <section style={{ marginTop: 18 }}>
        <h2 style={{ margin: "12px 0" }}>Providers</h2>
        <div className="grid grid3">
          {filtered.map((p) => (
            <Link
              key={p.slug}
              href={`/provider/${p.slug}`}
              className="card"
              style={{ padding: 18 }}
            >
              <div style={{ fontWeight: 800 }}>{p.name}</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>
                {p.provider_type} · {p.reliability_tier}
                {p.last_price_update ? (
                  <div>Updated: {new Date(p.last_price_update).toLocaleDateString()}</div>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
        {!filtered.length ? (
          <div className="card muted" style={{ marginTop: 14, padding: 18, lineHeight: 1.7 }}>
            {apiOk ? (
              <>
                No matching providers. Try clearing filters or searching by slug (for example:{" "}
                <code>lambda-labs</code>, <code>vast-ai</code>).
              </>
            ) : (
              <>
                Provider catalog is unavailable. Configure <code>NEXT_PUBLIC_API_BASE_URL</code> and
                try again.
              </>
            )}
          </div>
        ) : null}
      </section>

      {/* Provider Comparison Table */}
      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Provider Quick Comparison</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(15, 23, 42, 0.1)" }}>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Provider</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Type</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>H100 Price</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>RTX 4090</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Best For</th>
              </tr>
            </thead>
            <tbody className="muted">
              <tr style={{ borderBottom: "1px solid rgba(15, 23, 42, 0.05)" }}>
                <td style={{ padding: "10px 8px", fontWeight: 600 }}>
                  <Link href="/provider/lambda-labs">Lambda Labs</Link>
                </td>
                <td style={{ padding: "10px 8px" }}>Specialized</td>
                <td style={{ padding: "10px 8px" }}>$2.49-3.29/hr</td>
                <td style={{ padding: "10px 8px" }}>N/A</td>
                <td style={{ padding: "10px 8px" }}>Production training</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(15, 23, 42, 0.05)" }}>
                <td style={{ padding: "10px 8px", fontWeight: 600 }}>
                  <Link href="/provider/runpod">RunPod</Link>
                </td>
                <td style={{ padding: "10px 8px" }}>Marketplace</td>
                <td style={{ padding: "10px 8px" }}>$1.99-2.69/hr</td>
                <td style={{ padding: "10px 8px" }}>$0.34-0.50/hr</td>
                <td style={{ padding: "10px 8px" }}>Flexible workloads</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(15, 23, 42, 0.05)" }}>
                <td style={{ padding: "10px 8px", fontWeight: 600 }}>
                  <Link href="/provider/vast-ai">Vast.ai</Link>
                </td>
                <td style={{ padding: "10px 8px" }}>Marketplace</td>
                <td style={{ padding: "10px 8px" }}>$1.50-2.50/hr</td>
                <td style={{ padding: "10px 8px" }}>$0.20-0.40/hr</td>
                <td style={{ padding: "10px 8px" }}>Budget training</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(15, 23, 42, 0.05)" }}>
                <td style={{ padding: "10px 8px", fontWeight: 600 }}>
                  <Link href="/provider/coreweave">CoreWeave</Link>
                </td>
                <td style={{ padding: "10px 8px" }}>Specialized</td>
                <td style={{ padding: "10px 8px" }}>$2.50-3.50/hr</td>
                <td style={{ padding: "10px 8px" }}>N/A</td>
                <td style={{ padding: "10px 8px" }}>Enterprise AI</td>
              </tr>
              <tr>
                <td style={{ padding: "10px 8px", fontWeight: 600 }}>
                  <Link href="/provider/tensordock">TensorDock</Link>
                </td>
                <td style={{ padding: "10px 8px" }}>Marketplace</td>
                <td style={{ padding: "10px 8px" }}>$2.25/hr</td>
                <td style={{ padding: "10px 8px" }}>$0.35/hr</td>
                <td style={{ padding: "10px 8px" }}>Cost-conscious</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* SEO Content Section */}
      <section className="card" style={{ marginTop: 24, padding: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 20 }}>
          Choosing the Right Cloud GPU Provider: A Complete Guide
        </h2>

        <div style={{ lineHeight: 1.8, fontSize: 15 }}>
          <p>
            Selecting the right cloud GPU provider can reduce your AI compute costs by 40-60% while
            improving training reliability. I analyzed pricing, features, and reliability data from
            20+ providers to help you make an informed decision.
          </p>

          <h3 style={{ marginTop: 24 }}>Provider Categories Explained</h3>
          <p>
            <strong>Specialized AI Clouds (Lambda Labs, CoreWeave, Nebius):</strong> These providers
            focus exclusively on AI/ML workloads. They offer optimized GPU configurations with
            NVLink and InfiniBand networking, competitive pricing ($2-4/hour for H100), and
            AI-focused support. I recommend specialized clouds for production training jobs where
            reliability and performance matter.
          </p>

          <p>
            <strong>Hyperscalers (AWS, GCP, Azure):</strong> The major cloud providers offer the
            broadest GPU selection and strongest SLAs. However, GPU pricing is 50-100% higher than
            alternatives ($3-8/hour for H100). Choose hyperscalers when you need enterprise
            compliance certifications, global region coverage, or integration with existing cloud
            infrastructure.
          </p>

          <p>
            <strong>Marketplaces (RunPod, Vast.ai, TensorDock):</strong> These platforms aggregate
            GPU capacity from data centers and individual owners. Prices are lowest ($1-2/hour for
            H100, $0.20-0.50/hour for RTX 4090), but availability and reliability vary. Best for
            experimentation, batch processing, and fault-tolerant workloads with proper
            checkpointing.
          </p>

          <p>
            <strong>DePIN Networks:</strong> Decentralized physical infrastructure networks offer
            distributed GPU capacity. Pricing can be attractive, but latency, security, and
            availability are less predictable. Consider for non-sensitive batch workloads only.
          </p>

          <h3 style={{ marginTop: 24 }}>Key Selection Criteria</h3>
          <p>
            <strong>1. GPU Availability:</strong> Check which GPUs are available on-demand vs
            requiring reservations. H100 availability varies significantly by provider and region.
          </p>

          <p>
            <strong>2. Multi-GPU Configurations:</strong> For distributed training, verify NVLink
            and InfiniBand support. PCIe-connected GPUs scale at 40-60% efficiency, while NVLinked
            nodes achieve 90%+ scaling efficiency.
          </p>

          <p>
            <strong>3. Billing Increments:</strong> Some providers bill by the minute while others
            require hourly minimums. For short jobs, minute-based billing saves 30-50%.
          </p>

          <p>
            <strong>4. Spot/Preemptible Options:</strong> Spot instances offer 50-80% savings. Check
            interruption rates and warning times before relying on spot for training.
          </p>

          <p>
            <strong>5. Region Coverage:</strong> For inference serving, choose providers with
            capacity in regions close to your users. For training, region matters less than price.
          </p>

          <h3 style={{ marginTop: 24 }}>My Recommendations by Use Case</h3>
          <p>
            <strong>Production LLM Training:</strong> Lambda Labs or CoreWeave. Reliable H100
            availability, NVLink configurations, and reasonable pricing. Worth the premium over
            marketplaces for jobs costing $1,000+.
          </p>

          <p>
            <strong>Experimentation and Fine-Tuning:</strong> RunPod or Vast.ai. Low prices with
            good RTX 4090 availability. Use spot instances with checkpointing for maximum savings.
          </p>

          <p>
            <strong>Production Inference:</strong> Lambda Labs, CoreWeave, or hyperscalers depending
            on SLA requirements. Prioritize reliability and region coverage over price.
          </p>

          <p>
            <strong>Batch Processing:</strong> Vast.ai or TensorDock. Lowest prices with acceptable
            reliability for fault-tolerant workloads.
          </p>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Related Pages</h2>
        <div className="muted" style={{ lineHeight: 1.8 }}>
          <div>
            Looking for a specific GPU? Browse{" "}
            <Link href="/cloud-gpu">cloud GPU pricing pages</Link>.
          </div>
          <div>
            Want a head-to-head verdict? Try <Link href="/compare">provider comparisons</Link>.
          </div>
          <div>
            Planning a workload? Start with{" "}
            <Link href="/best-gpu-for">best GPU for common use cases</Link>.
          </div>
          <div>
            Need specific regions? Check <Link href="/region">GPU availability by region</Link>.
          </div>
        </div>
      </section>
    </div>
  );
}
