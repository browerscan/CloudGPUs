import type { Metadata } from "next";
import Link from "next/link";
import { listGpuModels } from "@/lib/api";
import { seoGpuSlug } from "@/lib/aliases";
import { JsonLd } from "@/components/JsonLd";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cloud GPU Pricing Comparison 2025 - H100, A100, RTX 4090 Hourly Rates",
  description:
    "Compare real-time cloud GPU pricing for NVIDIA H100 ($1.99-4/hr), A100 ($0.75-2/hr), RTX 4090 ($0.30-0.80/hr), and 30+ other GPUs. Updated hourly from 20+ providers.",
  alternates: { canonical: "/cloud-gpu" },
  openGraph: {
    title: "Cloud GPU Pricing Comparison 2025 - H100, A100, RTX 4090 Hourly Rates",
    description:
      "Compare real-time cloud GPU pricing for NVIDIA H100 ($1.99-4/hr), A100 ($0.75-2/hr), RTX 4090 ($0.30-0.80/hr), and 30+ other GPUs.",
    url: "https://cloudgpus.io/cloud-gpu",
  },
};

// GPU categories for quick navigation
const GPU_CATEGORIES = [
  {
    name: "Datacenter GPUs",
    description: "Enterprise-grade GPUs for production AI workloads",
    gpus: ["h100-sxm", "h200-sxm", "a100-80gb", "a100-40gb", "l40s"],
  },
  {
    name: "Consumer GPUs",
    description: "High-performance consumer GPUs for inference and fine-tuning",
    gpus: ["rtx-4090", "rtx-5090", "rtx-4080", "rtx-3090"],
  },
  {
    name: "Next-Gen GPUs",
    description: "Latest Blackwell architecture for cutting-edge performance",
    gpus: ["b200-sxm", "b100-sxm", "gb200-nvl"],
  },
];

export default async function CloudGpuIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const res = await listGpuModels().catch(() => null);
  const apiOk = res != null;

  const filtered = (() => {
    const docs = res?.docs ?? [];
    return q
      ? docs.filter((g) => `${g.name} ${g.slug} ${g.short_name}`.toLowerCase().includes(q))
      : docs;
  })();

  // Structured data for ItemList
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Cloud GPU Pricing Catalog",
    description: "Complete list of cloud GPUs with real-time pricing comparison",
    numberOfItems: filtered.length,
    itemListElement: filtered.slice(0, 20).map((gpu, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: gpu.name,
      url: `https://cloudgpus.io/cloud-gpu/${seoGpuSlug(gpu.slug)}`,
    })),
  };

  return (
    <div className="container">
      <JsonLd data={itemListSchema} />

      <div className="card" style={{ padding: 22 }}>
        <h1 style={{ marginTop: 0 }}>Cloud GPU Pricing Comparison (2025)</h1>
        <p className="muted" style={{ maxWidth: 820, lineHeight: 1.7 }}>
          Compare real-time hourly GPU pricing across 20+ cloud providers. Each GPU page shows
          on-demand and spot rates, provider availability, and price history. Find the best deals
          for AI training, inference, and rendering workloads.
        </p>

        <form style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search GPUs (e.g., h100, rtx 5090, l40s)"
            style={{
              flex: "1 1 360px",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(15, 23, 42, 0.12)",
            }}
          />
          <button className="btn" type="submit">
            Search
          </button>
          {q ? (
            <Link className="btn btnSecondary" href="/cloud-gpu">
              Clear
            </Link>
          ) : null}
        </form>
      </div>

      {/* Quick Price Reference */}
      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Quick Price Reference (January 2025)</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(15, 23, 42, 0.1)" }}>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>GPU</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>VRAM</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>On-Demand</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Spot</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Best For</th>
              </tr>
            </thead>
            <tbody className="muted">
              <tr style={{ borderBottom: "1px solid rgba(15, 23, 42, 0.05)" }}>
                <td style={{ padding: "10px 8px" }}>
                  <Link href="/cloud-gpu/nvidia-h100" style={{ fontWeight: 600 }}>
                    H100 SXM
                  </Link>
                </td>
                <td style={{ padding: "10px 8px" }}>80GB</td>
                <td style={{ padding: "10px 8px" }}>$1.99-4.00/hr</td>
                <td style={{ padding: "10px 8px" }}>$0.99-2.00/hr</td>
                <td style={{ padding: "10px 8px" }}>LLM training, 7B-70B models</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(15, 23, 42, 0.05)" }}>
                <td style={{ padding: "10px 8px" }}>
                  <Link href="/cloud-gpu/nvidia-a100-80gb" style={{ fontWeight: 600 }}>
                    A100 80GB
                  </Link>
                </td>
                <td style={{ padding: "10px 8px" }}>80GB</td>
                <td style={{ padding: "10px 8px" }}>$1.29-2.50/hr</td>
                <td style={{ padding: "10px 8px" }}>$0.75-1.50/hr</td>
                <td style={{ padding: "10px 8px" }}>Training, inference, fine-tuning</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(15, 23, 42, 0.05)" }}>
                <td style={{ padding: "10px 8px" }}>
                  <Link href="/cloud-gpu/nvidia-rtx-4090" style={{ fontWeight: 600 }}>
                    RTX 4090
                  </Link>
                </td>
                <td style={{ padding: "10px 8px" }}>24GB</td>
                <td style={{ padding: "10px 8px" }}>$0.34-0.80/hr</td>
                <td style={{ padding: "10px 8px" }}>$0.20-0.40/hr</td>
                <td style={{ padding: "10px 8px" }}>Inference, fine-tuning, Stable Diffusion</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(15, 23, 42, 0.05)" }}>
                <td style={{ padding: "10px 8px" }}>
                  <Link href="/cloud-gpu/nvidia-l40s" style={{ fontWeight: 600 }}>
                    L40S
                  </Link>
                </td>
                <td style={{ padding: "10px 8px" }}>48GB</td>
                <td style={{ padding: "10px 8px" }}>$0.80-1.50/hr</td>
                <td style={{ padding: "10px 8px" }}>$0.50-1.00/hr</td>
                <td style={{ padding: "10px 8px" }}>Balanced training/inference</td>
              </tr>
              <tr>
                <td style={{ padding: "10px 8px" }}>
                  <Link href="/cloud-gpu/nvidia-h200" style={{ fontWeight: 600 }}>
                    H200 SXM
                  </Link>
                </td>
                <td style={{ padding: "10px 8px" }}>141GB</td>
                <td style={{ padding: "10px 8px" }}>$4.00-8.00/hr</td>
                <td style={{ padding: "10px 8px" }}>$2.50-5.00/hr</td>
                <td style={{ padding: "10px 8px" }}>70B+ models, large context</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
          Prices updated continuously. Click any GPU for detailed provider comparison and price
          history.
        </p>
      </section>

      <section style={{ marginTop: 18 }}>
        <h2 style={{ margin: "12px 0" }}>All GPU Models</h2>
        <div className="grid grid3">
          {filtered.map((gpu) => (
            <Link
              key={gpu.slug}
              href={`/cloud-gpu/${seoGpuSlug(gpu.slug)}`}
              className="card"
              style={{ padding: 18 }}
            >
              <div style={{ fontWeight: 800 }}>{gpu.name}</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                {gpu.vram_gb}GB · {gpu.architecture} · {gpu.slug}
              </div>
            </Link>
          ))}
          {!filtered.length ? (
            apiOk ? (
              <div className="card muted" style={{ padding: 18, lineHeight: 1.7 }}>
                {q ? (
                  <>
                    No GPUs matched <code>{q}</code>. Try searching by slug (for example:{" "}
                    <code>h100-sxm</code>, <code>rtx-5090</code>).
                  </>
                ) : (
                  <>No GPUs in the catalog yet.</>
                )}
              </div>
            ) : (
              <div className="card muted" style={{ padding: 18, lineHeight: 1.7 }}>
                GPU catalog is unavailable. Configure <code>NEXT_PUBLIC_API_BASE_URL</code> and try
                again.
              </div>
            )
          ) : null}
        </div>
      </section>

      {/* Comprehensive SEO Content */}
      <section className="card" style={{ marginTop: 24, padding: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 20 }}>
          Understanding Cloud GPU Pricing: A Complete Guide
        </h2>

        <div style={{ lineHeight: 1.8, fontSize: 15 }}>
          <p>
            Cloud GPU pricing varies dramatically based on the GPU model, provider type, and
            instance configuration. Understanding these pricing dynamics helps you optimize compute
            costs by 40-60% compared to using default hyperscaler options.
          </p>

          <h3 style={{ marginTop: 24 }}>Datacenter GPUs vs Consumer GPUs</h3>
          <p>
            The distinction between datacenter and consumer GPUs fundamentally affects both pricing
            and capabilities. Datacenter GPUs like the NVIDIA H100 and A100 are designed for 24/7
            operation in climate-controlled data centers. They feature ECC memory for error
            correction, higher memory bandwidth (3.35 TB/s for H100 vs 1 TB/s for RTX 4090), and
            specialized interconnects like NVLink that enable efficient multi-GPU scaling.
          </p>

          <p>
            Consumer GPUs like the RTX 4090 and RTX 5090 offer exceptional single-GPU performance at
            lower price points. The RTX 4090 delivers approximately 83 TFLOPS of FP16 compute at
            $0.30-0.80/hour, making it one of the most cost-effective options for inference
            workloads and smaller training jobs. However, consumer GPUs lack NVLink, limiting their
            utility for distributed training where inter-GPU communication is critical.
          </p>

          <h3 style={{ marginTop: 24 }}>VRAM Requirements by Workload</h3>
          <p>
            VRAM (Video RAM) is often the primary constraint when selecting a cloud GPU. Different
            workloads have vastly different memory requirements:
          </p>

          <p>
            <strong>LLM Inference:</strong> Running a 7B parameter model requires approximately 14GB
            in FP16 or 7GB in INT8 quantization. For a 70B model, you need 140GB+ in FP16, making
            multi-GPU setups or quantization essential. The H200 with 141GB VRAM can run 70B models
            on a single GPU, while 8x A100 80GB nodes provide 640GB for larger deployments.
          </p>

          <p>
            <strong>LLM Training:</strong> Training memory requirements are 3-4x higher than
            inference due to optimizer states and gradients. Training a 7B model typically requires
            40-80GB of VRAM, while 70B models need 320-640GB across multiple GPUs. The H100 SXM with
            its 900 GB/s NVLink bandwidth enables efficient gradient synchronization across 8-GPU
            nodes.
          </p>

          <p>
            <strong>Image Generation:</strong> Stable Diffusion XL runs comfortably on 16GB GPUs,
            making RTX 4090 (24GB) an excellent choice at $0.30-0.50/hour. For batch generation or
            higher resolutions, L40S (48GB) provides headroom at $0.80-1.50/hour.
          </p>

          <h3 style={{ marginTop: 24 }}>On-Demand vs Spot Pricing</h3>
          <p>
            Cloud GPU providers offer two primary pricing models. On-demand pricing guarantees
            instance availability but costs 50-200% more than spot alternatives. For example, an
            H100 might cost $3.50/hour on-demand but only $1.50-2.00/hour for spot instances.
          </p>

          <p>
            Spot instances (also called preemptible or interruptible) offer significant savings but
            can be reclaimed with 30-120 seconds notice when demand exceeds supply. For training
            workloads, I recommend spot instances with checkpointing every 5-10 minutes. The savings
            typically outweigh the overhead of occasional restarts.
          </p>

          <p>
            For production inference serving real-time traffic, on-demand instances are essential.
            The latency impact of instance interruption is unacceptable for user-facing
            applications, and the cost difference is manageable when amortized across high request
            volumes.
          </p>

          <h3 style={{ marginTop: 24 }}>Provider Tier Comparison</h3>
          <p>
            I categorize cloud GPU providers into three tiers based on pricing and reliability
            characteristics:
          </p>

          <p>
            <strong>Tier 1 - Hyperscalers (AWS, GCP, Azure):</strong> Highest prices ($3-8/hour for
            H100) but strongest reliability guarantees, SLAs, and enterprise features. Best for
            production inference and regulated industries requiring compliance certifications.
          </p>

          <p>
            <strong>Tier 2 - Specialized AI Clouds (Lambda Labs, CoreWeave, Nebius):</strong>{" "}
            Competitive pricing ($2-4/hour for H100) with good reliability. These providers focus
            exclusively on AI/ML workloads and often include NVLink/InfiniBand configurations
            optimized for distributed training. Best balance of price and reliability for most
            teams.
          </p>

          <p>
            <strong>Tier 3 - Marketplaces (RunPod, Vast.ai, TensorDock):</strong> Lowest prices
            ($1-2/hour for H100, $0.30-0.50/hour for RTX 4090) but variable reliability. These
            platforms aggregate capacity from data centers and individual GPU owners. Ideal for
            experimentation, batch processing, and fault-tolerant workloads.
          </p>

          <h3 style={{ marginTop: 24 }}>Cost Optimization Strategies</h3>
          <p>
            <strong>1. Match GPU to workload:</strong> Do not default to H100 when A100 or L40S
            would suffice. For inference, RTX 4090 often delivers better tokens-per-dollar than
            enterprise GPUs.
          </p>

          <p>
            <strong>2. Use spot for training:</strong> With proper checkpointing, spot instances
            reduce training costs by 50-70%. Tools like DeepSpeed and PyTorch Lightning support
            automatic checkpoint recovery.
          </p>

          <p>
            <strong>3. Consider region arbitrage:</strong> GPU prices vary by region. US-East and
            EU-West are typically 10-20% more expensive than US-Central or Asia-Pacific regions.
          </p>

          <p>
            <strong>4. Optimize batch sizes:</strong> Larger batch sizes improve GPU utilization,
            reducing cost-per-sample. However, ensure your model convergence is not affected by
            batch size changes.
          </p>

          <p>
            <strong>5. Use quantization for inference:</strong> INT8 or INT4 quantization reduces
            memory requirements by 50-75%, enabling cheaper GPUs for the same model. The accuracy
            impact is often negligible for inference.
          </p>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Next Steps</h2>
        <div className="muted" style={{ lineHeight: 1.8 }}>
          <div>
            New to cloud GPUs? Start with{" "}
            <Link href="/best-gpu-for">best GPUs for common workloads</Link>.
          </div>
          <div>
            Comparing providers? Try <Link href="/compare">provider vs provider comparisons</Link>.
          </div>
          <div>
            Estimating spend? Use the{" "}
            <Link href="/calculator/cost-estimator">GPU cloud cost calculator</Link>.
          </div>
          <div>
            Need specific regions? Check <Link href="/region">GPU availability by region</Link>.
          </div>
        </div>
      </section>
    </div>
  );
}
