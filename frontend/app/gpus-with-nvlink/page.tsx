import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { PriceTable } from "@/components/PriceTable";
import { apiGet } from "@/lib/api";
import { seoGpuSlug } from "@/lib/aliases";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "GPUs with NVLink - Cloud Pricing Comparison",
    description:
      "Compare cloud GPUs with NVLink interconnect for high-performance multi-GPU training within a single node.",
    alternates: { canonical: "/gpus-with-nvlink" },
    openGraph: {
      title: "GPUs with NVLink - Cloud Pricing Comparison",
      description: "Compare cloud GPUs with NVLink interconnect for multi-GPU training.",
      url: "/gpus-with-nvlink",
    },
  };
}

export default async function GpusWithNvlinkPage() {
  // Get instances with NVLink
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
    `/api/instances?limit=500&depth=1&where[is_active][equals]=true&where[has_nvlink][equals]=true&sort=price_per_gpu_hour`,
    { next: { revalidate: 600 } },
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
    }
  >();

  for (const inst of instances.docs) {
    const price = Number(inst.price_per_gpu_hour);
    if (!Number.isFinite(price)) continue;

    const existing = uniqueGpus.get(inst.gpu_slug);
    if (existing) {
      if (price < existing.minPrice) existing.minPrice = price;
      existing.providers.add(inst.provider_slug);
    } else {
      uniqueGpus.set(inst.gpu_slug, {
        gpuSlug: inst.gpu_slug,
        gpuName: inst.gpu_name,
        gpuShortName: inst.gpu_short_name,
        gpuVramGb: inst.gpu_vram_gb,
        gpuArchitecture: inst.gpu_architecture,
        minPrice: price,
        providers: new Set([inst.provider_slug]),
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
        name: "GPUs with NVLink",
        item: "https://cloudgpus.io/gpus-with-nvlink",
      },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is NVLink and why does it matter for GPUs?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "NVLink is NVIDIA's high-speed GPU-to-GPU interconnect. It provides significantly higher bandwidth (up to 900 GB/s on Hopper, 1.8 TB/s on Blackwell) than PCIe, enabling much faster communication between GPUs in multi-GPU training setups. This is critical for data parallel training and model parallel training where GPUs need to exchange data frequently.",
        },
      },
      {
        "@type": "Question",
        name: "When should I choose NVLink-connected GPUs?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "NVLink is recommended for multi-GPU training within a single node, especially for large models that require model parallelism. If you're training models that don't fit on a single GPU, or doing data parallel training with 4+ GPUs, NVLink can provide significant performance improvements over PCIe-only systems.",
        },
      },
      {
        "@type": "Question",
        name: "How does NVLink differ from InfiniBand?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "NVLink connects GPUs within a single node (server), while InfiniBand connects nodes together. For optimal multi-node training, you typically want both: NVLink for intra-node communication and InfiniBand for inter-node communication.",
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
        <span style={{ opacity: 0.5 }}>/</span> <span>GPUs with NVLink</span>
      </div>

      <div className="card" style={{ padding: 22 }}>
        <h1 style={{ marginTop: 0 }}>GPUs with NVLink Interconnect</h1>
        <p className="muted" style={{ maxWidth: 860, lineHeight: 1.7 }}>
          Compare cloud GPUs with NVLink for high-performance multi-GPU training within a single
          node. NVLink provides GPU-to-GPU bandwidth far exceeding PCIe, essential for large model
          training and distributed workloads.
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
        <h2 style={{ marginTop: 0, fontSize: 18 }}>About NVLink for GPU Computing</h2>
        <div className="muted" style={{ lineHeight: 1.8 }}>
          <p style={{ marginTop: 0 }}>
            NVLink is NVIDIA&apos;s proprietary high-speed interconnect that allows GPUs to communicate
            directly with each other, bypassing the PCIe bus and CPU. This architecture provides
            several critical advantages for multi-GPU computing:
          </p>
          <ul style={{ marginBottom: 12 }}>
            <li>
              <strong>High bandwidth:</strong> Up to 900 GB/s (Hopper) or 1.8 TB/s (Blackwell) per
              GPU, vs 64 GB/s for PCIe Gen5
            </li>
            <li>
              <strong>Low latency:</strong> Direct GPU-to-GPU communication reduces latency for
              synchronization operations
            </li>
            <li>
              <strong>Memory pooling:</strong> Some configurations allow GPUs to access each other&apos;s
              memory, effectively pooling VRAM
            </li>
            <li>
              <strong>Scalable:</strong> Multiple NVLinks can be aggregated for even higher
              bandwidth
            </li>
          </ul>
          <p>
            For training large language models that don&apos;t fit on a single GPU, NVLink is essential
            for tensor parallelism and pipeline parallelism. The high bandwidth enables faster
            gradient aggregation in data parallel training and more efficient tensor sharding in
            model parallel training. NVLink is typically found on SXM and NVL form factor GPUs like
            H100 SXM, H200 SXM, B200 SXM, and GB200 NVL.
          </p>
          <p style={{ marginBottom: 0 }}>
            When selecting NVLink instances, consider the number of GPUs per node (typically 4-8),
            the NVLink generation (3rd gen for Hopper, 4th gen for Blackwell), and whether the
            instance also includes InfiniBand for multi-node scaling. NVLink instances are typically
            more expensive than PCIe equivalents but provide significantly better multi-GPU
            performance that can reduce total training time.
          </p>
        </div>
      </section>

      {tableRows.length > 0 ? (
        <div className="card" style={{ marginTop: 18, padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>NVLink GPU Pricing</h2>
          <p className="muted" style={{ marginTop: 6, lineHeight: 1.7 }}>
            Cloud providers offering GPUs with NVLink interconnect. Sorted by lowest price.
          </p>
          <div style={{ marginTop: 12 }}>
            <PriceTable gpuSlug="nvlink" rows={tableRows} />
          </div>
        </div>
      ) : null}

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>GPUs with NVLink</h2>
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
                {gpu.providers.size} provider(s)
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
              href="/gpus-with-infiniband"
              className="card"
              style={{ padding: 12, textDecoration: "none" }}
            >
              <div style={{ fontWeight: 700 }}>GPUs with InfiniBand</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                InfiniBand-connected GPUs for multi-node training
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
              href="/form-factor/sxm"
              className="card"
              style={{ padding: 12, textDecoration: "none" }}
            >
              <div style={{ fontWeight: 700 }}>SXM Form Factor</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                SXM modules typically include NVLink
              </div>
            </Link>
          </div>
        </section>

        <section className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>When to Use NVLink</h2>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            <p style={{ marginTop: 0 }}>
              <strong>Model parallelism:</strong> When training models too large for a single GPU,
              NVLink enables efficient tensor and pipeline parallelism.
            </p>
            <p>
              <strong>Data parallelism:</strong> For 4+ GPU training, NVLink accelerates gradient
              aggregation and all-reduce operations.
            </p>
            <p>
              <strong>High-speed inference:</strong> Multi-GPU inference with tensor parallelism
              benefits from NVLink&apos;s low latency.
            </p>
            <p style={{ marginBottom: 0 }}>
              <strong>Memory pooling:</strong> Some NVLink configurations allow accessing VRAM from
              other GPUs, effectively increasing available memory.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
