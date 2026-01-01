import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { PriceTable } from "@/components/PriceTable";
import { comparePrices, listGpuModels } from "@/lib/api";
import { seoGpuSlug } from "@/lib/aliases";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "GPUs over 80GB VRAM - High Memory Cloud GPU Pricing",
    description:
      "Compare cloud GPUs with over 80GB of VRAM for large language models and high-memory workloads.",
    alternates: { canonical: "/gpus-over-80gb-vram" },
    openGraph: {
      title: "GPUs over 80GB VRAM - High Memory Cloud GPU Pricing",
      description: "Compare cloud GPUs with over 80GB of VRAM for large language models.",
      url: "/gpus-over-80gb-vram",
    },
  };
}

export default async function GpusOver80gbPage() {
  // Get all GPUs and filter by VRAM
  const gpus = await listGpuModels();
  const filteredGpus = gpus.docs.filter((g) => g.vram_gb >= 80);

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
        name: "GPUs over 80GB VRAM",
        item: "https://cloudgpus.io/gpus-over-80gb-vram",
      },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Which GPUs have over 80GB of VRAM?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `GPUs with 80GB+ VRAM include H100 SXM (80GB), H200 (141GB), A100 80GB, GB200 (192GB), and B200 (192GB per GPU). These high-memory GPUs are essential for training and running large language models.`,
        },
      },
      {
        "@type": "Question",
        name: "What can you do with 80GB+ VRAM?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "With 80GB+ VRAM, you can train LLMs up to 70B parameters with full precision, run inference on 100B+ parameter models, perform large-scale fine-tuning, and work with high-resolution video generation and 3D rendering workloads.",
        },
      },
      {
        "@type": "Question",
        name: "Is 80GB VRAM enough for LLM training?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "80GB VRAM is sufficient for training models up to 70B parameters with techniques like Flash Attention, mixed precision training, and gradient checkpointing. For larger models, you'll need multi-GPU setups with NVLink or model parallelism.",
        },
      },
    ],
  };

  const vramRanges = [
    { label: "80-95GB", min: 80, max: 95 },
    { label: "96-143GB", min: 96, max: 143 },
    { label: "144GB+", min: 144, max: Infinity },
  ];

  const gpusByRange = vramRanges.map((range) => ({
    ...range,
    gpus: sorted.filter((g) => g.gpu.vram_gb >= range.min && g.gpu.vram_gb <= range.max),
  }));

  return (
    <div className="container">
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />

      <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          Home
        </Link>{" "}
        <span style={{ opacity: 0.5 }}>/</span> <span>GPUs over 80GB VRAM</span>
      </div>

      <div className="card" style={{ padding: 22 }}>
        <h1 style={{ marginTop: 0 }}>GPUs with 80GB+ VRAM</h1>
        <p className="muted" style={{ maxWidth: 860, lineHeight: 1.7 }}>
          Compare cloud GPUs with 80GB or more of VRAM. High-memory GPUs are essential for training
          large language models, running inference on massive models, and workloads that require
          significant memory for data and model weights.
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
              Max VRAM
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>
              {sorted.length > 0 ? `${Math.max(...sorted.map((s) => s.gpu.vram_gb))}GB` : "—"}
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
        </div>
      </div>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Why High VRAM Matters</h2>
        <div className="muted" style={{ lineHeight: 1.8 }}>
          <p style={{ marginTop: 0 }}>
            GPU memory (VRAM) is often the limiting factor for AI workloads. More VRAM enables:
          </p>
          <ul style={{ marginBottom: 12 }}>
            <li>
              <strong>Larger batch sizes:</strong> Train with more samples per batch for better
              gradient estimates and faster convergence
            </li>
            <li>
              <strong>Bigger models:</strong> Fit more parameters on a single GPU, reducing or
              eliminating the need for model parallelism
            </li>
            <li>
              <strong>Longer context windows:</strong> Run inference with larger context lengths for
              RAG and long-document processing
            </li>
            <li>
              <strong>Complex workloads:</strong> Handle high-resolution image generation, 3D
              rendering, and scientific computing datasets
            </li>
          </ul>
          <p>
            For LLM training, 80GB VRAM is considered the minimum for comfortable training of 7B-13B
            parameter models without aggressive optimization. The H100 with 80GB HBM3 and H200 with
            141GB HBM3e represent the current standard for production AI infrastructure. The newer
            Blackwell architecture pushes this further with 192GB of HBM3e per GPU, enabling
            training of models with 1T+ parameters on fewer GPUs.
          </p>
          <p style={{ marginBottom: 0 }}>
            When selecting a high-VRAM GPU, consider memory bandwidth alongside capacity. HBM3/HBM3e
            memory provides much higher bandwidth than GDDR6X, which can be just as important as
            capacity for training speed. Also consider whether the GPU supports NVLink for multi-GPU
            memory pooling.
          </p>
        </div>
      </section>

      {allPrices.length > 0 ? (
        <div className="card" style={{ marginTop: 18, padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>High-VRAM GPU Pricing</h2>
          <p className="muted" style={{ marginTop: 6, lineHeight: 1.7 }}>
            Cloud providers offering GPUs with 80GB+ VRAM. Sorted by lowest price.
          </p>
          <div style={{ marginTop: 12 }}>
            <PriceTable gpuSlug="high-vram" rows={allPrices} />
          </div>
        </div>
      ) : null}

      {gpusByRange.map((range) =>
        range.gpus.length > 0 ? (
          <section key={range.label} className="card" style={{ marginTop: 18, padding: 18 }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>GPUs with {range.label} VRAM</h2>
            <div className="grid grid3" style={{ gap: 12 }}>
              {range.gpus.map(({ gpu, compare }) => (
                <Link
                  key={gpu.slug}
                  href={`/cloud-gpu/${seoGpuSlug(gpu.slug)}`}
                  className="card"
                  style={{ padding: 14, textDecoration: "none" }}
                >
                  <div style={{ fontWeight: 700 }}>{gpu.name}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {gpu.vram_gb}GB {gpu.memory_type} · {gpu.architecture}
                  </div>
                  <div style={{ marginTop: 8, fontWeight: 600 }}>
                    From ${compare.stats.min?.toFixed(2) ?? "—"}/hr
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null,
      )}

      <div className="grid grid2" style={{ marginTop: 18 }}>
        <section className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>VRAM Size Guide</h2>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            <p style={{ marginTop: 0 }}>
              <strong>16-24GB:</strong> Good for inference on 7B models, image generation,
              fine-tuning small models
            </p>
            <p>
              <strong>48GB:</strong> Suitable for 13B-30B model inference, medium model fine-tuning
            </p>
            <p>
              <strong>80GB:</strong> Standard for 70B model training, large-scale inference, and
              fine-tuning
            </p>
            <p>
              <strong>141GB+: </strong> Frontier model training, 100B+ parameter models, maximum
              context lengths
            </p>
            <p style={{ marginBottom: 0 }}>
              <strong>192GB+: </strong> Multi-trillion parameter training, exascale AI, research
              workloads
            </p>
          </div>
        </section>

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
                High-bandwidth GPU interconnect
              </div>
            </Link>
            <Link
              href="/gpus-with-infiniband"
              className="card"
              style={{ padding: 12, textDecoration: "none" }}
            >
              <div style={{ fontWeight: 700 }}>GPUs with InfiniBand</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Multi-node networking for distributed training
              </div>
            </Link>
            <Link
              href="/architecture/hopper"
              className="card"
              style={{ padding: 12, textDecoration: "none" }}
            >
              <div style={{ fontWeight: 700 }}>Hopper Architecture</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                H100, H200 high-VRAM GPUs
              </div>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
