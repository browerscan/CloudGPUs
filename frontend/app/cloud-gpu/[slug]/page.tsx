import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { PriceAlertForm } from "@/components/PriceAlertForm";
import { PriceTable } from "@/components/PriceTable";
import { Sparkline } from "@/components/Sparkline";
import { SocialProof } from "@/components/SocialProof";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { comparePrices, getGpuModel, listGpuModels, priceHistory } from "@/lib/api";
import { normalizeGpuSlug, seoGpuSlug } from "@/lib/aliases";
import { generateGpuFaqs, generateGpuIntro } from "@/lib/content";
import { env } from "@/lib/env";
import { USE_CASE_PAGES } from "@/lib/pseo";

export const revalidate = 600;

export async function generateStaticParams() {
  try {
    const list = await listGpuModels();
    const seen = new Set<string>();
    const slugs = list.docs.map((g) => seoGpuSlug(g.slug));
    const out: Array<{ slug: string }> = [];
    for (const slug of slugs) {
      if (seen.has(slug)) continue;
      seen.add(slug);
      out.push({ slug });
    }
    return out;
  } catch {
    // Skip pre-generation if API is unavailable during build.
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const normalized = normalizeGpuSlug(slug);
  const canonical = seoGpuSlug(normalized);
  const [gpu, compare] = await Promise.all([getGpuModel(normalized), comparePrices(canonical)]);

  const min = compare.stats.min;
  const title = `${gpu.name} cloud pricing (${new Date(compare.generatedAt).getFullYear()})`;
  const description =
    `Compare ${gpu.name} hourly pricing across providers. ` +
    (min != null
      ? `Prices start around $${min.toFixed(2)}/GPU‑hr.`
      : "Pricing varies by provider.") +
    " Includes on‑demand vs spot, freshness timestamps, and affiliate links.";

  return {
    title,
    description,
    alternates: { canonical: `/cloud-gpu/${canonical}` },
    openGraph: {
      title,
      description,
      url: `/cloud-gpu/${canonical}`,
      images: [{ url: `/og/gpu/${canonical}` }],
    },
  };
}

export default async function CloudGpuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalized = normalizeGpuSlug(slug);
  const canonical = seoGpuSlug(normalized);
  if (slug !== canonical) redirect(`/cloud-gpu/${canonical}`);
  const [gpu, compare, history] = await Promise.all([
    getGpuModel(normalized),
    comparePrices(canonical),
    priceHistory(canonical, 90).catch(() => null),
  ]);

  const intro = generateGpuIntro(gpu, compare);
  const faqs = generateGpuFaqs(gpu);
  const trendValues = history?.points.map((p) => p.min) ?? [];

  const priceDrop7d = computePercentChange(history?.points ?? [], 7);
  const priceDropText =
    priceDrop7d != null && priceDrop7d <= -5
      ? `Price dropped ${Math.abs(priceDrop7d).toFixed(0)}% (7d)`
      : null;

  const bestFor = USE_CASE_PAGES.filter((u) =>
    Object.values(u.recommendations).includes(gpu.slug),
  ).slice(0, 6);

  // Find alternative GPUs with similar VRAM
  const alternatives = await Promise.all(
    [0.75, 1.25, 1.5].map(async (factor) => {
      try {
        const targetVram = Math.round(gpu.vram_gb * factor);
        const gpus = await listGpuModels();
        const alternatives = gpus.docs
          .filter((g) => g.slug !== gpu.slug && Math.abs(g.vram_gb - targetVram) < 8)
          .slice(0, 2);
        return alternatives;
      } catch {
        return [];
      }
    }),
  ).then((results) => {
    const seen = new Set<string>();
    return results.flat().filter((g) => {
      if (seen.has(g.slug)) return false;
      seen.add(g.slug);
      return true;
    });
  });

  // Related comparisons based on GPU architecture/tier
  const relatedComparisons = [
    gpu.slug.includes("h100") || gpu.slug.includes("h200")
      ? { href: "/compare/h100-vs-h200", title: "H100 vs H200" }
      : null,
    gpu.slug.includes("a100") ? { href: "/compare/h100-vs-a100", title: "H100 vs A100" } : null,
    gpu.slug.includes("4090")
      ? { href: "/compare/rtx-4090-vs-rtx-5090", title: "RTX 4090 vs RTX 5090" }
      : null,
    gpu.slug.includes("l40s") ? { href: "/compare/a100-vs-l40s", title: "A100 vs L40S" } : null,
  ].filter((c): c is { href: string; title: string } => c !== null);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://cloudgpus.io/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Cloud GPU",
        item: "https://cloudgpus.io/cloud-gpu",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: gpu.name,
        item: `https://cloudgpus.io/cloud-gpu/${canonical}`,
      },
    ],
  };

  // Product schema for rich results
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: gpu.name,
    description: `${gpu.name} cloud GPU with ${gpu.vram_gb}GB ${gpu.memory_type} memory. Compare on-demand and spot pricing across ${compare.stats.providerCount} cloud providers.`,
    brand: {
      "@type": "Brand",
      name: gpu.architecture,
    },
    offers: {
      "@type": "AggregateOffer",
      url: `https://cloudgpus.io/cloud-gpu/${canonical}`,
      priceCurrency: "USD",
      lowPrice: compare.stats.min?.toFixed(2) ?? undefined,
      highPrice: compare.stats.max?.toFixed(2) ?? undefined,
      offerCount: compare.prices.length,
      availability:
        compare.stats.providerCount > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: "CloudGPUs.io",
        url: "https://cloudgpus.io",
      },
    },
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "VRAM",
        value: `${gpu.vram_gb} GB`,
      },
      {
        "@type": "PropertyValue",
        name: "Architecture",
        value: gpu.architecture,
      },
      {
        "@type": "PropertyValue",
        name: "Memory Type",
        value: gpu.memory_type,
      },
      {
        "@type": "PropertyValue",
        name: "Provider Count",
        value: compare.stats.providerCount,
      },
    ],
  };

  return (
    <div className="container">
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />
      <JsonLd data={productSchema} />

      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Cloud GPUs", href: "/cloud-gpu" },
          { label: gpu.name },
        ]}
      />

      <SocialProof gpuSlug={gpu.slug} gpuName={gpu.name} />

      <div className="card" style={{ padding: 22 }}>
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}
        >
          <div>
            <h1 style={{ marginTop: 0 }}>{gpu.name} pricing</h1>
            <p className="muted" style={{ maxWidth: 860, lineHeight: 1.7 }}>
              {intro}
            </p>
            {priceDropText ? (
              <div style={{ marginTop: 10 }}>
                <span className="badge badgeGreen">{priceDropText}</span>
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Link className="btn btnSecondary" href="/cloud-gpu">
              All GPUs
            </Link>
            <a
              className="btn btnSecondary"
              href={`${env.apiBaseUrl}/api/export/compare.csv?gpuSlug=${encodeURIComponent(gpu.slug)}&includeSpot=true`}
            >
              Download CSV
            </a>
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              90‑day trend (min)
            </div>
            <div style={{ marginTop: 8 }}>
              <Sparkline values={trendValues} />
            </div>
          </div>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.7, maxWidth: 520 }}>
            Data is refreshed on a staggered schedule per provider. If you see stale results, check
            the provider page or re‑run the comparison in a few minutes.
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <PriceTable gpuSlug={gpu.slug} rows={compare.prices} />
          <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>
            For programmatic downloads, use{" "}
            <a
              href={`${env.apiBaseUrl}/api/export/compare.csv?gpuSlug=${encodeURIComponent(gpu.slug)}&includeSpot=true`}
            >
              export/compare.csv
            </a>{" "}
            or{" "}
            <a
              href={`${env.apiBaseUrl}/api/export/instances.csv?gpu=${encodeURIComponent(gpu.slug)}`}
            >
              export/instances.csv
            </a>
            .
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <PriceAlertForm gpuSlug={gpu.slug} currentCheapestPrice={compare.stats.min} />
      </div>

      {/* Quick Stats */}
      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Quick Stats</h2>
        <div className="grid grid4" style={{ gap: 16 }}>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>
              Available from
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>
              {compare.stats.providerCount} providers
            </div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>
              Price range
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>
              {compare.stats.min != null ? `$${compare.stats.min.toFixed(2)}` : "—"}
              {compare.stats.max != null ? ` – $${compare.stats.max.toFixed(2)}` : ""}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              /GPU-hr
            </div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>
              VRAM
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{gpu.vram_gb} GB</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>
              Architecture
            </div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{gpu.architecture}</div>
          </div>
        </div>
      </section>

      {/* Key Specifications */}
      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Key Specifications</h2>
        <div className="grid grid2" style={{ gap: 16 }}>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            <div>
              <strong>Architecture:</strong> {gpu.architecture}
            </div>
            <div>
              <strong>VRAM:</strong> {gpu.vram_gb} GB
            </div>
            <div>
              <strong>Memory Type:</strong> {gpu.memory_type}
            </div>
            {gpu.memory_bandwidth_gbps ? (
              <div>
                <strong>Memory Bandwidth:</strong> {gpu.memory_bandwidth_gbps} GB/s
              </div>
            ) : null}
            {gpu.tdp_watts ? (
              <div>
                <strong>TDP:</strong> {gpu.tdp_watts}W
              </div>
            ) : null}
            {gpu.generation_year ? (
              <div>
                <strong>Generation:</strong> {gpu.generation_year}
              </div>
            ) : null}
          </div>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            <div>
              <strong>Datacenter GPU:</strong> {gpu.is_datacenter ? "Yes" : "No"}
            </div>
            <div>
              <strong>Consumer GPU:</strong> {gpu.is_consumer ? "Yes" : "No"}
            </div>
            <div>
              <strong>Providers:</strong> {compare.stats.providerCount}
            </div>
            <div>
              <strong>Min Price:</strong> ${compare.stats.min?.toFixed(2) ?? "—"}/hr
            </div>
            <div>
              <strong>Median Price:</strong> ${compare.stats.median?.toFixed(2) ?? "—"}/hr
            </div>
          </div>
        </div>
        <div
          style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(15, 23, 42, 0.08)" }}
        >
          <div className="muted" style={{ fontSize: 13 }}>
            <strong>Related:</strong>{" "}
            {relatedComparisons.map((c, idx) => (
              <span key={c.href}>
                {idx ? " · " : ""}
                <Link href={c.href} style={{ textDecoration: "underline" }}>
                  {c.title}
                </Link>
              </span>
            ))}
            {relatedComparisons.length > 0 ? " · " : ""}
            <Link href="/best-gpu-for/llm-training" style={{ textDecoration: "underline" }}>
              Best GPU for LLM training
            </Link>
          </div>
        </div>
      </section>

      {/* Best For */}
      {bestFor.length > 0 ? (
        <section className="card" style={{ marginTop: 18, padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Best For</h2>
          <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
            {gpu.name} is recommended for these use cases based on VRAM, performance, and cost
            characteristics.
          </p>
          <div className="grid grid3" style={{ gap: 12 }}>
            {bestFor.map((u) => (
              <Link
                key={u.slug}
                href={`/best-gpu-for/${u.slug}`}
                className="card"
                style={{ padding: 14, textDecoration: "none" }}
              >
                <div style={{ fontWeight: 700 }}>{u.name}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Min VRAM: {u.minVramGb}GB
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Alternatives */}
      {alternatives.length > 0 ? (
        <section className="card" style={{ marginTop: 18, padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Alternatives</h2>
          <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
            Consider these GPUs with similar VRAM capacity and performance characteristics.
          </p>
          <div className="grid grid3" style={{ gap: 12 }}>
            {alternatives.slice(0, 6).map((g) => (
              <Link
                key={g.slug}
                href={`/cloud-gpu/${seoGpuSlug(g.slug)}`}
                className="card"
                style={{ padding: 14, textDecoration: "none" }}
              >
                <div style={{ fontWeight: 700 }}>{g.name}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {g.vram_gb}GB · {g.architecture}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Related Comparisons */}
      {relatedComparisons.length > 0 ? (
        <section className="card" style={{ marginTop: 18, padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Related Comparisons</h2>
          <div className="grid grid2" style={{ gap: 12 }}>
            {relatedComparisons.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="card"
                style={{ padding: 14, textDecoration: "none" }}
              >
                <div style={{ fontWeight: 700 }}>{c.title}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Side-by-side pricing comparison
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid grid2" style={{ marginTop: 18 }}>
        <section className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>How to interpret pricing</h2>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            <p style={{ marginTop: 0 }}>
              Hourly GPU prices vary because providers bundle different resources. Two offers that
              both say "{gpu.short_name}" can differ in CPU/RAM, storage, networking (InfiniBand vs
              Ethernet), and whether the GPU is SXM or PCIe.
            </p>
            <p>
              For cost planning, start with <strong>$/GPU‑hour</strong> and then validate billing
              increments (hourly vs per‑minute), minimum rental time, and any add‑ons such as
              storage or egress. If you use spot/preemptible capacity, assume interruptions and
              checkpoint frequently.
            </p>
            <p style={{ marginBottom: 0 }}>
              For production inference, reliability and region coverage often matter more than the
              absolute minimum price. For training, network and multi‑GPU scaling can dominate total
              runtime cost even when hourly rates look higher.
            </p>
          </div>
        </section>

        <section className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>See also</h2>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            <p style={{ marginTop: 0 }}>
              Explore more GPUs and resources to find the best option for your workload.
            </p>
            <div style={{ marginTop: 12 }}>
              <Link href="/cloud-gpu" style={{ textDecoration: "underline" }}>
                Browse all GPUs
              </Link>
            </div>
            <div>
              <Link href="/provider" style={{ textDecoration: "underline" }}>
                Compare providers
              </Link>
            </div>
            <div>
              <Link href="/best-gpu-for" style={{ textDecoration: "underline" }}>
                Find GPU by use case
              </Link>
            </div>
            <div>
              <Link href="/calculator" style={{ textDecoration: "underline" }}>
                GPU calculators
              </Link>
            </div>
          </div>
        </section>
      </div>

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

function computePercentChange(points: Array<{ day: string; min: number | null }>, daysAgo: number) {
  if (daysAgo <= 0 || points.length < 2) return null;
  const last = [...points]
    .reverse()
    .find((p) => typeof p.min === "number" && Number.isFinite(p.min));
  if (!last || last.min == null) return null;

  const lastDate = new Date(`${last.day}T00:00:00Z`);
  if (!Number.isFinite(lastDate.getTime())) return null;
  const target = new Date(lastDate);
  target.setUTCDate(target.getUTCDate() - daysAgo);

  let targetPoint: { day: string; min: number | null } | null = null;
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i]!;
    if (typeof p.min !== "number" || !Number.isFinite(p.min)) continue;
    const d = new Date(`${p.day}T00:00:00Z`).getTime();
    if (!Number.isFinite(d)) continue;
    if (d <= target.getTime()) {
      targetPoint = p;
      break;
    }
  }
  if (!targetPoint || targetPoint.min == null) return null;

  const base = targetPoint.min;
  if (base <= 0) return null;
  return ((last.min - base) / base) * 100;
}
