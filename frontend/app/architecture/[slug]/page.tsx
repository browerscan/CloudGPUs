import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { PriceTable } from "@/components/PriceTable";
import { comparePrices, listGpuModels } from "@/lib/api";
import { seoGpuSlug } from "@/lib/aliases";

export const revalidate = 300;

export type ArchitecturePage = {
  slug: string;
  name: string;
  title: string;
  description: string;
  content: string;
  specs: string;
  useCases: string[];
  relatedArchitectures: string[];
};

const ARCHITECTURE_PAGES: ArchitecturePage[] = [
  {
    slug: "blackwell",
    name: "Blackwell",
    title: "Blackwell GPU Architecture - B200, GB200 Pricing",
    description:
      "Compare Blackwell architecture GPUs (B200, GB200) across cloud providers. Next-gen NVIDIA AI GPUs with enhanced performance and efficiency.",
    content: `NVIDIA's Blackwell architecture represents the latest evolution in datacenter GPU design, succeeding the Hopper H100/H200 generation. Named after David Blackwell, a pioneering mathematician, the Blackwell architecture introduces significant advances in AI compute performance, memory bandwidth, and energy efficiency. The flagship B200 GPU delivers up to 20 petaflops of AI performance with FP4 precision, while the GB200 superchip combines two B200 GPUs connected via NVLink onto a single package with shared memory.

Blackwell GPUs feature 192GB of HBM3e memory per GPU with 8 TB/s of memory bandwidth, enabling them to run larger models without the need for model parallelism techniques that can complicate training pipelines. The architecture also introduces second-generation Transformer Engine for accelerated mixed-precision training, improved FP8 support, and enhanced NVLink networking with 1.8 TB/s per GPU interconnect bandwidth.

For cloud GPU users, Blackwell represents the cutting edge of AI infrastructure. Providers offering B200 and GB200 instances include major cloud platforms and specialized GPU cloud providers. Pricing reflects the premium nature of this architecture, but for organizations training frontier models or operating at massive scale, the performance-per-dollar improvement over H100 can justify the higher hourly rates. Key workloads that benefit from Blackwell include training multi-trillion parameter LLMs, large-scale reinforcement learning, and production inference serving with low latency requirements.`,
    specs:
      "**Memory:** Up to 192GB HBM3e per GPU\n**Bandwidth:** 8 TB/s memory bandwidth\n**AI Performance:** Up to 20 petaflops (FP4)\n**NVLink:** 1.8 TB/s interconnect\n**Process:** TSMC 4NP\n**Key SKUs:** B200 SXM, GB200 NVL Superchip",
    useCases: [
      "Frontier LLM training",
      "Multi-trillion parameter models",
      "High-frequency inference",
      "Scientific computing",
    ],
    relatedArchitectures: ["hopper", "ampere"],
  },
  {
    slug: "hopper",
    name: "Hopper",
    title: "Hopper GPU Architecture - H100, H200 Pricing",
    description:
      "Compare Hopper architecture GPUs (H100 SXM, H100 PCIe, H200) across cloud providers. High-performance AI GPUs for training and inference.",
    content: `NVIDIA's Hopper architecture, named after computer science pioneer Grace Hopper, powers the H100 and H200 GPUs that have become the gold standard for large-scale AI training and inference. Launched in 2022, Hopper introduced the Transformer Engine, a hardware feature that automatically adjusts precision between FP8 and FP16 during transformer model training, delivering up to 6x performance improvement over previous generation Ampere GPUs.

The H100 is available in both SXM (server-mounted) and PCIe form factors, with the SXM variant delivering significantly higher performance due to higher TDP and full NVLink connectivity. The H200, released later, increases HBM3e memory to 141GB with 4.8 TB/s bandwidth, making it particularly well-suited for inference workloads with large model footprints. Hopper GPUs feature 80GB or 141GB of memory depending on the SKU, with memory bandwidth up to 4.8 TB/s.

For cloud GPU users, Hopper represents the current mainstream choice for serious AI workloads. H100 instances are widely available across major cloud providers and specialized GPU clouds, with pricing that varies significantly based on region, availability, and form factor. The architecture excels at training large language models (up to 70B parameters efficiently), running production inference servers, and distributed training across multiple GPUs or nodes. When selecting Hopper instances, consider whether you need SXM for maximum performance or PCIe can suffice at lower cost, whether NVLink is required for your workload, and if spot instances are available for cost savings on fault-tolerant jobs.`,
    specs:
      "**Memory:** 80GB (H100) or 141GB (H200) HBM3/HBM3e\n**Bandwidth:** 3.35 TB/s (H100) or 4.8 TB/s (H200)\n**AI Performance:** Up to 4 petaflops (FP8)\n**NVLink:** 900 GB/s (H100 SXM)\n**Process:** TSMC 4N\n**Key SKUs:** H100 SXM, H100 PCIe, H200 SXM",
    useCases: [
      "LLM training",
      "Fine-tuning large models",
      "Production inference",
      "Multi-GPU training",
    ],
    relatedArchitectures: ["blackwell", "ampere"],
  },
  {
    slug: "ampere",
    name: "Ampere",
    title: "Ampere GPU Architecture - A100, A40, A30 Pricing",
    description:
      "Compare Ampere architecture GPUs (A100 40GB, A100 80GB, A40, A30) across cloud providers. Reliable datacenter GPUs for ML and HPC workloads.",
    content: `NVIDIA's Ampere architecture, launched in 2020, remains a workhorse for AI training and inference despite newer generations being available. The flagship A100 GPU established many of the standards that Hopper and Blackwell would build upon, including Multi-Instance GPU (MIG) technology that allows a single GPU to be partitioned into seven independent instances, and third-generation NVLink with 600 GB/s bandwidth.

A100 GPUs are available in 40GB and 80GB memory configurations, with the 80GB variant being preferred for most AI workloads due to its ability to fit larger models and batch sizes. The A40 and A30 offer cost-effective alternatives for inference and light training workloads, trading some performance for lower power consumption and reduced cost. Ampere also introduced sparse tensor acceleration and structural sparsity support for improved performance on certain workloads.

For cloud GPU users, Ampere GPUs represent an excellent balance of performance, availability, and cost. A100 instances are widely available across all major cloud providers, with pricing that has become increasingly attractive as H100 and Blackwell GPUs have entered the market. Many organizations find that Ampere GPUs provide sufficient performance for their workloads at significantly lower hourly rates. The architecture is particularly well-suited for training medium-sized models (up to 30B parameters with quantization), running vector databases with GPU acceleration, and production inference where the absolute latest performance isn't required.`,
    specs:
      "**Memory:** 40GB or 80GB HBM2e (A100)\n**Bandwidth:** 1.55 TB/s (40GB) or 2.04 TB/s (80GB)\n**AI Performance:** Up to 312 TFLOPS (FP16 Tensor Core)\n**NVLink:** 600 GB/s\n**Process:** TSMC 7nm\n**Key SKUs:** A100 40GB, A100 80GB, A40, A30",
    useCases: ["Fine-tuning", "Inference", "Vector databases", "Multi-GPU training"],
    relatedArchitectures: ["hopper", "blackwell"],
  },
  {
    slug: "adam",
    name: "Ada Lovelace",
    title: "Ada Lovelace GPU Architecture - RTX 4090, 5090 Pricing",
    description:
      "Compare Ada Lovelace architecture GPUs (RTX 4090, RTX 5090, RTX 6000 Ada) across cloud providers. High-performance consumer GPUs for AI and graphics.",
    content: `NVIDIA's Ada Lovelace architecture powers the RTX 4090, RTX 5090, and professional RTX 6000 Ada series GPUs. Named after the first computer programmer, Ada Lovelace represents the latest generation of NVIDIA's consumer and professional GPU lines, offering exceptional performance-per-dollar for AI workloads that don't require enterprise-grade features like NVLink or ECC memory.

The RTX 4090 and newer RTX 5090 offer 24GB of GDDR6X memory with extremely high bandwidth, making them excellent choices for image generation, fine-tuning smaller models, and inference workloads. While these consumer GPUs lack the interconnects and reliability features of datacenter GPUs, their raw performance and low cost make them popular for development, experimentation, and production use cases where fault tolerance isn't critical. The RTX 6000 Ada extends the architecture to 48GB of memory for more demanding workloads.

Ada Lovelace introduces third-generation RT cores for ray tracing acceleration, fourth-generation Tensor cores with support for the FP8 precision format used in modern AI training, and DLSS 3 frame generation for graphics workloads. The architecture also implements significant improvements in power efficiency compared to previous generations, allowing for higher sustained performance within thermal limits.

For cloud GPU users, Ada Lovelace GPUs offer an accessible entry point to GPU computing. Many providers offer RTX 4090 and 5090 instances at rates significantly lower than datacenter GPUs, making them ideal for hobbyists, students, and startups. These GPUs excel at Stable Diffusion and other image generation workloads, fine-tuning models up to 7B parameters, and running inference for models that fit within 24GB of VRAM. The trade-off is lack of enterprise features and potentially lower reliability compared to datacenter GPUs.`,
    specs:
      "**Memory:** 24GB GDDR6X (RTX 4090/5090), 48GB (RTX 6000 Ada)\n**Bandwidth:** 1 TB/s (RTX 4090), 1.8 TB/s (RTX 6000 Ada)\n**AI Performance:** Up to 330 TFLOPS (FP16 Tensor Core)\n**Consumer GPU:** No NVLink, no ECC\n**Process:** TSMC 4N\n**Key SKUs:** RTX 4090, RTX 5090, RTX 6000 Ada, L40",
    useCases: ["Image generation", "Fine-tuning", "Inference", "Development"],
    relatedArchitectures: ["ampere", "hopper"],
  },
  {
    slug: "hopper-predecessor",
    name: "Pascal & Volta",
    title: "Pascal and Volta GPU Architecture - V100, GTX 1080 Ti Pricing",
    description:
      "Compare older Pascal and Volta architecture GPUs (V100, Titan V) across cloud providers. Budget-friendly legacy GPU options.",
    content: `NVIDIA's Pascal and Volta architectures represent earlier generations of GPU design that remain relevant for certain workloads. The Volta V100 GPU was the first to introduce Tensor Cores specialized for AI compute, while Pascal GPUs like the GTX 1080 Ti and Titan Xp laid groundwork for consumer GPU acceleration of machine learning workloads.

The V100 with 16GB or 32GB of HBM2 memory offers 900 GB/s bandwidth and was the GPU of choice for many AI workloads prior to Ampere's release. While surpassed in raw performance by newer generations, V100 instances can still be found in the cloud at competitive prices for workloads that don't require the latest features. Pascal GPUs, while lacking Tensor Cores entirely, can still accelerate certain numerical computing tasks and inference workloads.

For cloud GPU users considering these older architectures, the primary consideration should be whether the cost savings outweigh the performance penalties compared to newer GPUs. Volta and Pascal GPUs may be appropriate for legacy codebases, experimentation, or workloads where GPU requirements are modest. However, for most AI workloads, even Ampere-generation GPUs offer significantly better performance-per-dollar. These architectures are also limited in software support, with newer CUDA versions and AI frameworks increasingly optimized for newer architectures.`,
    specs:
      "**V100 Memory:** 16GB or 32GB HBM2\n**V100 Bandwidth:** 900 GB/s\n**V100 AI Performance:** 125 TFLOPS (FP16 Tensor Core)\n**Process:** TSMC 12nm (Volta), 16nm (Pascal)\n**Key SKUs:** V100 16GB, V100 32GB, Titan V",
    useCases: ["Legacy workloads", "Light inference", "Experimentation"],
    relatedArchitectures: ["ampere"],
  },
];

const ARCHITECTURE_GPU_MAPPING: Record<string, RegExp[]> = {
  blackwell: [/b200/i, /gb200/i],
  hopper: [/h100/i, /h200/i],
  ampere: [/a100/i, /a40/i, /a30/i],
  adam: [/rtx-4090/i, /rtx-5090/i, /rtx-4080/i, /l40/i, /rtx-6000-ada/i, /l40s/i],
  "hopper-predecessor": [/v100/i, /p100/i],
};

export async function generateStaticParams() {
  return ARCHITECTURE_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = ARCHITECTURE_PAGES.find((p) => p.slug === slug);
  if (!page) notFound();

  return {
    title: `${page.title} (${new Date().getFullYear()})`,
    description: page.description,
    alternates: { canonical: `/architecture/${page.slug}` },
    openGraph: {
      title: page.title,
      description: page.description,
      url: `/architecture/${page.slug}`,
    },
  };
}

export default async function ArchitecturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = ARCHITECTURE_PAGES.find((p) => p.slug === slug);
  if (!page) notFound();

  // Get all GPUs and filter by architecture
  const gpus = await listGpuModels();
  const patterns = ARCHITECTURE_GPU_MAPPING[slug] ?? [];

  const filteredGpus = gpus.docs.filter((gpu) =>
    patterns.some((pattern) => pattern.test(gpu.slug) || pattern.test(gpu.architecture)),
  );

  // Fetch pricing for filtered GPUs
  const gpuPricing = await Promise.all(
    filteredGpus.map(async (gpu) => {
      try {
        const compare = await comparePrices(seoGpuSlug(gpu.slug));
        return { gpu, compare };
      } catch {
        return null;
      }
    }),
  );

  const withPricing = gpuPricing.filter((g): g is NonNullable<typeof g> => g !== null);
  const sorted = withPricing.sort(
    (a, b) => (a.compare.stats.min ?? Infinity) - (b.compare.stats.min ?? Infinity),
  );

  const allPrices = sorted.flatMap((item) => item.compare.prices);

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://cloudgpus.io/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Architectures",
        item: "https://cloudgpus.io/architecture",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: page.name,
        item: `https://cloudgpus.io/architecture/${page.slug}`,
      },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `What is the ${page.name} architecture?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: page.description,
        },
      },
      {
        "@type": "Question",
        name: `Which GPUs use ${page.name} architecture?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${page.name} architecture GPUs include: ${sorted
            .slice(0, 6)
            .map((s) => s.gpu.name)
            .join(
              ", ",
            )}. We track pricing across ${new Set(allPrices.map((p) => p.provider.slug)).size} cloud providers.`,
        },
      },
      {
        "@type": "Question",
        name: "What workloads benefit most from this architecture?",
        acceptedAnswer: {
          "@type": "Answer",
          text: page.useCases.join(", "),
        },
      },
    ],
  };

  const relatedArchPages = ARCHITECTURE_PAGES.filter((p) =>
    page.relatedArchitectures.includes(p.slug),
  );

  return (
    <div className="container">
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />

      <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          Home
        </Link>{" "}
        <span style={{ opacity: 0.5 }}>/</span>{" "}
        <Link href="/architecture" style={{ textDecoration: "none" }}>
          Architectures
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
            <div style={{ fontWeight: 800, fontSize: 20 }}>{sorted.length}</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              From
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>
              {sorted.length > 0 && sorted[0]?.compare.stats.min
                ? `$${sorted[0].compare.stats.min.toFixed(2)}/hr`
                : "—"}
            </div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Providers
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>
              {new Set(allPrices.map((p) => p.provider.slug)).size}
            </div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Generation
            </div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{page.name}</div>
          </div>
        </div>
      </div>

      <div className="grid grid2" style={{ marginTop: 18 }}>
        <section className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>About {page.name} Architecture</h2>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            {page.content.split("\n\n").map((para, i) => (
              <p key={i} style={{ marginTop: i === 0 ? 0 : 12, marginBottom: 0 }}>
                {para}
              </p>
            ))}
          </div>
        </section>

        <section className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Technical Specifications</h2>
          <div className="muted" style={{ lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
            {page.specs}
          </div>

          <h3 style={{ fontSize: 16, marginTop: 18, marginBottom: 8 }}>Best Use Cases</h3>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            {page.useCases.map((useCase, i) => (
              <div key={i}>- {useCase}</div>
            ))}
          </div>
        </section>
      </div>

      {sorted.length > 0 ? (
        <div className="card" style={{ marginTop: 18, padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>{page.name} GPU Pricing</h2>
          <p className="muted" style={{ marginTop: 6, lineHeight: 1.7 }}>
            Cloud providers offering {page.name} architecture GPUs. Sorted by lowest price.
          </p>
          <div style={{ marginTop: 12 }}>
            <PriceTable gpuSlug={slug} rows={allPrices} />
          </div>
        </div>
      ) : null}

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Featured {page.name} GPUs</h2>
        <div className="grid grid3" style={{ gap: 12 }}>
          {sorted.slice(0, 9).map(({ gpu, compare }) => (
            <Link
              key={gpu.slug}
              href={`/cloud-gpu/${seoGpuSlug(gpu.slug)}`}
              className="card"
              style={{ padding: 14, textDecoration: "none" }}
            >
              <div style={{ fontWeight: 700 }}>{gpu.name}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                {gpu.vram_gb}GB · {gpu.memory_type}
              </div>
              <div style={{ marginTop: 8, fontWeight: 600 }}>
                From ${compare.stats.min?.toFixed(2) ?? "—"}/hr
              </div>
            </Link>
          ))}
        </div>
      </section>

      {relatedArchPages.length > 0 ? (
        <section className="card" style={{ marginTop: 18, padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Related Architectures</h2>
          <div className="grid grid3" style={{ gap: 12 }}>
            {relatedArchPages.map((arch) => (
              <Link
                key={arch.slug}
                href={`/architecture/${arch.slug}`}
                className="card"
                style={{ padding: 14, textDecoration: "none" }}
              >
                <div style={{ fontWeight: 700 }}>{arch.name}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {arch.description.slice(0, 80)}...
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Architecture Comparison</h2>
        <div className="muted" style={{ lineHeight: 1.8 }}>
          <p style={{ marginTop: 0 }}>
            Choosing the right GPU architecture depends on your specific workload requirements,
            budget, and performance needs. Newer architectures like Blackwell and Hopper offer the
            best raw performance but come at a premium price. Ampere provides an excellent balance
            of performance and cost for most workloads, while Ada Lovelace consumer GPUs offer
            exceptional value for inference and fine-tuning tasks that don&apos;t require enterprise
            features.
          </p>
          <p style={{ marginBottom: 0 }}>
            When comparing architectures, consider VRAM capacity for your model sizes, memory
            bandwidth for training throughput, interconnects like NVLink for multi-GPU scaling, and
            software support from frameworks like PyTorch and TensorFlow. Older architectures may
            offer cost savings but could lack optimization in newer software releases.
          </p>
        </div>
      </section>
    </div>
  );
}
