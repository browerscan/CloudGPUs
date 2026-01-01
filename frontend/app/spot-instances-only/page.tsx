import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { apiGet } from "@/lib/api";
import { seoGpuSlug } from "@/lib/aliases";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Spot GPU Instances - Preemptible Cloud GPU Pricing",
    description:
      "Compare spot GPU instances across cloud providers. Save up to 90% on GPU computing with preemptible instances.",
    alternates: { canonical: "/spot-instances-only" },
    openGraph: {
      title: "Spot GPU Instances - Preemptible Cloud GPU Pricing",
      description: "Compare spot GPU instances and save up to 90% on GPU computing.",
      url: "/spot-instances-only",
    },
  };
}

export default async function SpotInstancesPage() {
  // Get instances with spot pricing
  const instances = await apiGet<{
    docs: Array<{
      id: string;
      gpu_slug: string;
      gpu_name: string;
      gpu_short_name: string;
      gpu_vram_gb: number;
      gpu_architecture: string;
      price_per_gpu_hour: string;
      price_per_hour_spot: string | null;
      provider_name: string;
      provider_slug: string;
      provider_reliability_tier: string;
      provider_affiliate_url: string | null;
      instance_type: string;
      gpu_count: number;
      has_nvlink: boolean | null;
      has_infiniband: boolean | null;
      infiniband_bandwidth_gbps: number | null;
      network_bandwidth_gbps: string | null;
      billing_increment_seconds: number | null;
      min_rental_hours: number | null;
      regions: string[] | null;
      availability_status: string;
      last_scraped_at: string;
    }>;
  }>(
    `/api/instances?limit=500&depth=1&where[is_active][equals]=true&where[price_per_hour_spot][not_equals]=null&sort=price_per_hour_spot`,
    { next: { revalidate: 60 } },
  );

  // Group by GPU slug and calculate savings
  const uniqueGpus = new Map<
    string,
    {
      gpuSlug: string;
      gpuName: string;
      gpuShortName: string;
      gpuVramGb: number;
      gpuArchitecture: string;
      minOnDemand: number;
      minSpot: number;
      maxSavings: number;
      providers: Set<string>;
    }
  >();

  for (const inst of instances.docs) {
    const onDemand = Number(inst.price_per_gpu_hour);
    const spot = inst.price_per_hour_spot
      ? Number(inst.price_per_hour_spot) / Math.max(1, inst.gpu_count)
      : null;

    if (!Number.isFinite(onDemand) || spot === null || !Number.isFinite(spot)) continue;

    const savings = ((onDemand - spot) / onDemand) * 100;

    const existing = uniqueGpus.get(inst.gpu_slug);
    if (existing) {
      if (onDemand < existing.minOnDemand) existing.minOnDemand = onDemand;
      if (spot < existing.minSpot) existing.minSpot = spot;
      if (savings > existing.maxSavings) existing.maxSavings = savings;
      existing.providers.add(inst.provider_slug);
    } else {
      uniqueGpus.set(inst.gpu_slug, {
        gpuSlug: inst.gpu_slug,
        gpuName: inst.gpu_name,
        gpuShortName: inst.gpu_short_name,
        gpuVramGb: inst.gpu_vram_gb,
        gpuArchitecture: inst.gpu_architecture,
        minOnDemand: onDemand,
        minSpot: spot,
        maxSavings: savings,
        providers: new Set([inst.provider_slug]),
      });
    }
  }

  const sortedGpus = [...uniqueGpus.values()].sort((a, b) => a.minSpot - b.minSpot);

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://cloudgpus.io/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Spot GPU Instances",
        item: "https://cloudgpus.io/spot-instances-only",
      },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What are spot GPU instances?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Spot (or preemptible) GPU instances are cloud computing resources available at significantly reduced prices (often 50-90% off) compared to on-demand instances. The trade-off is that the cloud provider can reclaim these instances with short notice (typically 2 minutes) when they need the capacity back.",
        },
      },
      {
        "@type": "Question",
        name: "How much can I save with spot instances?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `Spot instances typically offer 50-90% savings compared to on-demand pricing. The exact discount varies by GPU type, region, and current demand. Popular GPUs like H100 and A100 may have smaller discounts (30-50%) while older GPUs like T4 or V100 can have discounts of 80% or more.`,
        },
      },
      {
        "@type": "Question",
        name: "What workloads are suitable for spot instances?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Spot instances are ideal for fault-tolerant workloads: batch processing, training jobs with checkpoint/resume capability, distributed training with elasticity, experimentation and development, and non-urgent inference. They're not suitable for real-time inference, interactive workloads, or short jobs where checkpoint overhead is significant.",
        },
      },
      {
        "@type": "Question",
        name: "How do I handle spot instance interruptions?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Strategies for handling interruptions include: frequent checkpointing (every 5-15 minutes), using frameworks with native spot support (Kubernetes with cluster autoscaler, Ray with autoscaling), implementing graceful shutdown handlers, and using managed spot training services when available. Some providers also offer 'spot with capacity' options that provide guaranteed availability for higher prices.",
        },
      },
    ],
  };

  const avgSavings =
    sortedGpus.length > 0
      ? sortedGpus.reduce((sum, g) => sum + g.maxSavings, 0) / sortedGpus.length
      : 0;

  return (
    <div className="container">
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />

      <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          Home
        </Link>{" "}
        <span style={{ opacity: 0.5 }}>/</span> <span>Spot GPU Instances</span>
      </div>

      <div className="card" style={{ padding: 22 }}>
        <h1 style={{ marginTop: 0 }}>Spot GPU Instances</h1>
        <p className="muted" style={{ maxWidth: 860, lineHeight: 1.7 }}>
          Compare spot (preemptible) GPU instances across cloud providers. Save up to 90% on GPU
          computing for fault-tolerant workloads like batch training, experimentation, and
          development.
        </p>

        <div className="grid grid4" style={{ gap: 16, marginTop: 18 }}>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              GPU models with spot
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{sortedGpus.length}</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              From
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>
              {sortedGpus.length > 0 ? `$${sortedGpus[0]?.minSpot.toFixed(2)}/hr` : "—"}
            </div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Avg savings
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{avgSavings.toFixed(0)}%</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Providers
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>
              {new Set(instances.docs.map((i) => i.provider_slug)).size}
            </div>
          </div>
        </div>
      </div>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>About Spot GPU Instances</h2>
        <div className="muted" style={{ lineHeight: 1.8 }}>
          <p style={{ marginTop: 0 }}>
            Spot instances (also called preemptible instances) are cloud resources available at
            significantly reduced prices. The cloud provider can reclaim these instances with short
            notice when they need capacity for on-demand customers. This pricing model allows
            providers to monetize spare capacity while offering customers dramatic savings.
          </p>
          <p>
            <strong>Typical savings by provider type:</strong>
          </p>
          <ul style={{ marginBottom: 12 }}>
            <li>
              <strong>Hyperscalers (AWS, GCP, Azure):</strong> 50-70% discounts for spot instances
            </li>
            <li>
              <strong>Specialized GPU clouds:</strong> 30-50% discounts, sometimes more for less
              popular GPUs
            </li>
            <li>
              <strong>Marketplace/DePIN:</strong> Up to 90% discounts, with higher interruption risk
            </li>
          </ul>
          <p>
            <strong>Interruption notices:</strong> Most providers give 2 minutes notice before
            interrupting a spot instance. This gives your application time to save state, checkpoint
            training progress, or gracefully shut down. Some providers offer "capacity-optimized"
            spot allocation that reduces interruption probability at the cost of slightly higher
            prices.
          </p>
          <p style={{ marginBottom: 0 }}>
            <strong>Best practices for spot instances:</strong> Implement frequent checkpointing
            (every 5-15 minutes for training), use distributed training frameworks that handle node
            failures gracefully, consider spot portfolios (mixing instance types to reduce
            correlated interruptions), and use managed services when available for automatic
            recovery.
          </p>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Spot vs On-Demand Pricing</h2>
        <p className="muted" style={{ marginTop: 6, lineHeight: 1.7 }}>
          GPUs available with spot pricing, sorted by lowest spot price. Shows maximum savings
          compared to on-demand pricing.
        </p>

        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                  GPU
                </th>
                <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                  Spot Price
                </th>
                <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                  On-Demand
                </th>
                <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                  Savings
                </th>
                <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                  Providers
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedGpus.map((gpu) => (
                <tr key={gpu.gpuSlug}>
                  <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                    <Link
                      href={`/cloud-gpu/${seoGpuSlug(gpu.gpuSlug)}`}
                      style={{ fontWeight: 700 }}
                    >
                      {gpu.gpuShortName}
                    </Link>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {gpu.gpuVramGb}GB · {gpu.gpuArchitecture}
                    </div>
                  </td>
                  <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                    ${gpu.minSpot.toFixed(2)}/hr
                  </td>
                  <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                    ${gpu.minOnDemand.toFixed(2)}/hr
                  </td>
                  <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                    <span style={{ color: "#22c55e", fontWeight: 700 }}>
                      -{gpu.maxSavings.toFixed(0)}%
                    </span>
                  </td>
                  <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                    {gpu.providers.size} provider(s)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid2" style={{ marginTop: 18 }}>
        <section className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Best Workloads for Spot</h2>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            <p style={{ marginTop: 0 }}>
              <strong>Distributed training:</strong> Training jobs that can handle node failures and
              continue from checkpoints are ideal for spot instances.
            </p>
            <p>
              <strong>Fine-tuning:</strong> Shorter fine-tuning jobs (hours rather than days) have
              lower interruption risk and can be easily restarted.
            </p>
            <p>
              <strong>Batch inference:</strong> Processing offline inference jobs where timing isn't
              critical and work can be paused/resumed.
            </p>
            <p>
              <strong>Experimentation:</strong> Running experiments, hyperparameter tuning, and
              development work where interruptions are acceptable.
            </p>
            <p style={{ marginBottom: 0 }}>
              <strong>RL and simulation:</strong> Reinforcement learning and simulation workloads
              that naturally handle environment resets and can checkpoint frequently.
            </p>
          </div>
        </section>

        <section className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Frameworks with Spot Support</h2>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            <p style={{ marginTop: 0 }}>
              <strong>PyTorch:</strong> Use torch.distributed.elastic for fault-tolerant distributed
              training that handles node failures.
            </p>
            <p>
              <strong>TensorFlow:</strong> TensorFlow's parameter server strategy and mesh
              strategies can handle worker failures with proper configuration.
            </p>
            <p>
              <strong>Ray:</strong> Ray Train and Ray Core have built-in support for spot instances
              with automatic restart and checkpoint recovery.
            </p>
            <p>
              <strong>Kubernetes:</strong> Cluster autoscaler and Karpenter support spot instance
              provisioning with automatic replacement of interrupted nodes.
            </p>
            <p style={{ marginBottom: 0 }}>
              <strong>Managed services:</strong> AWS SageMaker, GCP Vertex AI, and Azure ML all
              offer managed spot training with automatic checkpoint management.
            </p>
          </div>
        </section>
      </div>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Related</h2>
        <div className="grid grid3" style={{ gap: 12 }}>
          <Link
            href="/budget/under-1-per-hour"
            className="card"
            style={{ padding: 14, textDecoration: "none" }}
          >
            <div style={{ fontWeight: 700 }}>Budget GPUs</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              GPUs under $1/hour
            </div>
          </Link>
          <Link
            href="/best-gpu-for/llm-training"
            className="card"
            style={{ padding: 14, textDecoration: "none" }}
          >
            <div style={{ fontWeight: 700 }}>LLM Training</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Best GPUs for training LLMs
            </div>
          </Link>
          <Link
            href="/gpus-with-nvlink"
            className="card"
            style={{ padding: 14, textDecoration: "none" }}
          >
            <div style={{ fontWeight: 700 }}>NVLink GPUs</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Multi-GPU training
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
