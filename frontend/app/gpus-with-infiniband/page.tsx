import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { PriceTable } from "@/components/PriceTable";
import { apiGet } from "@/lib/api";
import { seoGpuSlug } from "@/lib/aliases";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "GPUs with InfiniBand - Cloud Pricing Comparison",
    description:
      "Compare cloud GPUs with InfiniBand networking for high-performance distributed training and multi-GPU workloads.",
    alternates: { canonical: "/gpus-with-infiniband" },
    openGraph: {
      title: "GPUs with InfiniBand - Cloud Pricing Comparison",
      description:
        "Compare cloud GPUs with InfiniBand networking for high-performance distributed training.",
      url: "/gpus-with-infiniband",
    },
  };
}

export default async function GpusWithInfinibandPage() {
  // Get instances with InfiniBand
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
    `/api/instances?limit=500&depth=1&where[is_active][equals]=true&where[has_infiniband][equals]=true&sort=price_per_gpu_hour`,
    { next: { revalidate: 60 } },
  );

  // Group by GPU slug
  const uniqueGpus = new Map<
    string,
    {
      gpuSlug: string;
      gpuName: string;
      gpuShortName: string;
      gpuVramGb: number;
      gpuArchitecture: string;
      minPrice: number;
      providers: Set<string>;
      maxIbBandwidth: number;
    }
  >();

  for (const inst of instances.docs) {
    const price = Number(inst.price_per_gpu_hour);
    if (!Number.isFinite(price)) continue;

    const existing = uniqueGpus.get(inst.gpu_slug);
    if (existing) {
      if (price < existing.minPrice) existing.minPrice = price;
      existing.providers.add(inst.provider_slug);
      if (
        inst.infiniband_bandwidth_gbps &&
        inst.infiniband_bandwidth_gbps > existing.maxIbBandwidth
      ) {
        existing.maxIbBandwidth = inst.infiniband_bandwidth_gbps;
      }
    } else {
      uniqueGpus.set(inst.gpu_slug, {
        gpuSlug: inst.gpu_slug,
        gpuName: inst.gpu_name,
        gpuShortName: inst.gpu_short_name,
        gpuVramGb: inst.gpu_vram_gb,
        gpuArchitecture: inst.gpu_architecture,
        minPrice: price,
        providers: new Set([inst.provider_slug]),
        maxIbBandwidth: inst.infiniband_bandwidth_gbps ?? 0,
      });
    }
  }

  const sortedGpus = [...uniqueGpus.values()].sort((a, b) => a.minPrice - b.minPrice);

  // Convert instances to PriceTable format
  const tableRows = instances.docs.map((inst) => ({
    provider: {
      slug: inst.provider_slug,
      name: inst.provider_name,
      reliabilityTier: inst.provider_reliability_tier,
      affiliateUrl: inst.provider_affiliate_url,
    },
    instance: {
      instanceType: inst.instance_type,
      gpuCount: inst.gpu_count,
      vcpuCount: null,
      ramGb: null,
      networkBandwidthGbps: inst.network_bandwidth_gbps
        ? Number(inst.network_bandwidth_gbps)
        : null,
      hasNvlink: inst.has_nvlink,
      hasInfiniband: inst.has_infiniband,
      infinibandBandwidthGbps: inst.infiniband_bandwidth_gbps,
      billingIncrementSeconds: inst.billing_increment_seconds,
      minRentalHours: inst.min_rental_hours,
      regions: inst.regions,
    },
    onDemand: Number(inst.price_per_gpu_hour) || null,
    spot: inst.price_per_hour_spot
      ? Number(inst.price_per_hour_spot) / Math.max(1, inst.gpu_count)
      : null,
    availability: inst.availability_status,
    lastUpdated: inst.last_scraped_at,
  }));

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://cloudgpus.io/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "GPUs with InfiniBand",
        item: "https://cloudgpus.io/gpus-with-infiniband",
      },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is InfiniBand and why does it matter for GPUs?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "InfiniBand is a high-speed networking technology used in HPC and AI clusters. It provides very low latency (sub-microsecond) and high bandwidth (up to 400+ Gbps per link) for GPU-to-GPU communication, which is critical for distributed training workloads where GPUs need to synchronize gradients frequently.",
        },
      },
      {
        "@type": "Question",
        name: "When should I choose InfiniBand-connected GPUs?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "InfiniBand is recommended for multi-node training, large-scale distributed training jobs, and workloads with frequent all-reduce operations. If you're training on 8+ GPUs across multiple nodes, InfiniBand can significantly reduce training time compared to Ethernet-based networking.",
        },
      },
      {
        "@type": "Question",
        name: "How much more expensive are InfiniBand GPUs?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "InfiniBand instances typically cost 20-50% more than standard instances due to the specialized networking hardware. However, for distributed training workloads, the performance improvement can justify the additional cost by reducing total training time.",
        },
      },
    ],
  };

  return (
    <div className="container">
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />

      <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          Home
        </Link>{" "}
        <span style={{ opacity: 0.5 }}>/</span> <span>GPUs with InfiniBand</span>
      </div>

      <div className="card" style={{ padding: 22 }}>
        <h1 style={{ marginTop: 0 }}>GPUs with InfiniBand Networking</h1>
        <p className="muted" style={{ maxWidth: 860, lineHeight: 1.7 }}>
          Compare cloud GPUs with InfiniBand interconnects for high-performance distributed
          training. InfiniBand provides low-latency, high-bandwidth networking essential for
          multi-GPU and multi-node AI workloads.
        </p>

        <div className="grid grid4" style={{ gap: 16, marginTop: 18 }}>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              GPU models
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{sortedGpus.length}</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              From
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>
              {sortedGpus.length > 0 ? `$${sortedGpus[0]?.minPrice.toFixed(2)}/hr` : "—"}
            </div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Instances
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{instances.docs.length}</div>
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
        <h2 style={{ marginTop: 0, fontSize: 18 }}>About InfiniBand for GPU Computing</h2>
        <div className="muted" style={{ lineHeight: 1.8 }}>
          <p style={{ marginTop: 0 }}>
            InfiniBand (IB) is a switched fabric communications link used in high-performance
            computing and enterprise data centers. For GPU computing, InfiniBand provides critical
            advantages over standard Ethernet networking:
          </p>
          <ul style={{ marginBottom: 12 }}>
            <li>
              <strong>Ultra-low latency:</strong> Sub-microsecond latency reduces communication
              overhead during distributed training
            </li>
            <li>
              <strong>High bandwidth:</strong> 200-400+ Gbps per link enables faster gradient
              aggregation
            </li>
            <li>
              <strong>RDMA support:</strong> Remote Direct Memory Access allows direct memory access
              between GPUs without CPU involvement
            </li>
            <li>
              <strong>Scalability:</strong> InfiniBand scales efficiently to thousands of GPUs
            </li>
          </ul>
          <p>
            For distributed training workloads, especially those using data parallelism with
            frequent synchronization, InfiniBand can reduce training time by 30-50% compared to
            100Gbps Ethernet. This performance improvement often justifies the higher instance cost
            for serious training jobs. Popular frameworks like PyTorch (NCCL), TensorFlow, and
            Horovod have optimized communication backends for InfiniBand.
          </p>
          <p style={{ marginBottom: 0 }}>
            When selecting InfiniBand instances, consider the IB generation (HDR200 at 200Gbps,
            NDR400 at 400Gbps), topology (fat-tree for optimal all-to-all communication), and
            whether the provider offers GPUDirect RDMA for zero-copy GPU-to-GPU transfers.
          </p>
        </div>
      </section>

      {tableRows.length > 0 ? (
        <div className="card" style={{ marginTop: 18, padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>InfiniBand GPU Pricing</h2>
          <p className="muted" style={{ marginTop: 6, lineHeight: 1.7 }}>
            Cloud providers offering GPUs with InfiniBand networking. Sorted by lowest price.
          </p>
          <div style={{ marginTop: 12 }}>
            <PriceTable gpuSlug="infiniband" rows={tableRows} />
          </div>
        </div>
      ) : null}

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>GPUs with InfiniBand</h2>
        <div className="grid grid3" style={{ gap: 12 }}>
          {sortedGpus.map((gpu) => (
            <Link
              key={gpu.gpuSlug}
              href={`/cloud-gpu/${seoGpuSlug(gpu.gpuSlug)}`}
              className="card"
              style={{ padding: 14, textDecoration: "none" }}
            >
              <div style={{ fontWeight: 700 }}>{gpu.gpuShortName}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                {gpu.gpuVramGb}GB · {gpu.gpuArchitecture}
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                {gpu.maxIbBandwidth > 0 ? `${gpu.maxIbBandwidth}Gbps IB` : "InfiniBand available"}
              </div>
              <div style={{ marginTop: 8, fontWeight: 600 }}>
                From ${gpu.minPrice.toFixed(2)}/hr
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid2" style={{ marginTop: 18 }}>
        <section className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Related Filters</h2>
          <div style={{ display: "grid", gap: 10 }}>
            <Link
              href="/gpus-with-nvlink"
              className="card"
              style={{ padding: 12, textDecoration: "none" }}
            >
              <div style={{ fontWeight: 700 }}>GPUs with NVLink</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                NVLink-connected GPUs for intra-node communication
              </div>
            </Link>
            <Link
              href="/gpus-over-80gb-vram"
              className="card"
              style={{ padding: 12, textDecoration: "none" }}
            >
              <div style={{ fontWeight: 700 }}>GPUs over 80GB VRAM</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                High-memory GPUs for large models
              </div>
            </Link>
            <Link
              href="/architecture/hopper"
              className="card"
              style={{ padding: 12, textDecoration: "none" }}
            >
              <div style={{ fontWeight: 700 }}>Hopper Architecture</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                H100, H200 and related GPUs
              </div>
            </Link>
          </div>
        </section>

        <section className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>When to Use InfiniBand</h2>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            <p style={{ marginTop: 0 }}>
              <strong>Multi-node training:</strong> When training across multiple servers,
              InfiniBand significantly reduces communication overhead between nodes.
            </p>
            <p>
              <strong>Large-scale LLM training:</strong> Training models with 100B+ parameters
              requires thousands of GPUs connected with high-bandwidth, low-latency networking.
            </p>
            <p>
              <strong>RL and simulation:</strong> Reinforcement learning workloads with many
              parallel environments benefit from fast communication.
            </p>
            <p style={{ marginBottom: 0 }}>
              <strong>HPC workloads:</strong> Scientific computing, CFD, and molecular dynamics
              simulations often require HPC-style networking.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
