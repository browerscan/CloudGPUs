import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { ListItemSchema } from "@/components/ListItemSchema";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import {
  comparePrices,
  compareProviders,
  getGpuModel,
  getProvider,
  listGpuModels,
  listProviders,
} from "@/lib/api";
import { normalizeGpuSlug, normalizeProviderSlug, seoGpuSlug } from "@/lib/aliases";
import { formatUsdPerHour } from "@/lib/format";

export const dynamic = "force-dynamic";

function splitCompareSlug(slug: string) {
  const parts = slug.split("-vs-").filter(Boolean);
  if (parts.length !== 2) return null;
  const [a, b] = parts as [string, string];
  return { a, b };
}

function canonicalCompareSlug(a: string, b: string) {
  const token = (raw: string) => seoGpuSlug(normalizeGpuSlug(normalizeProviderSlug(raw)));
  const [x, y] = [token(a), token(b)].sort();
  return `${x}-vs-${y}`;
}

async function tryGetProvider(slug: string) {
  try {
    return await getProvider(normalizeProviderSlug(slug));
  } catch {
    return null;
  }
}

async function tryGetGpu(slug: string) {
  try {
    return await getGpuModel(normalizeGpuSlug(slug));
  } catch {
    return null;
  }
}

export async function generateStaticParams() {
  let providers: Awaited<ReturnType<typeof listProviders>>;
  let gpus: Awaited<ReturnType<typeof listGpuModels>>;
  try {
    [providers, gpus] = await Promise.all([listProviders(), listGpuModels()]);
  } catch {
    // If the API is unavailable during build, skip pre-generation and rely on ISR at runtime.
    return [];
  }

  const featuredProviderPairs: Array<[string, string]> = [
    ["lambda-labs", "runpod"],
    ["coreweave", "lambda-labs"],
    ["runpod", "vast-ai"],
    ["nebius", "lambda-labs"],
    ["gmi-cloud", "runpod"],
    ["voltage-park", "lambda-labs"],
  ];

  const providerParams = featuredProviderPairs.map(([a, b]) => ({
    slug: canonicalCompareSlug(a, b),
  }));

  const gpuPairs: Array<[string, string]> = [
    ["h100-sxm", "h200-sxm"],
    ["h100-sxm", "a100-80gb"],
    ["rtx-4090", "rtx-5090"],
    ["b200-sxm", "h200-sxm"],
    ["l40s", "rtx-4090"],
  ];
  const gpuParams = gpuPairs.map(([a, b]) => ({ slug: canonicalCompareSlug(a, b) }));

  // Add a small randomized sample of provider pairs for ISR warming.
  const topProviders = providers.docs.slice(0, 12).map((p) => p.slug);
  const samplePairs: Array<[string, string]> = [];
  for (let i = 0; i < topProviders.length; i++) {
    for (let j = i + 1; j < topProviders.length; j++) {
      if (samplePairs.length >= 24) break;
      samplePairs.push([topProviders[i]!, topProviders[j]!]);
    }
    if (samplePairs.length >= 24) break;
  }

  const sampleParams = samplePairs.map(([a, b]) => ({ slug: canonicalCompareSlug(a, b) }));

  // Also add a couple of GPU pairs from the catalog.
  const topGpus = gpus.docs.slice(0, 10).map((g) => g.slug);
  const gpuSample: Array<[string, string]> = [];
  for (let i = 0; i < topGpus.length; i++) {
    for (let j = i + 1; j < topGpus.length; j++) {
      if (gpuSample.length >= 12) break;
      gpuSample.push([topGpus[i]!, topGpus[j]!]);
    }
    if (gpuSample.length >= 12) break;
  }
  const gpuSampleParams = gpuSample.map(([a, b]) => ({ slug: canonicalCompareSlug(a, b) }));

  return [...providerParams, ...gpuParams, ...sampleParams, ...gpuSampleParams];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const parsed = splitCompareSlug(slug);
  if (!parsed) return { title: "Compare" };

  const canonical = canonicalCompareSlug(parsed.a, parsed.b);
  if (canonical !== slug) {
    return { alternates: { canonical: `/compare/${canonical}` } };
  }

  const [pA, pB, gA, gB] = await Promise.all([
    tryGetProvider(parsed.a),
    tryGetProvider(parsed.b),
    tryGetGpu(parsed.a),
    tryGetGpu(parsed.b),
  ]);

  if (pA && pB) {
    return {
      title: `${pA.name} vs ${pB.name}: GPU cloud comparison (${new Date().getFullYear()})`,
      description: `Side-by-side comparison of ${pA.name} and ${pB.name} pricing, reliability, and GPU availability. Includes a quick verdict and a feature matrix.`,
      alternates: { canonical: `/compare/${canonical}` },
    };
  }

  if (gA && gB) {
    return {
      title: `${gA.short_name} vs ${gB.short_name}: specs + cloud pricing (${new Date().getFullYear()})`,
      description: `Compare ${gA.name} and ${gB.name} GPU specifications and current cloud price ranges across providers.`,
      alternates: { canonical: `/compare/${canonical}` },
    };
  }

  return { title: "Compare", alternates: { canonical: `/compare/${canonical}` } };
}

export default async function CompareDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = splitCompareSlug(slug);
  if (!parsed) notFound();

  const canonical = canonicalCompareSlug(parsed.a, parsed.b);
  if (canonical !== slug) redirect(`/compare/${canonical}`);

  const [providerA, providerB] = await Promise.all([
    tryGetProvider(parsed.a),
    tryGetProvider(parsed.b),
  ]);
  if (providerA && providerB) {
    const data = await compareProviders(providerA.slug, providerB.slug);

    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://cloudgpus.io/" },
        { "@type": "ListItem", position: 2, name: "Compare", item: "https://cloudgpus.io/compare" },
        {
          "@type": "ListItem",
          position: 3,
          name: `${providerA.name} vs ${providerB.name}`,
          item: `https://cloudgpus.io/compare/${canonical}`,
        },
      ],
    };

    const verdict = data.verdict;
    const cheaperLabel =
      verdict.cheaper === "tie"
        ? "It’s a tie on median on‑demand price."
        : verdict.cheaper === providerA.slug
          ? `${providerA.name} is cheaper on median on‑demand pricing.`
          : `${providerB.name} is cheaper on median on‑demand pricing.`;

    const coverageLabel =
      verdict.moreGpus === "tie"
        ? "They list a similar number of GPUs."
        : verdict.moreGpus === providerA.slug
          ? `${providerA.name} covers more GPU types.`
          : `${providerB.name} covers more GPU types.`;

    const faqs = [
      {
        q: `Which is cheaper: ${providerA.name} or ${providerB.name}?`,
        a:
          `Pricing depends on GPU model, region, and availability. This page compares the lowest observed ` +
          `$/GPU‑hour rates for overlapping GPUs and summarizes a median-based verdict. Always verify on the provider site.`,
      },
      {
        q: `Which is better for long training runs?`,
        a:
          `For multi‑hour or multi‑day training, prefer providers with stronger reliability tiers, stable region coverage, and ` +
          `clear billing increments. If you use spot/preemptible capacity, assume interruptions and checkpoint frequently.`,
      },
      {
        q: `Do both providers support spot/preemptible?`,
        a:
          `Spot/preemptible support varies by provider and GPU. If spot is published for a GPU, we show it in pricing tables. ` +
          `Use the provider pages for detailed capabilities and docs links.`,
      },
      {
        q: `How current is this comparison?`,
        a: `Comparisons are derived from our pricing ingestion pipeline. Each row includes a “last updated” timestamp from the latest scrape.`,
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

    const comparisonListItems = data.commonGpus
      .filter((row) => row.provider1.onDemand != null)
      .map((row) => ({
        name: row.gpu.name,
        url: `/cloud-gpu/${seoGpuSlug(row.gpu.slug)}`,
        price: `$${row.provider1.onDemand!.toFixed(2)}/hr`,
      }));

    return (
      <div className="container">
        <JsonLd data={breadcrumbSchema} />
        <JsonLd data={faqSchema} />
        <ListItemSchema
          itemListName={`${providerA.name} vs ${providerB.name} - Compared GPUs`}
          items={comparisonListItems}
        />

        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Compare", href: "/compare" },
            { label: `${providerA.name} vs ${providerB.name}` },
          ]}
        />

        <div className="card" style={{ padding: 22 }}>
          <div
            style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}
          >
            <div>
              <h1 style={{ marginTop: 0 }}>
                {providerA.name} vs {providerB.name}
              </h1>
              <p className="muted" style={{ maxWidth: 920, lineHeight: 1.7 }}>
                Side‑by‑side comparison of GPU pricing, reliability signals, and product
                capabilities. Updated from the latest pricing data in our pipeline.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <Link className="btn btnSecondary" href="/compare">
                All comparisons
              </Link>
              <Link className="btn" href={`/provider/${providerA.slug}`}>
                {providerA.name}
              </Link>
              <Link className="btn" href={`/provider/${providerB.slug}`}>
                {providerB.name}
              </Link>
            </div>
          </div>

          <div className="grid grid2" style={{ marginTop: 14, alignItems: "start" }}>
            <section className="card" style={{ padding: 16 }}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Quick verdict</h2>
              <div className="muted" style={{ lineHeight: 1.8 }}>
                <div>• {cheaperLabel}</div>
                <div>• {coverageLabel}</div>
                <div style={{ marginTop: 10 }}>
                  Choose <strong>{providerA.name}</strong> if you value {providerA.reliability_tier}
                  ‑tier reliability and its GPU coverage at the lowest observed median price.
                </div>
                <div style={{ marginTop: 8 }}>
                  Choose <strong>{providerB.name}</strong> if it has better availability in your
                  region and the GPUs you actually need at a competitive hourly rate.
                </div>
              </div>
            </section>

            <section className="card" style={{ padding: 16 }}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Feature matrix</h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left" }}>
                      <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                        Feature
                      </th>
                      <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                        {providerA.name}
                      </th>
                      <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                        {providerB.name}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Provider type", providerA.provider_type, providerB.provider_type],
                      ["Reliability tier", providerA.reliability_tier, providerB.reliability_tier],
                      [
                        "Public API",
                        providerA.has_public_api ? "Yes" : "Unknown/No",
                        providerB.has_public_api ? "Yes" : "Unknown/No",
                      ],
                      [
                        "Spot/preemptible",
                        providerA.supports_spot_instances ? "Yes" : "Unknown/No",
                        providerB.supports_spot_instances ? "Yes" : "Unknown/No",
                      ],
                      [
                        "Reserved pricing",
                        providerA.supports_reserved_instances ? "Yes" : "Unknown/No",
                        providerB.supports_reserved_instances ? "Yes" : "Unknown/No",
                      ],
                      [
                        "Regions",
                        providerA.available_regions?.length
                          ? providerA.available_regions.join(", ")
                          : "—",
                        providerB.available_regions?.length
                          ? providerB.available_regions.join(", ")
                          : "—",
                      ],
                    ].map(([feature, aVal, bVal]) => (
                      <tr key={feature}>
                        <td
                          style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}
                        >
                          <span className="muted" style={{ fontSize: 13 }}>
                            {feature}
                          </span>
                        </td>
                        <td
                          style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}
                        >
                          {aVal}
                        </td>
                        <td
                          style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}
                        >
                          {bVal}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section style={{ marginTop: 18 }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Price comparison (common GPUs)</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                      GPU
                    </th>
                    <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                      {providerA.name}
                    </th>
                    <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                      {providerB.name}
                    </th>
                    <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                      Diff
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.commonGpus.map((row) => {
                    const a = row.provider1.onDemand ?? row.provider1.spot;
                    const b = row.provider2.onDemand ?? row.provider2.spot;
                    const diffPct =
                      a != null && b != null && Number.isFinite(a) && Number.isFinite(b)
                        ? ((a - b) / Math.max(b, 1e-9)) * 100
                        : null;
                    return (
                      <tr key={row.gpu.slug}>
                        <td
                          style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}
                        >
                          <Link
                            href={`/cloud-gpu/${seoGpuSlug(row.gpu.slug)}`}
                            style={{ fontWeight: 700 }}
                          >
                            {row.gpu.name}
                          </Link>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {row.gpu.slug}
                          </div>
                        </td>
                        <td
                          style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}
                        >
                          {formatUsdPerHour(a ?? null)}
                        </td>
                        <td
                          style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}
                        >
                          {formatUsdPerHour(b ?? null)}
                        </td>
                        <td
                          style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}
                        >
                          <span className="muted">
                            {diffPct != null ? `${diffPct.toFixed(0)}%` : "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {!data.commonGpus.length ? (
                    <tr>
                      <td colSpan={4} className="muted" style={{ padding: 12 }}>
                        No overlapping GPUs in our current data.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="grid grid2" style={{ marginTop: 18, alignItems: "start" }}>
          <section className="card" style={{ padding: 18 }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>{providerA.name} overview</h2>
            <div className="muted" style={{ lineHeight: 1.8 }}>
              <p style={{ marginTop: 0 }}>
                {providerA.name} is a{" "}
                <strong>{providerA.provider_type.replaceAll("_", " ")}</strong> provider in our
                catalog, classified as <strong>{providerA.reliability_tier}</strong> tier. Use it
                when you need stable provisioning, predictable billing, and consistent availability
                for the GPUs you run most often.
              </p>
              <p style={{ marginBottom: 0 }}>
                Next steps: review available GPUs on the provider page, then validate the instance
                details (CPU/RAM, networking, billing increments) before committing to a long run.
              </p>
              <div style={{ marginTop: 10 }}>
                <Link href={`/provider/${providerA.slug}`} style={{ textDecoration: "underline" }}>
                  View {providerA.name} pricing →
                </Link>
              </div>
            </div>
          </section>

          <section className="card" style={{ padding: 18 }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>{providerB.name} overview</h2>
            <div className="muted" style={{ lineHeight: 1.8 }}>
              <p style={{ marginTop: 0 }}>
                {providerB.name} is a{" "}
                <strong>{providerB.provider_type.replaceAll("_", " ")}</strong> provider, listed as{" "}
                <strong>{providerB.reliability_tier}</strong> tier. It can be a strong option if it
                has better regional coverage for your users, or better availability of the specific
                GPUs you need.
              </p>
              <p style={{ marginBottom: 0 }}>
                For price‑sensitive development, evaluate spot/preemptible pricing and the stability
                of the underlying capacity. For production inference, look for clearer SLAs and
                predictable scaling.
              </p>
              <div style={{ marginTop: 10 }}>
                <Link href={`/provider/${providerB.slug}`} style={{ textDecoration: "underline" }}>
                  View {providerB.name} pricing →
                </Link>
              </div>
            </div>
          </section>
        </div>

        <section className="card" style={{ marginTop: 18, padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>When to choose which</h2>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            <p style={{ marginTop: 0 }}>
              If you are training large models, the right choice is often the provider that can
              supply the GPU you need
              <strong> in the region you need</strong> with the networking you need (NVLink /
              InfiniBand) at a stable price. A slightly higher hourly rate can still be cheaper if
              faster networking reduces total training time.
            </p>
            <p style={{ marginBottom: 0 }}>
              For demos and short jobs, marketplace/community capacity can be excellent value. For
              long‑running training, prioritize reliability tier, predictable billing increments,
              and historical stability.
            </p>
          </div>
        </section>

        <section className="card" style={{ marginTop: 18, padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>FAQ</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {faqs.map((f) => (
              <div key={f.q}>
                <div style={{ fontWeight: 800 }}>{f.q}</div>
                <div className="muted" style={{ marginTop: 4, lineHeight: 1.7 }}>
                  {f.a}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  const [gpuA, gpuB] = await Promise.all([tryGetGpu(parsed.a), tryGetGpu(parsed.b)]);
  if (gpuA && gpuB) {
    const [pricesA, pricesB] = await Promise.all([
      comparePrices(gpuA.slug),
      comparePrices(gpuB.slug),
    ]);

    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://cloudgpus.io/" },
        { "@type": "ListItem", position: 2, name: "Compare", item: "https://cloudgpus.io/compare" },
        {
          "@type": "ListItem",
          position: 3,
          name: `${gpuA.short_name} vs ${gpuB.short_name}`,
          item: `https://cloudgpus.io/compare/${canonical}`,
        },
      ],
    };

    const faqs = [
      {
        q: `Which is cheaper to rent: ${gpuA.short_name} or ${gpuB.short_name}?`,
        a:
          `It depends on provider availability and the specific variant. We compare the current observed price ranges ` +
          `across providers. Always verify whether the offer is SXM vs PCIe, plus bundled CPU/RAM and networking.`,
      },
      {
        q: `Which GPU is better for LLM training?`,
        a:
          `For large LLM training, prioritize VRAM, memory bandwidth, and multi‑GPU scaling (NVLink/InfiniBand). ` +
          `Higher-end GPUs can be more expensive per hour but reduce total training time.`,
      },
      {
        q: `Do these pages include spot pricing?`,
        a: `Yes — when spot/preemptible prices are published, we include them alongside on‑demand rates.`,
      },
      {
        q: `How do I estimate total cost?`,
        a: `Multiply $/GPU‑hour by GPU count and runtime hours. Use our cost estimator for quick planning and scenarios.`,
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

    const aMin = pricesA.stats.min;
    const bMin = pricesB.stats.min;
    const cheaper =
      aMin == null || bMin == null
        ? "tie"
        : aMin < bMin
          ? gpuA.short_name
          : bMin < aMin
            ? gpuB.short_name
            : "tie";

    return (
      <div className="container">
        <JsonLd data={breadcrumbSchema} />
        <JsonLd data={faqSchema} />

        <div className="card" style={{ padding: 22 }}>
          <div
            style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}
          >
            <div>
              <h1 style={{ marginTop: 0 }}>
                {gpuA.short_name} vs {gpuB.short_name}
              </h1>
              <p className="muted" style={{ maxWidth: 920, lineHeight: 1.7 }}>
                Compare specifications and current cloud price ranges across providers. Updated from
                our pricing aggregation pipeline.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <Link className="btn btnSecondary" href="/compare">
                All comparisons
              </Link>
              <Link className="btn" href={`/cloud-gpu/${seoGpuSlug(gpuA.slug)}`}>
                {gpuA.short_name}
              </Link>
              <Link className="btn" href={`/cloud-gpu/${seoGpuSlug(gpuB.slug)}`}>
                {gpuB.short_name}
              </Link>
            </div>
          </div>

          <div className="grid grid2" style={{ marginTop: 14, alignItems: "start" }}>
            <section className="card" style={{ padding: 16 }}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Quick verdict</h2>
              <div className="muted" style={{ lineHeight: 1.8 }}>
                <div>
                  Cheapest observed:{" "}
                  <strong>
                    {cheaper === "tie"
                      ? "Tie/unknown"
                      : cheaper === gpuA.short_name
                        ? gpuA.short_name
                        : gpuB.short_name}
                  </strong>
                </div>
                <div style={{ marginTop: 10 }}>
                  For workload fit, use VRAM and architecture as the starting point, then validate
                  price/availability on the individual GPU pricing pages.
                </div>
                <div style={{ marginTop: 10 }}>
                  Estimating cost? Try <Link href="/calculator/cost-estimator">cost estimator</Link>
                  .
                </div>
              </div>
            </section>

            <section className="card" style={{ padding: 16 }}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Spec comparison</h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left" }}>
                      <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                        Spec
                      </th>
                      <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                        {gpuA.short_name}
                      </th>
                      <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                        {gpuB.short_name}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Architecture", gpuA.architecture, gpuB.architecture],
                      ["VRAM", `${gpuA.vram_gb} GB`, `${gpuB.vram_gb} GB`],
                      ["Memory", gpuA.memory_type, gpuB.memory_type],
                      [
                        "Bandwidth (GB/s)",
                        gpuA.memory_bandwidth_gbps != null
                          ? String(gpuA.memory_bandwidth_gbps)
                          : "—",
                        gpuB.memory_bandwidth_gbps != null
                          ? String(gpuB.memory_bandwidth_gbps)
                          : "—",
                      ],
                      [
                        "TDP (W)",
                        gpuA.tdp_watts != null ? String(gpuA.tdp_watts) : "—",
                        gpuB.tdp_watts != null ? String(gpuB.tdp_watts) : "—",
                      ],
                    ].map(([spec, aVal, bVal]) => (
                      <tr key={spec}>
                        <td
                          style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}
                        >
                          <span className="muted" style={{ fontSize: 13 }}>
                            {spec}
                          </span>
                        </td>
                        <td
                          style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}
                        >
                          {aVal}
                        </td>
                        <td
                          style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}
                        >
                          {bVal}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section style={{ marginTop: 18 }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Cloud price ranges</h2>
            <div className="grid grid2">
              {[
                { gpu: gpuA, prices: pricesA },
                { gpu: gpuB, prices: pricesB },
              ].map(({ gpu, prices }) => (
                <div key={gpu.slug} className="card" style={{ padding: 16 }}>
                  <div style={{ fontWeight: 800 }}>{gpu.name}</div>
                  <div className="muted" style={{ marginTop: 8, lineHeight: 1.8 }}>
                    <div>Providers: {prices.stats.providerCount}</div>
                    <div>Min: {formatUsdPerHour(prices.stats.min)}</div>
                    <div>Median: {formatUsdPerHour(prices.stats.median)}</div>
                    <div>Max: {formatUsdPerHour(prices.stats.max)}</div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <Link
                      href={`/cloud-gpu/${seoGpuSlug(gpu.slug)}`}
                      style={{ textDecoration: "underline" }}
                    >
                      View {gpu.short_name} pricing →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="card" style={{ marginTop: 18, padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>How to choose</h2>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            <p style={{ marginTop: 0 }}>
              For training, VRAM and multi‑GPU scaling dominate. If your model barely fits in VRAM,
              prefer the GPU with more headroom to avoid activation checkpointing and to increase
              batch size. For inference, memory bandwidth and the ability to host larger KV caches
              can matter more than raw compute.
            </p>
            <p style={{ marginBottom: 0 }}>
              When two GPUs have similar hourly pricing, the one that reduces runtime (faster
              throughput) is usually the cheaper option overall. Use the cost estimator to compare
              total cost for your expected hours and GPU count.
            </p>
          </div>
        </section>

        <section className="card" style={{ marginTop: 18, padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>FAQ</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {faqs.map((f) => (
              <div key={f.q}>
                <div style={{ fontWeight: 800 }}>{f.q}</div>
                <div className="muted" style={{ marginTop: 4, lineHeight: 1.7 }}>
                  {f.a}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  notFound();
}
