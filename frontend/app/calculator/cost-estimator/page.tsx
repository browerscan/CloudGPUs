import type { Metadata } from "next";
import Link from "next/link";
import { CostEstimator } from "@/components/CostEstimator";
import { listGpuModels } from "@/lib/api";
import { JsonLd } from "@/components/JsonLd";
import { HowToSchema } from "@/components/HowToSchema";
import { seoGpuSlug } from "@/lib/aliases";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "GPU cloud cost estimator",
  description:
    "Estimate total GPU cloud cost for training runs or monthly inference. Uses live $/GPU-hour pricing and supports spot/preemptible estimates.",
  alternates: { canonical: "/calculator/cost-estimator" },
};

export default async function CostEstimatorPage() {
  const gpus = await listGpuModels().catch(() => null);

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://cloudgpus.io/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Calculator",
        item: "https://cloudgpus.io/calculator",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Cost estimator",
        item: "https://cloudgpus.io/calculator/cost-estimator",
      },
    ],
  };

  const faqs = [
    {
      q: "How do I estimate GPU cloud cost?",
      a: "Start with $/GPU-hour × GPU count × runtime hours. Then add storage, egress, minimum billing increments, and any setup fees.",
    },
    {
      q: "Is spot pricing safe for training?",
      a: "Spot/preemptible is cheaper but can be interrupted. It works best with checkpointing and retryable jobs. For long, non-interruptible training, prefer on-demand or reserved capacity.",
    },
    {
      q: "Why does the same GPU vary by price?",
      a: "Providers bundle different CPU/RAM, storage, networking (InfiniBand vs Ethernet), and billing increments. Verify the full instance spec before purchasing.",
    },
  ];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const howToSteps = [
    {
      name: "Select your GPU",
      text: "Choose the GPU model you plan to use from the dropdown. The tool will fetch current hourly pricing across providers.",
    },
    {
      name: "Set GPU count and hours",
      text: "Enter the number of GPUs you need and the expected runtime in hours. For training, use total training hours. For inference, estimate monthly usage hours.",
    },
    {
      name: "Choose pricing tier",
      text: "Select on-demand for stable pricing or spot/preemptible for lower costs (with interruption risk). The tool will calculate estimated total cost.",
    },
    {
      name: "Review the estimate",
      text: "The calculator shows total cost, cost per GPU, and monthly equivalent for inference workloads. Always verify on the provider site for final pricing.",
    },
  ];

  return (
    <div className="container">
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />
      <HowToSchema
        name="How to estimate GPU cloud cost"
        description="Learn how to calculate total GPU cloud costs for training runs and inference workloads using live pricing data."
        steps={howToSteps}
      />

      <div className="card" style={{ padding: 22 }}>
        <h1 style={{ marginTop: 0 }}>GPU cloud cost estimator</h1>
        <p className="muted" style={{ maxWidth: 980, lineHeight: 1.7 }}>
          This tool turns hourly GPU prices into practical estimates. Choose a GPU and provider
          tier, then decide whether to use spot/preemptible pricing when available. For training
          runs, we estimate cost by runtime hours. For production inference, we also show an
          approximate monthly spend based on utilization. Always validate billing increments and
          hidden costs (storage, egress) — those can dominate the bill for data-heavy workloads.
        </p>

        <CostEstimator
          gpus={(gpus?.docs ?? []).map((g) => ({
            slug: seoGpuSlug(g.slug),
            name: g.name,
            short_name: g.short_name,
            vram_gb: g.vram_gb,
            architecture: g.architecture,
          }))}
        />

        <section style={{ marginTop: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>How to calculate costs (practical notes)</h2>
          <div className="muted" style={{ lineHeight: 1.8, maxWidth: 980 }}>
            <p style={{ marginTop: 0 }}>
              A simple estimate is: <code>total = $/GPU‑hour × GPU count × hours</code>. This is
              accurate when billing is per‑minute or per‑second, and when you control exact
              start/stop times. In reality, many providers bill in hourly increments or have minimum
              rental time — which means short runs can cost more than expected.
            </p>
            <p>
              Spot/preemptible pricing can cut costs dramatically, but interruptions are common. For
              training, checkpoint frequently and assume you will lose a fraction of time to
              restarts. For inference, spot can be viable for batch workloads but is risky for
              user-facing latency‑sensitive services unless you run redundant capacity.
            </p>
            <p style={{ marginBottom: 0 }}>
              Finally, check the “included” resources: CPU/RAM, local NVMe vs network storage, and
              networking characteristics (NVLink inside a node, InfiniBand across nodes). These can
              change throughput and total runtime — sometimes a slightly more expensive instance
              finishes sooner and costs less overall.
            </p>
          </div>
        </section>

        <section className="card" style={{ marginTop: 18, padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Next steps</h2>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            <div>
              Browse live pricing: <Link href="/cloud-gpu">cloud GPU pages</Link>
            </div>
            <div>
              Find the right GPU for a workload: <Link href="/best-gpu-for">use case guides</Link>
            </div>
            <div>
              Compare providers head‑to‑head: <Link href="/compare">compare</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
