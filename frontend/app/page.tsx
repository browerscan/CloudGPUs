import Link from "next/link";
import { getCheapestToday, listGpuModels } from "@/lib/api";
import { seoGpuSlug } from "@/lib/aliases";
import { JsonLd } from "@/components/JsonLd";

export const revalidate = 60;

// Most searched GPUs based on industry trends
const MOST_SEARCHED_GPUS = ["h100-sxm", "a100-80gb", "rtx-4090", "h200-sxm", "l40s", "rtx-5090"];

// Use case categories for navigation
const USE_CASE_CATEGORIES = [
  { slug: "llm-training", name: "LLM Training", icon: "Training" },
  { slug: "llm-inference", name: "LLM Inference", icon: "Inference" },
  { slug: "stable-diffusion", name: "Stable Diffusion", icon: "Image" },
  { slug: "fine-tuning", name: "Fine-Tuning", icon: "Tuning" },
  { slug: "rag", name: "RAG", icon: "Search" },
  { slug: "video-generation", name: "Video Gen", icon: "Video" },
];

export default async function HomePage() {
  const [gpus, cheapest] = await Promise.all([listGpuModels(), getCheapestToday()]).catch(() => [
    null,
    null,
  ]);

  const allGpus = gpus?.docs ?? [];
  const featured = allGpus.slice(0, 6);

  // Find most searched GPUs
  const mostSearched = MOST_SEARCHED_GPUS.map((slug) =>
    allGpus.find((g) => g.slug === slug),
  ).filter((g): g is Exclude<typeof g, undefined> => g !== undefined);

  type Cheapest = Awaited<ReturnType<typeof getCheapestToday>>;
  const cheapestData: Cheapest =
    cheapest ??
    ({
      generatedAt: new Date().toISOString(),
      items: [],
    } satisfies Cheapest);

  // Identify price drops (items with significantly lower prices)
  const bestDeals = (
    cheapestData.items.length > 0
      ? [...cheapestData.items]
          .sort((a, b) => a.cheapestPricePerGpuHour - b.cheapestPricePerGpuHour)
          .slice(0, 6)
      : []
  ).map((deal) => ({
    ...deal,
    gpu: allGpus.find((g) => g.slug === deal.gpuSlug),
  }));

  // FAQ Schema for rich results
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is the cheapest cloud GPU for AI training?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The cheapest cloud GPUs for AI training start around $0.20-0.40/hour for RTX 4090s on marketplace providers like Vast.ai and RunPod. For enterprise workloads, A100 40GB instances start at approximately $0.75-1.50/hour depending on provider and region.",
        },
      },
      {
        "@type": "Question",
        name: "How much does an H100 GPU cost per hour in the cloud?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "NVIDIA H100 cloud pricing ranges from $1.99-4.00/hour for on-demand instances across providers. Spot instances can be 50-70% cheaper. Prices vary by provider, region, and configuration (PCIe vs SXM, single GPU vs multi-GPU nodes).",
        },
      },
      {
        "@type": "Question",
        name: "Which cloud provider has the best GPU pricing?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Specialized AI clouds like Lambda Labs, RunPod, and Vast.ai typically offer 40-60% lower GPU pricing than hyperscalers (AWS, GCP, Azure). The best provider depends on your workload: marketplaces offer lowest prices, while specialized neoclouds balance price with reliability.",
        },
      },
      {
        "@type": "Question",
        name: "What GPU should I use for training large language models?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "For LLM training, choose based on model size: 7B models need 40-80GB VRAM (A100 80GB or 4x RTX 4090), 70B models need 320-640GB (8x A100 or 4x H100). The H100 SXM offers the best performance with its Transformer Engine and NVLink, while A100s provide better value for smaller-scale training.",
        },
      },
    ],
  };

  // How-To Schema for the comparison process
  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Compare Cloud GPU Prices",
    description:
      "Find the best cloud GPU pricing for your AI workload by comparing providers, understanding pricing models, and selecting the right GPU.",
    step: [
      {
        "@type": "HowToStep",
        name: "Identify Your Workload",
        text: "Determine whether you need GPUs for training, inference, or fine-tuning. Training requires more VRAM and benefits from multi-GPU scaling.",
      },
      {
        "@type": "HowToStep",
        name: "Check VRAM Requirements",
        text: "Calculate the VRAM needed for your model. A 7B parameter model needs ~40GB for training, while a 70B model requires 320GB+ across multiple GPUs.",
      },
      {
        "@type": "HowToStep",
        name: "Compare Provider Pricing",
        text: "Use CloudGPUs.io to compare on-demand and spot prices across providers. Specialized AI clouds often offer 40-60% savings vs hyperscalers.",
      },
      {
        "@type": "HowToStep",
        name: "Evaluate Provider Features",
        text: "Consider reliability tier, API access, billing increments, and region availability. Production workloads may justify premium pricing for better SLAs.",
      },
    ],
  };

  return (
    <div className="container">
      <JsonLd data={faqSchema} />
      <JsonLd data={howToSchema} />

      <div className="grid grid2" style={{ alignItems: "start" }}>
        <section className="card" style={{ padding: 22 }}>
          <h1 style={{ marginTop: 0, fontSize: 34, letterSpacing: "-0.02em" }}>
            Compare Cloud GPU Prices for AI Training and Inference
          </h1>
          <p className="muted" style={{ fontSize: 16, lineHeight: 1.6 }}>
            CloudGPUs.io aggregates real-time pricing across 20+ cloud providers so you can find the
            best on-demand and spot rates for H100, A100, RTX 4090, and other popular GPUs. Stop
            overpaying for compute.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <Link className="btn" href="/cloud-gpu">
              Browse GPUs
            </Link>
            <Link className="btn btnSecondary" href="/provider">
              Browse providers
            </Link>
          </div>
        </section>
        <section className="card" style={{ padding: 22 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Cheapest today (sample)</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            Updated: {new Date(cheapestData.generatedAt).toLocaleString()}
          </p>
          <div className="grid" style={{ marginTop: 14 }}>
            {cheapestData.items.slice(0, 8).map((item) => (
              <div
                key={item.gpuSlug}
                style={{ display: "flex", justifyContent: "space-between", gap: 16 }}
              >
                <Link href={`/cloud-gpu/${seoGpuSlug(item.gpuSlug)}`} style={{ fontWeight: 700 }}>
                  {item.gpuName}
                </Link>
                <span className="muted" style={{ whiteSpace: "nowrap" }}>
                  {item.cheapestProvider} · ${item.cheapestPricePerGpuHour.toFixed(2)}/hr
                </span>
              </div>
            ))}
            {!cheapestData.items.length ? (
              <div className="muted" style={{ lineHeight: 1.7 }}>
                Pricing data is unavailable right now. Check your API configuration and try again.
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {/* Use Case Quick Navigation */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ margin: "12px 0" }}>Find the Best GPU for Your Workload</h2>
        <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
          Select your use case to get GPU recommendations based on VRAM requirements and cost
          efficiency.
        </p>
        <div className="grid grid3" style={{ gap: 12 }}>
          {USE_CASE_CATEGORIES.map((uc) => (
            <Link
              key={uc.slug}
              href={`/best-gpu-for/${uc.slug}`}
              className="card"
              style={{ padding: 16, textAlign: "center" }}
            >
              <div style={{ fontWeight: 700 }}>{uc.name}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Most Searched GPUs */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ margin: "12px 0" }}>Most Searched GPUs</h2>
        <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
          Popular GPUs for LLM training, inference, and generative AI workloads.
        </p>
        <div className="grid grid3">
          {mostSearched.map((gpu) => (
            <Link
              key={gpu.slug}
              href={`/cloud-gpu/${seoGpuSlug(gpu.slug)}`}
              className="card"
              style={{ padding: 18 }}
            >
              <div style={{ fontWeight: 800 }}>{gpu.name}</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                {gpu.vram_gb}GB · {gpu.architecture}
              </div>
            </Link>
          ))}
          {!mostSearched.length ? (
            <div className="card muted" style={{ padding: 18, lineHeight: 1.7 }}>
              No GPU catalog data available. Configure <code>NEXT_PUBLIC_API_BASE_URL</code> and try
              again.
            </div>
          ) : null}
        </div>
      </section>

      {/* Today's Best Deals */}
      {bestDeals.length > 0 ? (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ margin: "12px 0" }}>Today's Best Deals</h2>
          <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
            Lowest observed prices across all providers. Updated every few minutes.
          </p>
          <div className="grid grid3">
            {bestDeals.map((deal) => (
              <Link
                key={deal.gpuSlug}
                href={`/cloud-gpu/${seoGpuSlug(deal.gpuSlug)}`}
                className="card"
                style={{ padding: 18 }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}
                >
                  <div style={{ fontWeight: 800 }}>{deal.gpuName}</div>
                  {deal.gpu?.vram_gb ? (
                    <span className="badge" style={{ fontSize: 11 }}>
                      {deal.gpu.vram_gb}GB
                    </span>
                  ) : null}
                </div>
                <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                  {deal.cheapestProvider}
                </div>
                <div style={{ marginTop: 8, fontWeight: 700, fontSize: 18, color: "#22c55e" }}>
                  ${deal.cheapestPricePerGpuHour.toFixed(2)}/hr
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section style={{ marginTop: 24 }}>
        <h2 style={{ margin: "12px 0" }}>Popular GPUs</h2>
        <div className="grid grid3">
          {featured.map((gpu) => (
            <Link
              key={gpu.slug}
              href={`/cloud-gpu/${seoGpuSlug(gpu.slug)}`}
              className="card"
              style={{ padding: 18 }}
            >
              <div style={{ fontWeight: 800 }}>{gpu.name}</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                {gpu.vram_gb}GB · {gpu.architecture}
              </div>
            </Link>
          ))}
          {!featured.length ? (
            <div className="card muted" style={{ padding: 18, lineHeight: 1.7 }}>
              No GPU catalog data available. Configure <code>NEXT_PUBLIC_API_BASE_URL</code> and try
              again.
            </div>
          ) : null}
        </div>
      </section>

      {/* SEO Content Section - Cloud GPU Market Overview */}
      <section className="card" style={{ marginTop: 32, padding: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 22 }}>
          The Complete Guide to Cloud GPU Pricing in 2025
        </h2>

        <div style={{ lineHeight: 1.8, fontSize: 15 }}>
          <p>
            The cloud GPU market is experiencing explosive growth. According to industry research,
            the GPU-as-a-Service market reached approximately $5.7 billion in 2025 and is projected
            to grow to $21-50 billion by 2030-2032, representing a compound annual growth rate
            (CAGR) of 26-36%. This growth is driven primarily by the surge in AI workloads,
            particularly large language model (LLM) training and inference.
          </p>

          <h3 style={{ marginTop: 24 }}>Why Cloud GPUs Matter for AI Development</h3>
          <p>
            Training a large language model like LLaMA 3 70B requires hundreds of GPU-hours on
            high-end hardware. Purchasing NVIDIA H100s outright costs $25,000-40,000 per GPU, with
            lead times stretching 6-12 months. Cloud GPUs eliminate this capital expenditure and
            wait time, letting you spin up compute in minutes and pay only for what you use.
          </p>

          <p>
            The math is straightforward: if you need 1,000 GPU-hours per month, renting at $3/hour
            costs $3,000. Buying an H100 would require 8-13 months just to break even on hardware
            costs, not counting electricity, cooling, networking, and maintenance. For most teams,
            cloud GPUs are the economically rational choice until you reach sustained utilization
            above 60-70%.
          </p>

          <h3 style={{ marginTop: 24 }}>Understanding GPU Pricing Tiers</h3>
          <p>
            Cloud GPU pricing falls into three main tiers based on provider type and reliability
            guarantees:
          </p>

          <p>
            <strong>Enterprise Tier ($3-8/GPU-hour for H100):</strong> Hyperscalers like AWS, Google
            Cloud, and Azure offer the highest reliability with SLAs, dedicated support, and
            integration with broader cloud ecosystems. You pay a premium for guaranteed capacity and
            enterprise features.
          </p>

          <p>
            <strong>Specialized AI Cloud ($2-4/GPU-hour for H100):</strong> Providers like Lambda
            Labs, CoreWeave, and Nebius focus exclusively on AI/ML workloads. They offer competitive
            pricing with good reliability, often including NVLink configurations and InfiniBand
            networking for distributed training.
          </p>

          <p>
            <strong>Marketplace/Community ($1-2/GPU-hour for H100):</strong> Platforms like RunPod,
            Vast.ai, and TensorDock aggregate capacity from data centers and individual GPU owners.
            Prices are lowest, but availability and reliability vary. Ideal for experimentation and
            fault-tolerant workloads.
          </p>

          <h3 style={{ marginTop: 24 }}>Spot vs On-Demand Pricing</h3>
          <p>
            Most providers offer two pricing models. On-demand pricing guarantees availability but
            costs more. Spot or preemptible instances offer 50-80% discounts but can be interrupted
            with short notice. For training jobs, spot instances work well if you checkpoint
            frequently (every 5-10 minutes) and can handle restarts. For production inference, stick
            with on-demand for predictable availability.
          </p>

          <h3 style={{ marginTop: 24 }}>Choosing the Right GPU for Your Workload</h3>
          <p>GPU selection depends primarily on your model size and use case:</p>

          <p>
            <strong>NVIDIA H100 SXM (80GB):</strong> The current gold standard for LLM training.
            3.35 TB/s memory bandwidth, 900 GB/s NVLink for multi-GPU scaling, and Transformer
            Engine for FP8 training. Best for production training of 7B-70B models. Typical pricing:
            $2-4/hour on specialized clouds.
          </p>

          <p>
            <strong>NVIDIA A100 (40GB/80GB):</strong> The workhorse of the previous generation.
            Still excellent for training and inference, with broad availability and mature
            ecosystem. A100 80GB is particularly valuable for its memory capacity at lower cost than
            H100. Typical pricing: $1-2/hour.
          </p>

          <p>
            <strong>NVIDIA RTX 4090 (24GB):</strong> Consumer GPU with exceptional performance per
            dollar. Ideal for inference, fine-tuning smaller models, and experimentation. Lacks
            NVLink and enterprise features, but unbeatable for budget-conscious teams. Typical
            pricing: $0.30-0.80/hour.
          </p>

          <p>
            <strong>NVIDIA L40S (48GB):</strong> Balanced option between consumer and datacenter
            GPUs. 48GB VRAM handles larger models than RTX 4090, with better reliability for
            production use. Typical pricing: $0.80-1.50/hour.
          </p>

          <h3 style={{ marginTop: 24 }}>Cost Optimization Strategies</h3>
          <p>Reduce your cloud GPU spend by 30-60% with these proven strategies:</p>

          <p>
            <strong>1. Right-size your GPU:</strong> Do not default to H100 when A100 or L40S would
            suffice. For inference workloads, RTX 4090 often delivers better cost-per-token than
            enterprise GPUs.
          </p>

          <p>
            <strong>2. Use spot instances strategically:</strong> For training, implement frequent
            checkpointing and automated restart on interruption. Many teams report 50%+ savings with
            minimal additional engineering.
          </p>

          <p>
            <strong>3. Compare across providers:</strong> Prices for identical GPUs vary 2-3x across
            providers. Use CloudGPUs.io to find the best current rates before each training run.
          </p>

          <p>
            <strong>4. Consider region arbitrage:</strong> GPU availability and pricing varies by
            region. US-East and Europe-West are often more expensive than US-Central or Asia-Pacific
            regions.
          </p>

          <p>
            <strong>5. Reserved capacity for sustained workloads:</strong> If you need GPUs
            continuously for months, reserved instances (1-3 year commitments) can save 40-60% vs
            on-demand pricing.
          </p>
        </div>
      </section>

      {/* Provider Comparison Quick Links */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ margin: "12px 0" }}>Compare Cloud GPU Providers</h2>
        <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
          Head-to-head comparisons of pricing, features, and reliability across top GPU cloud
          providers.
        </p>
        <div className="grid grid3" style={{ gap: 12 }}>
          <Link href="/compare/lambda-labs-vs-runpod" className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 700 }}>Lambda Labs vs RunPod</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Enterprise reliability vs marketplace pricing
            </div>
          </Link>
          <Link href="/compare/coreweave-vs-lambda-labs" className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 700 }}>CoreWeave vs Lambda Labs</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              GPU-native cloud showdown
            </div>
          </Link>
          <Link href="/compare/runpod-vs-vast-ai" className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 700 }}>RunPod vs Vast.ai</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Marketplace price comparison
            </div>
          </Link>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="card" style={{ marginTop: 24, padding: 22 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Frequently Asked Questions</h2>
        <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
          <div>
            <div style={{ fontWeight: 700 }}>What is the cheapest cloud GPU for AI training?</div>
            <div className="muted" style={{ marginTop: 4, lineHeight: 1.7 }}>
              The cheapest cloud GPUs for AI training start around $0.20-0.40/hour for RTX 4090s on
              marketplace providers like Vast.ai and RunPod. For enterprise workloads, A100 40GB
              instances start at approximately $0.75-1.50/hour depending on provider and region.
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>How much does an H100 GPU cost per hour?</div>
            <div className="muted" style={{ marginTop: 4, lineHeight: 1.7 }}>
              NVIDIA H100 cloud pricing ranges from $1.99-4.00/hour for on-demand instances across
              providers. Spot instances can be 50-70% cheaper. Prices vary by provider, region, and
              configuration (PCIe vs SXM, single GPU vs multi-GPU nodes).
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>Which cloud provider has the best GPU pricing?</div>
            <div className="muted" style={{ marginTop: 4, lineHeight: 1.7 }}>
              Specialized AI clouds like Lambda Labs, RunPod, and Vast.ai typically offer 40-60%
              lower GPU pricing than hyperscalers (AWS, GCP, Azure). The best provider depends on
              your workload: marketplaces offer lowest prices, while specialized neoclouds balance
              price with reliability.
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>What GPU should I use for training LLMs?</div>
            <div className="muted" style={{ marginTop: 4, lineHeight: 1.7 }}>
              For LLM training, choose based on model size: 7B models need 40-80GB VRAM (A100 80GB
              or 4x RTX 4090), 70B models need 320-640GB (8x A100 or 4x H100). The H100 SXM offers
              the best performance with its Transformer Engine and NVLink, while A100s provide
              better value for smaller-scale training.
            </div>
          </div>
        </div>
      </section>

      {/* Tools and Resources */}
      <section className="card" style={{ marginTop: 24, padding: 22 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Tools and Resources</h2>
        <div className="grid grid2" style={{ marginTop: 12, gap: 16 }}>
          <div>
            <Link href="/calculator/cost-estimator" style={{ fontWeight: 700 }}>
              GPU Cost Calculator
            </Link>
            <div className="muted" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.6 }}>
              Estimate total training costs based on model size, GPU selection, and provider
              pricing.
            </div>
          </div>
          <div>
            <Link href="/calculator/gpu-selector" style={{ fontWeight: 700 }}>
              GPU Selector Tool
            </Link>
            <div className="muted" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.6 }}>
              Find the right GPU for your workload based on VRAM requirements and budget.
            </div>
          </div>
          <div>
            <Link href="/best-gpu-for" style={{ fontWeight: 700 }}>
              Use Case Guides
            </Link>
            <div className="muted" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.6 }}>
              GPU recommendations for LLM training, inference, Stable Diffusion, and more.
            </div>
          </div>
          <div>
            <Link href="/compare" style={{ fontWeight: 700 }}>
              Provider Comparisons
            </Link>
            <div className="muted" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.6 }}>
              Head-to-head pricing and feature comparisons across cloud GPU providers.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
