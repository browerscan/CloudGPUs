import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { Sparkline } from "@/components/Sparkline";
import { ReviewForm } from "@/components/ReviewForm";
import { ReviewSchema } from "@/components/ReviewSchema";
import { Stars } from "@/components/Stars";
import { affiliateClickUrl, apiGet, getProvider, listProviders, priceHistory } from "@/lib/api";
import { seoGpuSlug } from "@/lib/aliases";
import { formatRelativeTime } from "@/lib/format";

export const revalidate = 60;

export async function generateStaticParams() {
  try {
    const list = await listProviders();
    return list.docs.slice(0, 30).map((p) => ({ slug: p.slug }));
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
  const provider = await getProvider(slug);
  return {
    title: `${provider.name} GPU cloud pricing (${new Date().getFullYear()})`,
    description:
      `Compare ${provider.name} GPU pricing across available instance types, including on‑demand and spot rates when published. ` +
      `See regions, reliability tier, and updated timestamps.`,
    alternates: { canonical: `/provider/${provider.slug}` },
  };
}

export default async function ProviderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const provider = await getProvider(slug);

  const instances = await apiGet<{
    docs: Array<{
      id: string;
      gpu_slug?: string;
      gpu_name?: string;
      gpu_short_name?: string;
      gpu_vram_gb?: number;
      gpu_architecture?: string;
      price_per_gpu_hour: string;
      price_per_hour_spot: string | null;
      gpu_count: number;
      has_nvlink?: boolean | null;
      has_infiniband?: boolean | null;
      infiniband_bandwidth_gbps?: number | null;
      network_bandwidth_gbps?: string | null;
      availability_status: string;
      last_scraped_at: string;
    }>;
  }>(
    `/api/instances?limit=200&depth=1&where[provider_id][equals]=${encodeURIComponent(provider.id)}&where[is_active][equals]=true&sort=price_per_gpu_hour`,
    { next: { revalidate: 60 } },
  );

  const reliability = await apiGet<{
    provider: {
      slug: string;
      providerType: string;
      reliabilityTier: string;
      slaUptimePercent: number | null;
    };
    last30d: {
      completionRate: number | null;
      total: number;
      completed: number;
      failed: number;
      timeout: number;
      rateLimited: number;
    };
    score: { badge: "green" | "yellow" | "red" | "unknown"; jobCompletionRate: number | null };
  }>(`/api/providers/${encodeURIComponent(provider.slug)}/reliability`, {
    next: { revalidate: 300 },
  }).catch(() => null);

  const reviews = await apiGet<{
    provider: string;
    reviews: Array<{
      id: string;
      rating: number;
      title: string | null;
      body: string;
      authorName: string | null;
      createdAt: string;
    }>;
  }>(`/api/providers/${encodeURIComponent(provider.slug)}/reviews`, {
    next: { revalidate: 300 },
  }).catch(() => ({
    provider: provider.slug,
    reviews: [],
  }));

  const grouped = new Map<
    string,
    {
      gpuSlug: string;
      gpuName: string;
      gpuShortName: string;
      gpuVramGb: number | null;
      gpuArchitecture: string | null;
      minOnDemand: number | null;
      minSpot: number | null;
      availability: string;
      lastUpdated: string;
      hasNvlink: boolean;
      hasInfiniband: boolean;
      infinibandBandwidthGbps: number | null;
      networkBandwidthGbps: number | null;
    }
  >();

  for (const row of instances.docs) {
    const gpuSlug = row.gpu_slug ?? "unknown";
    const entry = grouped.get(gpuSlug);
    const onDemand = Number(row.price_per_gpu_hour);
    const spot = row.price_per_hour_spot
      ? Number(row.price_per_hour_spot) / Math.max(1, row.gpu_count)
      : null;

    if (!entry) {
      grouped.set(gpuSlug, {
        gpuSlug,
        gpuName: row.gpu_name ?? row.gpu_short_name ?? gpuSlug,
        gpuShortName: row.gpu_short_name ?? row.gpu_name ?? gpuSlug,
        gpuVramGb: row.gpu_vram_gb ?? null,
        gpuArchitecture: row.gpu_architecture ?? null,
        minOnDemand: Number.isFinite(onDemand) ? onDemand : null,
        minSpot: spot != null && Number.isFinite(spot) ? spot : null,
        availability: row.availability_status ?? "available",
        lastUpdated: row.last_scraped_at,
        hasNvlink: Boolean(row.has_nvlink),
        hasInfiniband: Boolean(row.has_infiniband),
        infinibandBandwidthGbps: row.infiniband_bandwidth_gbps ?? null,
        networkBandwidthGbps: row.network_bandwidth_gbps
          ? Number(row.network_bandwidth_gbps)
          : null,
      });
      continue;
    }

    if (Number.isFinite(onDemand) && (entry.minOnDemand == null || onDemand < entry.minOnDemand))
      entry.minOnDemand = onDemand;
    if (spot != null && Number.isFinite(spot) && (entry.minSpot == null || spot < entry.minSpot))
      entry.minSpot = spot;
    if (new Date(row.last_scraped_at).getTime() > new Date(entry.lastUpdated).getTime())
      entry.lastUpdated = row.last_scraped_at;
    if (row.has_nvlink) entry.hasNvlink = true;
    if (row.has_infiniband) entry.hasInfiniband = true;
    if (
      typeof row.infiniband_bandwidth_gbps === "number" &&
      Number.isFinite(row.infiniband_bandwidth_gbps)
    ) {
      entry.infinibandBandwidthGbps = Math.max(
        entry.infinibandBandwidthGbps ?? 0,
        row.infiniband_bandwidth_gbps,
      );
    }
    if (row.network_bandwidth_gbps) {
      const bw = Number(row.network_bandwidth_gbps);
      if (Number.isFinite(bw))
        entry.networkBandwidthGbps = Math.max(entry.networkBandwidthGbps ?? 0, bw);
    }
  }

  const offerings = [...grouped.values()]
    .filter((g) => g.gpuSlug !== "unknown")
    .sort((a, b) => {
      const av = a.minOnDemand ?? Infinity;
      const bv = b.minOnDemand ?? Infinity;
      return av - bv;
    });

  const cheapest = offerings[0]?.minOnDemand ?? null;
  const mostExpensive =
    offerings.length > 0
      ? Math.max(...offerings.map((o) => o.minOnDemand ?? 0).filter((v) => Number.isFinite(v)))
      : null;
  const cheapestGpu = offerings[0] ?? null;
  const updatedAt = provider.last_price_update ?? offerings[0]?.lastUpdated ?? null;
  const updatedAgeHours = updatedAt
    ? (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60)
    : null;

  // Determine reliability badge
  const reliabilityBadge = (() => {
    if (reliability?.score.badge === "green") return { label: "Excellent", color: "badgeGreen" };
    if (reliability?.score.badge === "yellow") return { label: "Good", color: "badgeYellow" };
    if (reliability?.score.badge === "red") return { label: "Poor", color: "badgeRed" };
    return { label: "Unknown", color: "" };
  })();

  // Generate pros and cons based on provider data
  const pros: string[] = [];
  const cons: string[] = [];

  if (provider.has_public_api) pros.push("Public API available");
  else cons.push("No documented public API");

  if (provider.supports_spot_instances) pros.push("Spot/preemptible instances offered");
  else cons.push("No spot instances advertised");

  if (provider.supports_reserved_instances) pros.push("Reserved pricing available");
  else cons.push("No reserved pricing options");

  if (provider.sla_uptime_percent && Number(provider.sla_uptime_percent) >= 99.9) {
    pros.push(`Strong SLA (${provider.sla_uptime_percent}% uptime)`);
  } else if (!provider.sla_uptime_percent) {
    cons.push("No published SLA");
  }

  if (provider.available_regions && provider.available_regions.length >= 5) {
    pros.push(`${provider.available_regions.length}+ regions available`);
  } else if (provider.available_regions && provider.available_regions.length < 3) {
    cons.push("Limited region coverage");
  }

  if (provider.reliability_tier === "enterprise") {
    pros.push("Enterprise reliability tier");
  } else if (provider.reliability_tier === "standard") {
    pros.push("Standard reliability tier");
  } else if (provider.reliability_tier === "marketplace") {
    cons.push("Marketplace reliability (varies by host)");
  }

  if (reliability?.score.badge === "green") {
    pros.push(`High job completion rate (${reliability.score.jobCompletionRate}%)`);
  } else if (reliability?.score.badge === "red") {
    cons.push("Low observed reliability");
  }

  if (offerings.length > 20) {
    pros.push(`Large GPU catalog (${offerings.length}+ offerings)`);
  } else if (offerings.length < 5) {
    cons.push("Limited GPU selection");
  }

  const trendTarget = (() => {
    const preferred = [
      "h100-sxm",
      "h200-sxm",
      "b200-sxm",
      "a100-80gb",
      "l40s",
      "rtx-5090",
      "rtx-4090",
    ];
    for (const slug of preferred) {
      const found = offerings.find((o) => o.gpuSlug === slug);
      if (found) return found;
    }
    return offerings[0] ?? null;
  })();

  const history = trendTarget
    ? await priceHistory(trendTarget.gpuSlug, 90, provider.slug).catch(() => null)
    : null;
  const trendValues = history?.points.map((p) => p.min) ?? [];

  const anyNvlink = offerings.some((o) => o.hasNvlink);
  const anyInfiniBand = offerings.some((o) => o.hasInfiniband);
  const maxIb = offerings.reduce((acc, o) => Math.max(acc, o.infinibandBandwidthGbps ?? 0), 0);

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://cloudgpus.io/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Providers",
        item: "https://cloudgpus.io/provider",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: provider.name,
        item: `https://cloudgpus.io/provider/${provider.slug}`,
      },
    ],
  };

  const faqs = [
    {
      q: `Is ${provider.name} good for long training runs?`,
      a:
        `It depends on the reliability tier and the specific offering. ` +
        `For multi‑day training, prioritize enterprise/standard tiers, stable regions, and providers that publish SLAs or strong uptime history.`,
    },
    {
      q: `Does ${provider.name} offer spot or preemptible GPUs?`,
      a: provider.supports_spot_instances
        ? `Yes — ${provider.name} advertises spot/preemptible capacity for some GPUs. Spot is cheaper but can be interrupted.`
        : `Spot availability varies. If spot pricing is published for a given GPU, we display it in the pricing table.`,
    },
    {
      q: `How often is ${provider.name} pricing updated on CloudGPUs.io?`,
      a: `We refresh providers on a staggered schedule. This page shows “Updated” timestamps per offering so you can verify data freshness.`,
    },
    {
      q: `Can I use ${provider.name} via API?`,
      a:
        provider.has_public_api && provider.docs_url
          ? `Yes — see ${provider.docs_url}.`
          : `Check the provider docs for API availability.`,
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

  // Calculate aggregate rating from reviews
  const aggregateRating =
    reviews.reviews.length > 0
      ? {
          "@type": "AggregateRating",
          ratingValue: (
            reviews.reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.reviews.length
          ).toFixed(1),
          reviewCount: reviews.reviews.length,
          bestRating: "5",
          worstRating: "1",
        }
      : null;

  // Organization schema for provider
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: provider.name,
    url: provider.website_url,
    description: `${provider.name} GPU cloud provider - ${provider.provider_type} with ${provider.reliability_tier} reliability tier.`,
    ...(aggregateRating && { aggregateRating }),
  };

  return (
    <div className="container">
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />
      <JsonLd data={organizationSchema} />
      {reviews.reviews.length > 0 && (
        <ReviewSchema itemName={provider.name} itemType="Organization" reviews={reviews.reviews} />
      )}

      <div className="card" style={{ padding: 22 }}>
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}
        >
          <div>
            <h1 style={{ marginTop: 0 }}>{provider.name}</h1>
            <div className="muted" style={{ lineHeight: 1.7 }}>
              <div>
                Type: {provider.provider_type} · Tier: {provider.reliability_tier}
              </div>
              {provider.docs_url ? (
                <div>
                  API docs:{" "}
                  <a
                    href={provider.docs_url}
                    rel="noreferrer"
                    style={{ textDecoration: "underline" }}
                  >
                    {provider.docs_url}
                  </a>
                </div>
              ) : null}
              {provider.status_page_url ? (
                <div>
                  Status:{" "}
                  <a
                    href={provider.status_page_url}
                    rel="noreferrer"
                    style={{ textDecoration: "underline" }}
                  >
                    {provider.status_page_url}
                  </a>
                </div>
              ) : null}
              {provider.available_regions?.length ? (
                <div>Regions: {provider.available_regions.join(", ")}</div>
              ) : null}
              {updatedAt ? (
                <div>
                  Last updated: {formatRelativeTime(updatedAt)} ·{" "}
                  {new Date(updatedAt).toLocaleString()}
                  {updatedAgeHours != null && updatedAgeHours > 48 ? " · stale" : null}
                </div>
              ) : null}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link className="btn btnSecondary" href="/provider">
              All providers
            </Link>
            <a
              className="btn"
              href={affiliateClickUrl({ providerSlug: provider.slug })}
              rel="nofollow"
            >
              View offers
            </a>
          </div>
        </div>

        {/* Quick Summary Card */}
        <div style={{ marginTop: 18 }}>
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Quick Summary</h3>
            <div className="grid grid4" style={{ gap: 16, marginTop: 12 }}>
              <div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Total offerings
                </div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{offerings.length}</div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Cheapest GPU
                </div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>
                  {cheapestGpu ? cheapestGpu.gpuShortName : "—"}
                </div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12 }}>
                  From
                </div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>
                  {cheapest != null ? `$${cheapest.toFixed(2)}` : "—"}/hr
                </div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Reliability
                </div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>
                  <span className={`badge ${reliabilityBadge.color}`}>
                    {reliabilityBadge.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>GPU pricing</h2>
          <p className="muted" style={{ marginTop: 6, lineHeight: 1.7 }}>
            Below is a normalized <strong>$/GPU‑hour</strong> view of the cheapest observed
            on‑demand and spot pricing for each GPU. Offers can differ in CPU/RAM, storage, and
            networking — validate the instance details on the provider site before purchasing.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                    GPU
                  </th>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                    $/GPU‑hr
                  </th>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                    Spot
                  </th>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                    Availability
                  </th>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                    Updated
                  </th>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }} />
                </tr>
              </thead>
              <tbody>
                {offerings.map((g) => (
                  <tr key={g.gpuSlug}>
                    <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                      <Link
                        href={g.gpuSlug ? `/cloud-gpu/${seoGpuSlug(g.gpuSlug)}` : "#"}
                        style={{ fontWeight: 700 }}
                      >
                        {g.gpuName}
                      </Link>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {g.gpuVramGb ? `${g.gpuVramGb}GB` : null}
                        {g.gpuArchitecture ? ` · ${g.gpuArchitecture}` : null}
                      </div>
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                      {g.minOnDemand != null ? `$${g.minOnDemand.toFixed(2)}/hr` : "—"}
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                      {g.minSpot != null ? `$${g.minSpot.toFixed(2)}/hr` : "—"}
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                      <span className="muted" style={{ fontSize: 13 }}>
                        {g.availability}
                      </span>
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                      <span className="muted" style={{ fontSize: 13 }}>
                        {formatRelativeTime(g.lastUpdated)}
                      </span>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        {new Date(g.lastUpdated).toLocaleString()}
                      </div>
                    </td>
                    <td
                      style={{
                        padding: 12,
                        borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
                        textAlign: "right",
                      }}
                    >
                      {g.gpuSlug ? (
                        <Link className="btn" href={`/cloud-gpu/${seoGpuSlug(g.gpuSlug)}`}>
                          Compare
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!offerings.length ? (
                  <tr>
                    <td className="muted" style={{ padding: 12 }} colSpan={6}>
                      No pricing data yet. Try again soon.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* Pros & Cons */}
          {pros.length > 0 || cons.length > 0 ? (
            <div className="grid grid2" style={{ marginTop: 18, alignItems: "start" }}>
              <section className="card" style={{ padding: 16 }}>
                <h2 style={{ marginTop: 0, fontSize: 18 }}>Pros</h2>
                <div className="muted" style={{ lineHeight: 1.8 }}>
                  {pros.length > 0 ? (
                    pros.map((pro, i) => (
                      <div key={i} style={{ display: "flex", gap: 8 }}>
                        <span style={{ color: "#22c55e" }}>+</span>
                        <span>{pro}</span>
                      </div>
                    ))
                  ) : (
                    <div>No data available</div>
                  )}
                </div>
              </section>

              <section className="card" style={{ padding: 16 }}>
                <h2 style={{ marginTop: 0, fontSize: 18 }}>Cons</h2>
                <div className="muted" style={{ lineHeight: 1.8 }}>
                  {cons.length > 0 ? (
                    cons.map((con, i) => (
                      <div key={i} style={{ display: "flex", gap: 8 }}>
                        <span style={{ color: "#ef4444" }}>-</span>
                        <span>{con}</span>
                      </div>
                    ))
                  ) : (
                    <div>No data available</div>
                  )}
                </div>
              </section>
            </div>
          ) : null}

          <div className="grid grid2" style={{ marginTop: 18, alignItems: "start" }}>
            <section className="card" style={{ padding: 16 }}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Key features</h2>
              <div className="muted" style={{ lineHeight: 1.8 }}>
                <div>
                  Public API: <strong>{provider.has_public_api ? "Yes" : "Unknown/No"}</strong>{" "}
                  {provider.docs_url ? (
                    <span>
                      · <a href={provider.docs_url}>docs</a>
                    </span>
                  ) : null}
                </div>
                <div>
                  Spot/preemptible:{" "}
                  <strong>{provider.supports_spot_instances ? "Yes" : "Unknown/No"}</strong>
                </div>
                <div>
                  Reserved pricing:{" "}
                  <strong>{provider.supports_reserved_instances ? "Yes" : "Unknown/No"}</strong>
                </div>
                <div>
                  NVLink: <strong>{anyNvlink ? "Yes" : "Unknown/No"}</strong>
                </div>
                <div>
                  InfiniBand:{" "}
                  <strong>
                    {anyInfiniBand ? "Yes" : "Unknown/No"}
                    {anyInfiniBand && maxIb ? ` (${maxIb}Gbps max)` : ""}
                  </strong>
                </div>
                <div>
                  SLA uptime:{" "}
                  <strong>
                    {provider.sla_uptime_percent
                      ? `${Number(provider.sla_uptime_percent).toFixed(2)}%`
                      : "—"}
                  </strong>
                </div>
                <div style={{ marginTop: 10 }}>
                  Cheapest observed:{" "}
                  <strong>{cheapest != null ? `$${cheapest.toFixed(2)}/GPU‑hr` : "—"}</strong>
                </div>
              </div>
            </section>

            <section className="card" style={{ padding: 16 }}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Reliability signal</h2>
              <div className="muted" style={{ lineHeight: 1.8 }}>
                {reliability ? (
                  <>
                    <div>
                      Badge:{" "}
                      <strong>
                        {reliability.score.badge}{" "}
                        {reliability.score.jobCompletionRate != null
                          ? `(${reliability.score.jobCompletionRate}%)`
                          : ""}
                      </strong>
                    </div>
                    {reliability.last30d.completionRate != null ? (
                      <div>
                        30‑day scrape completion:{" "}
                        {(reliability.last30d.completionRate * 100).toFixed(1)}%
                      </div>
                    ) : null}
                    <div>
                      Last 30 days: {reliability.last30d.completed}/{reliability.last30d.total}{" "}
                      completed · {reliability.last30d.failed} failed ·{" "}
                      {reliability.last30d.timeout} timeouts
                    </div>
                    <div style={{ marginTop: 10 }}>
                      For DePIN/community providers, reliability can vary by host/node. For
                      multi‑hour training runs, plan for interruptions and checkpoint frequently.
                    </div>
                  </>
                ) : (
                  <div>No reliability data yet.</div>
                )}
                <div style={{ marginTop: 10 }}>
                  Comparing providers? Try{" "}
                  <Link
                    href={`/compare/${[provider.slug, "runpod"].sort().join("-vs-")}`}
                    style={{ textDecoration: "underline" }}
                  >
                    {provider.slug} vs runpod
                  </Link>
                  .
                </div>
              </div>
            </section>
          </div>

          {trendTarget ? (
            <section className="card" style={{ marginTop: 18, padding: 16 }}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>90‑day price trend (min)</h2>
              <div className="muted" style={{ lineHeight: 1.8 }}>
                <div>
                  Tracking:{" "}
                  <Link
                    href={`/cloud-gpu/${seoGpuSlug(trendTarget.gpuSlug)}`}
                    style={{ textDecoration: "underline" }}
                  >
                    {trendTarget.gpuShortName}
                  </Link>{" "}
                  on {provider.name}.
                </div>
                <div style={{ marginTop: 10 }}>
                  <Sparkline values={trendValues} width={320} height={54} />
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Reviews</h2>
        <div className="muted" style={{ lineHeight: 1.7 }}>
          Reviews help readers understand provisioning speed, stability, billing gotchas, and
          support quality. This is especially useful for marketplace/DePIN options where host
          reliability varies.
        </div>

        <div className="grid grid2" style={{ marginTop: 14, alignItems: "start" }}>
          <div style={{ display: "grid", gap: 12 }}>
            {reviews.reviews.map((r) => (
              <div key={r.id} className="card" style={{ padding: 14 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontWeight: 800 }}>{r.title ?? "Review"}</div>
                  <Stars rating={r.rating} />
                </div>
                <div className="muted" style={{ marginTop: 8, lineHeight: 1.7 }}>
                  {r.body}
                </div>
                <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                  {r.authorName ? `${r.authorName} · ` : ""}
                  {new Date(r.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
            {!reviews.reviews.length ? (
              <div className="card muted" style={{ padding: 14, lineHeight: 1.7 }}>
                No published reviews yet.
              </div>
            ) : null}
          </div>
          <ReviewForm providerSlug={provider.slug} />
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
