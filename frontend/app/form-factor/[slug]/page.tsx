import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { PriceTable } from "@/components/PriceTable";
import { apiGet, listGpuModels } from "@/lib/api";
import { seoGpuSlug } from "@/lib/aliases";

export const revalidate = 600;

export type FormFactorPage = {
  slug: string;
  name: string;
  title: string;
  description: string;
  content: string;
  pros: string[];
  cons: string[];
  typicalGpus: string[];
};

const FORM_FACTOR_PAGES: FormFactorPage[] = [
  {
    slug: "pcie",
    name: "PCIe",
    title: "PCIe GPU Cards - Cloud Pricing Comparison",
    description:
      "Compare PCIe form factor GPUs (H100 PCIe, A100 PCIe, RTX 4090) across cloud providers. Flexible GPU options for single-GPU workloads.",
    content: `PCIe (Peripheral Component Interconnect Express) GPUs are plug-in cards that connect to a host system via the PCIe bus. This form factor is the most common for both consumer GPUs and many datacenter GPUs. PCIe GPUs offer several advantages: they can be installed in standard servers, workstations, and even desktop systems; they support hot-swap in some configurations; and they're generally more flexible than SXM modules for varied deployment scenarios.

In the cloud, PCIe GPUs are often more readily available and less expensive than their SXM counterparts. For example, an H100 PCIe typically costs less per hour than an H100 SXM, though it also has lower thermal design power and reduced performance. PCIe GPUs connect via PCIe Gen4 or Gen5 lanes, providing up to 64 GB/s of bandwidth to the host system, which is sufficient for many workloads but significantly less than the 900 GB/s+ of NVLink.

PCIe GPUs are ideal for single-GPU workloads, inference servers, fine-tuning tasks, and development work. They're also the right choice when you need to mix GPU and non-GPU instances in the same cluster, or when you need to provision GPUs in standard server hardware rather than specialized GPU-optimized nodes. The trade-off is reduced multi-GPU scaling performance compared to SXM variants, as PCIe interconnects are much slower than NVLink for GPU-to-GPU communication.`,
    pros: [
      "Lower cost per hour than SXM variants",
      "Available in standard server configurations",
      "Flexible deployment options",
      "Wider availability across providers",
      "Sufficient for single-GPU workloads",
    ],
    cons: [
      "Slower GPU-to-GPU communication",
      "Lower TDP and peak performance",
      "No NVLink for multi-GPU scaling",
      "PCIe bandwidth limits host transfers",
    ],
    typicalGpus: ["h100-pcie", "a100-40gb", "a100-80gb", "rtx-4090", "rtx-5090", "l40s", "a40"],
  },
  {
    slug: "sxm",
    name: "SXM",
    title: "SXM GPU Modules - Cloud Pricing Comparison",
    description:
      "Compare SXM form factor GPUs (H100 SXM, H200 SXM, B200 SXM) across cloud providers. High-performance GPUs for multi-GPU training.",
    content: `SXM (Server GPU Module) is NVIDIA's proprietary form factor for datacenter GPUs designed for maximum performance and multi-GPU scaling. Unlike PCIe cards, SXM GPUs are soldered directly onto the motherboard or a specialized carrier board, allowing for higher thermal design power (TDP) and direct NVLink connections between GPUs. This architecture is used in NVIDIA's DGX systems and similar high-performance computing platforms.

SXM GPUs deliver significantly better performance than their PCIe counterparts. For example, an H100 SXM has a TDP of 700W compared to 350W for the H100 PCIe, enabling higher sustained clock speeds and better performance for long-running training jobs. More importantly, SXM GPUs connect via NVLink with up to 900 GB/s (Hopper) or 1.8 TB/s (Blackwell) of bandwidth per GPU, enabling efficient multi-GPU scaling that is essential for training large language models across multiple GPUs.

In cloud environments, SXM GPUs are typically offered in bare metal instances or specialized virtual machine types where you can reserve entire GPU nodes. These instances are more expensive than PCIe options but provide superior performance for distributed training, high-performance computing, and production inference at scale. SXM configurations are the right choice when training multi-billion parameter models, running multi-GPU training with frequent synchronization, or when maximum performance is required regardless of cost.`,
    pros: [
      "Maximum GPU performance (higher TDP)",
      "NVLink for fast GPU-to-GPU communication",
      "Optimal for distributed training",
      "Used in NVIDIA DGX systems",
      "Higher memory bandwidth variants",
    ],
    cons: [
      "Higher cost per hour",
      "Less flexible deployment",
      "Requires specialized hardware",
      "Limited availability",
      "Overkill for single-GPU workloads",
    ],
    typicalGpus: ["h100-sxm", "h200-sxm", "b200-sxm", "a100-80gb-sxm"],
  },
  {
    slug: "nvl",
    name: "NVL",
    title: "NVL GPU Modules - GB200 NVL Cloud Pricing",
    description:
      "Compare NVL form factor GPUs (GB200 NVL) across cloud providers. Next-generation NVLink-connected GPU modules for AI supercomputing.",
    content: `NVL (NVIDIA NVLink) is the latest GPU module form factor introduced with the Blackwell architecture. NVL modules go beyond SXM by integrating multiple GPU dies into a single package with shared memory, enabling even tighter coupling between GPUs. The GB200 NVL superchip combines two B200 GPUs with a shared 192GB of HBM3e memory, functioning as a unified GPU with double the memory capacity and bandwidth.

This architecture represents NVIDIA's response to the increasing memory requirements of frontier AI models. By sharing memory between GPUs, NVL eliminates the need for model parallelism techniques that split models across GPUs and require extensive communication. The GB200 NVL delivers up to 20 petaflops of AI performance with 8 TB/s of memory bandwidth, making it ideal for training multi-trillion parameter models and running inference with massive batch sizes.

NVL modules are designed for exascale AI computing and are typically deployed in liquid-cooled systems due to their high thermal design power. In cloud environments, NVL instances represent the cutting edge of available GPU infrastructure and are priced accordingly. These systems are appropriate for organizations pushing the boundaries of AI model scale, including frontier model training, scientific computing at unprecedented scale, and hyperscale inference deployments. The NVL form factor is essentially the successor to SXM, offering even greater performance and integration at the cost of increased power requirements and specialized deployment needs.`,
    pros: [
      "Shared memory across GPU dies",
      "Highest performance and bandwidth",
      "Reduced inter-GPU communication",
      "Ideal for trillion-parameter models",
      "Future-proof architecture",
    ],
    cons: [
      "Highest cost per hour",
      "Requires liquid cooling",
      "Limited availability",
      "Specialized deployment required",
      "Overkill for most workloads",
    ],
    typicalGpus: ["gb200-nvl", "b200-nvl"],
  },
];

// Map instance names to form factors based on naming patterns
const FORM_FACTOR_PATTERNS: Record<string, RegExp[]> = {
  pcie: [/pcie/i, /p100/i, /v100/i, /rtx-/i, /l40/i, /a40/i],
  sxm: [/sxm/i, /h100/i, /h200/i, /a100.*80/i, /a100.*sxm/i],
  nvl: [/nvl/i, /gb200/i],
};

export async function generateStaticParams() {
  return FORM_FACTOR_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = FORM_FACTOR_PAGES.find((p) => p.slug === slug);
  if (!page) notFound();

  return {
    title: `${page.title} (${new Date().getFullYear()})`,
    description: page.description,
    alternates: { canonical: `/form-factor/${page.slug}` },
    openGraph: {
      title: page.title,
      description: page.description,
      url: `/form-factor/${page.slug}`,
    },
  };
}

export default async function FormFactorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = FORM_FACTOR_PAGES.find((p) => p.slug === slug);
  if (!page) notFound();

  // Get instances with this form factor
  const patterns = FORM_FACTOR_PATTERNS[slug] ?? [];

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
  }>(`/api/instances?limit=500&depth=1&where[is_active][equals]=true&sort=price_per_gpu_hour`, {
    next: { revalidate: 60 },
  });

  // Filter instances by form factor patterns
  const filteredInstances = instances.docs.filter((inst) =>
    patterns.some(
      (pattern) =>
        pattern.test(inst.gpu_slug) ||
        pattern.test(inst.instance_type) ||
        pattern.test(inst.gpu_short_name),
    ),
  );

  // Group by GPU slug to find unique GPUs
  const uniqueGpus = new Map<
    string,
    {
      gpuSlug: string;
      gpuName: string;
      gpuShortName: string;
      gpuVramGb: number;
      minPrice: number;
      providers: number;
    }
  >();

  for (const inst of filteredInstances) {
    const price = Number(inst.price_per_gpu_hour);
    if (!Number.isFinite(price)) continue;

    const existing = uniqueGpus.get(inst.gpu_slug);
    if (existing) {
      if (price < existing.minPrice) existing.minPrice = price;
      existing.providers += 1;
    } else {
      uniqueGpus.set(inst.gpu_slug, {
        gpuSlug: inst.gpu_slug,
        gpuName: inst.gpu_name,
        gpuShortName: inst.gpu_short_name,
        gpuVramGb: inst.gpu_vram_gb,
        minPrice: price,
        providers: 1,
      });
    }
  }

  const sortedGpus = [...uniqueGpus.values()].sort((a, b) => a.minPrice - b.minPrice);

  // Convert instances to PriceTable format
  const tableRows = filteredInstances.map((inst) => ({
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
        name: "Form Factors",
        item: "https://cloudgpus.io/form-factor",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: page.name,
        item: `https://cloudgpus.io/form-factor/${page.slug}`,
      },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `What is a ${page.name} GPU?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: page.description,
        },
      },
      {
        "@type": "Question",
        name: `What are the pros and cons of ${page.name} GPUs?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Pros: ${page.pros.slice(0, 3).join(", ")}. Cons: ${page.cons.slice(0, 3).join(", ")}.`,
        },
      },
      {
        "@type": "Question",
        name: "When should I choose this form factor?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            page.pros.includes("multi-GPU") || page.pros.includes("NVLink")
              ? `Choose ${page.name} GPUs for distributed training, multi-GPU workloads, and maximum performance requirements.`
              : `Choose ${page.name} GPUs for single-GPU workloads, development, and cost-effective inference.`,
        },
      },
    ],
  };

  const otherFormFactors = FORM_FACTOR_PAGES.filter((p) => p.slug !== slug);

  return (
    <div className="container">
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />

      <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          Home
        </Link>{" "}
        <span style={{ opacity: 0.5 }}>/</span>{" "}
        <Link href="/form-factor" style={{ textDecoration: "none" }}>
          Form Factors
        </Link>{" "}
        <span style={{ opacity: 0.5 }}>/</span> <span>{page.name}</span>
      </div>

      <div className="card" style={{ padding: 22 }}>
        <h1 style={{ marginTop: 0 }}>{page.title}</h1>
        <p className="muted" style={{ maxWidth: 860, lineHeight: 1.7 }}>
          {page.description}
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
            <div style={{ fontWeight: 800, fontSize: 20 }}>{filteredInstances.length}</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Form factor
            </div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{page.name}</div>
          </div>
        </div>
      </div>

      <div className="grid grid2" style={{ marginTop: 18 }}>
        <section className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>About {page.name} Form Factor</h2>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            {page.content.split("\n\n").map((para, i) => (
              <p key={i} style={{ marginTop: i === 0 ? 0 : 12, marginBottom: 0 }}>
                {para}
              </p>
            ))}
          </div>
        </section>

        <div className="grid grid2" style={{ gap: 18 }}>
          <section className="card" style={{ padding: 18 }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Pros</h2>
            <div className="muted" style={{ lineHeight: 1.8 }}>
              {page.pros.map((pro, i) => (
                <div key={i} style={{ display: "flex", gap: 8 }}>
                  <span style={{ color: "#22c55e" }}>+</span>
                  <span>{pro}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card" style={{ padding: 18 }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Cons</h2>
            <div className="muted" style={{ lineHeight: 1.8 }}>
              {page.cons.map((con, i) => (
                <div key={i} style={{ display: "flex", gap: 8 }}>
                  <span style={{ color: "#ef4444" }}>-</span>
                  <span>{con}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {tableRows.length > 0 ? (
        <div className="card" style={{ marginTop: 18, padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>{page.name} Instance Pricing</h2>
          <p className="muted" style={{ marginTop: 6, lineHeight: 1.7 }}>
            Cloud providers offering {page.name} form factor GPUs. Sorted by lowest price.
          </p>
          <div style={{ marginTop: 12 }}>
            <PriceTable gpuSlug={slug} rows={tableRows} />
          </div>
        </div>
      ) : null}

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Featured {page.name} GPUs</h2>
        <div className="grid grid3" style={{ gap: 12 }}>
          {sortedGpus.slice(0, 9).map((gpu) => (
            <Link
              key={gpu.gpuSlug}
              href={`/cloud-gpu/${seoGpuSlug(gpu.gpuSlug)}`}
              className="card"
              style={{ padding: 14, textDecoration: "none" }}
            >
              <div style={{ fontWeight: 700 }}>{gpu.gpuShortName}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                {gpu.gpuVramGb}GB VRAM
              </div>
              <div style={{ marginTop: 8, fontWeight: 600 }}>
                From ${gpu.minPrice.toFixed(2)}/hr
              </div>
            </Link>
          ))}
        </div>
      </section>

      {otherFormFactors.length > 0 ? (
        <section className="card" style={{ marginTop: 18, padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Other Form Factors</h2>
          <div className="grid grid3" style={{ gap: 12 }}>
            {otherFormFactors.map((ff) => (
              <Link
                key={ff.slug}
                href={`/form-factor/${ff.slug}`}
                className="card"
                style={{ padding: 14, textDecoration: "none" }}
              >
                <div style={{ fontWeight: 700 }}>{ff.name}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {ff.description.slice(0, 80)}...
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
