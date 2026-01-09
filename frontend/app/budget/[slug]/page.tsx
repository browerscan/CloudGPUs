import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { PriceTable } from "@/components/PriceTable";
import { comparePrices, listGpuModels } from "@/lib/api";
import { seoGpuSlug } from "@/lib/aliases";

export const revalidate = 300;

export type BudgetPage = {
  slug: string;
  name: string;
  title: string;
  description: string;
  maxPrice: number | null;
  minVram: number | null;
  content: string;
};

const BUDGET_PAGES: BudgetPage[] = [
  {
    slug: "under-1-per-hour",
    name: "Under $1/Hour",
    title: "GPUs Under $1 Per Hour",
    description:
      "Compare cloud GPUs under $1 per hour. Find budget-friendly GPU options for inference, fine-tuning, and development workloads.",
    maxPrice: 1,
    minVram: null,
    content: `Cloud GPUs under $1 per hour offer an excellent entry point for developers, researchers, and hobbyists looking to run inference, fine-tune small models, or experiment with GPU-accelerated workloads without breaking the bank. These affordable options typically include consumer-class GPUs like RTX 4090, RTX 4080, and older datacenter GPUs like T4 or V100. While they may not have the raw performance of flagship H100 or B200 GPUs, they provide sufficient VRAM and compute for many practical tasks including LLM inference for models up to 7B parameters, Stable Diffusion image generation, and embeddings workloads. When selecting a sub-$1/GPU-hour option, consider factors like VRAM capacity, memory bandwidth, networking capabilities, and whether spot instances are available for even greater savings. Providers in this tier often offer flexible rental terms and per-second billing, making them ideal for experimentation and development.`,
  },
  {
    slug: "under-2-per-hour",
    name: "Under $2/Hour",
    title: "GPUs Under $2 Per Hour",
    description:
      "Compare cloud GPUs under $2 per hour. Mid-range GPU options for serious ML workloads, fine-tuning, and production inference.",
    maxPrice: 2,
    minVram: null,
    content: `Cloud GPUs under $2 per hour represent the sweet spot for many production and development workloads. This price tier opens access to capable GPUs like L40S, RTX 5090, and A100 variants, providing significantly more VRAM and compute power than the budget tier while remaining cost-effective for sustained usage. These GPUs are well-suited for fine-tuning medium-sized language models (7B-13B parameters), running production inference servers, training diffusion models, and conducting ML research. The $0-2/hr range includes both consumer-grade GPUs with excellent performance-per-dollar and enterprise-grade options with features like NVLink for multi-GPU training. When comparing options in this range, consider the trade-offs between consumer and datacenter GPUs, spot vs on-demand pricing, and the specific requirements of your workload such as VRAM needs, network bandwidth for distributed training, and region availability for low-latency inference.`,
  },
  {
    slug: "under-500-per-month",
    name: "Under $500/Month",
    title: "GPUs Under $500 Per Month",
    description:
      "Find cloud GPUs that cost under $500 per month for continuous usage. Budget-friendly monthly GPU rental options.",
    maxPrice: null,
    minVram: null,
    content: `A monthly GPU budget of under $500 translates to approximately $0.68 per hour (assuming 24/7 usage for 30 days). This budget tier is popular for startups, individual researchers, and small teams running continuous workloads. At this price point, you can access GPUs suitable for 24/7 inference servers, automated ML pipelines, and continuous training jobs. The key consideration at this tier is reliability and uptime for production workloads. Enterprise providers with strong SLAs may be preferable over marketplace options even if hourly rates appear higher, as interruptions can cost more in downtime than the savings. This budget opens options including reliable L40S instances, A100 variants on spot pricing, and premium consumer GPUs like RTX 5090. When planning monthly GPU spend, factor in both base hourly costs and any additional expenses for storage, data transfer, and premium support that may be essential for production deployments.`,
  },
  {
    slug: "under-1000-per-month",
    name: "Under $1000/Month",
    title: "GPUs Under $1000 Per Month",
    description:
      "Find cloud GPUs under $1000 per month. Serious ML workloads and production inference on a monthly budget.",
    maxPrice: null,
    minVram: null,
    content: `A monthly budget of under $1000 (approximately $1.36 per hour for 24/7 usage) provides access to serious GPU compute for production workloads and development. This tier is ideal for teams running production inference servers, training models regularly, or conducting research requiring consistent GPU availability. The $500-1000/month range opens access to H100 PCIe variants, A100 80GB instances, and multi-GPU configurations that can handle more demanding workloads including training larger language models (up to 30B parameters with quantization), running vector databases with GPU acceleration, and serving multiple models concurrently. At this spending level, reliability becomes critical. Consider enterprise providers with documented SLAs, 24/7 support, and multiple availability zones. The additional cost premium for enterprise reliability often pays for itself in reduced downtime and faster problem resolution. Also consider reserved pricing options which many providers offer at significant discounts (30-50% off) compared to on-demand rates for committed usage.`,
  },
];

const BUDGET_MONTHLY_MULTIPLIERS: Record<string, number> = {
  "under-500-per-month": 730, // ~$0.68/hr for $500/month
  "under-1000-per-month": 730, // ~$1.37/hr for $1000/month
};

export async function generateStaticParams() {
  return BUDGET_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = BUDGET_PAGES.find((p) => p.slug === slug);
  if (!page) notFound();

  return {
    title: `${page.title} (${new Date().getFullYear()})`,
    description: page.description,
    alternates: { canonical: `/budget/${page.slug}` },
    openGraph: {
      title: page.title,
      description: page.description,
      url: `/budget/${page.slug}`,
    },
  };
}

export default async function BudgetPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = BUDGET_PAGES.find((p) => p.slug === slug);
  if (!page) notFound();

  // Get all GPUs to filter
  const gpus = await listGpuModels();
  const maxHourlyPrice =
    (page.maxPrice ?? BUDGET_MONTHLY_MULTIPLIERS[slug])
      ? page.maxPrice! / BUDGET_MONTHLY_MULTIPLIERS[slug]!
      : null;

  // Fetch pricing for each GPU and filter by budget
  const gpuPricing = await Promise.all(
    gpus.docs.map(async (gpu) => {
      try {
        const compare = await comparePrices(seoGpuSlug(gpu.slug));
        const minPrice = compare.stats.min;
        if (minPrice === null) return null;
        if (maxHourlyPrice !== null && minPrice > maxHourlyPrice) return null;
        if (page.minVram !== null && gpu.vram_gb < page.minVram) return null;
        return { gpu, compare };
      } catch {
        return null;
      }
    }),
  );

  const filtered = gpuPricing.filter((g): g is NonNullable<typeof g> => g !== null);
  const sorted = filtered.sort(
    (a, b) => (a.compare.stats.min ?? Infinity) - (b.compare.stats.min ?? Infinity),
  );

  // Collect all prices for the table
  const allPrices = sorted.flatMap((item) => item.compare.prices);

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://cloudgpus.io/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Budget GPUs",
        item: "https://cloudgpus.io/budget",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: page.name,
        item: `https://cloudgpus.io/budget/${page.slug}`,
      },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `What GPUs can I get ${page.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `We track ${sorted.length} GPU models available ${page.name}. Options include both consumer and datacenter GPUs suitable for inference, fine-tuning, and development workloads.`,
        },
      },
      {
        "@type": "Question",
        name: "Are spot prices included in these results?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, we show both on-demand and spot pricing where available. Spot instances can offer significant savings (50-90% off) but come with the risk of preemption.",
        },
      },
      {
        "@type": "Question",
        name: "How often are budget GPU prices updated?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Pricing is updated regularly from each provider. The table shows the last update time for each entry, and pages are revalidated every 10 minutes.",
        },
      },
    ],
  };

  const relatedBudgets = BUDGET_PAGES.filter((p) => p.slug !== slug);

  return (
    <div className="container">
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />

      <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          Home
        </Link>{" "}
        <span style={{ opacity: 0.5 }}>/</span>{" "}
        <Link href="/budget" style={{ textDecoration: "none" }}>
          Budget
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
              GPUs found
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
              Max budget
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>
              {maxHourlyPrice !== null ? `$${maxHourlyPrice.toFixed(2)}/hr` : "—"}
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
        <h2 style={{ marginTop: 0, fontSize: 18 }}>About {page.name}</h2>
        <div className="muted" style={{ lineHeight: 1.8 }}>
          {page.content.split("\n\n").map((para, i) => (
            <p key={i} style={{ marginTop: i === 0 ? 0 : 12, marginBottom: 0 }}>
              {para}
            </p>
          ))}
        </div>
      </section>

      {sorted.length > 0 ? (
        <div className="card" style={{ marginTop: 18, padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>GPU Pricing Within Budget</h2>
          <p className="muted" style={{ marginTop: 6, lineHeight: 1.7 }}>
            All GPU options{" "}
            {maxHourlyPrice !== null ? `at or below $${maxHourlyPrice.toFixed(2)}/GPU‑hour` : ""}.
            Sorted by lowest price.
          </p>
          <div style={{ marginTop: 12 }}>
            <PriceTable gpuSlug="budget" rows={allPrices} />
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 18, padding: 18 }}>
          <p className="muted">
            No GPUs found within this budget range. Check back soon as pricing changes frequently.
          </p>
        </div>
      )}

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Featured GPUs in This Range</h2>
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
                {gpu.vram_gb}GB · {gpu.architecture}
              </div>
              <div style={{ marginTop: 8, fontWeight: 600 }}>
                From ${compare.stats.min?.toFixed(2) ?? "—"}/hr
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid2" style={{ marginTop: 18 }}>
        <section className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Related Budget Tiers</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {relatedBudgets.map((budget) => (
              <Link
                key={budget.slug}
                href={`/budget/${budget.slug}`}
                className="card"
                style={{ padding: 12, textDecoration: "none" }}
              >
                <div style={{ fontWeight: 700 }}>{budget.name}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {budget.description}
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Budget Tips</h2>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            <p style={{ marginTop: 0 }}>
              <strong>Use spot instances</strong> for non-urgent workloads. Spot pricing can be
              50-90% cheaper than on-demand rates.
            </p>
            <p>
              <strong>Check billing increments</strong>. Per-second billing is more cost-effective
              for short jobs than hourly billing.
            </p>
            <p>
              <strong>Consider reserved pricing</strong> for sustained workloads. Many providers
              offer 30-50% discounts for committed usage.
            </p>
            <p style={{ marginBottom: 0 }}>
              <strong>Monitor regional pricing</strong>. Prices can vary significantly by region due
              to local demand and energy costs.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
