import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { Sparkline } from "@/components/Sparkline";
import {
  apiGet,
  comparePrices,
  getGpuModel,
  getProvider,
  listGpuModels,
  listProviders,
  priceHistory,
} from "@/lib/api";
import { normalizeProviderSlug, seoGpuSlug } from "@/lib/aliases";
import { formatRelativeTime } from "@/lib/format";

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    const [providers, gpus] = await Promise.all([listProviders(), listGpuModels()]);
    const params: Array<{ provider: string; gpu: string }> = [];

    // Generate combinations for top providers and GPUs to avoid combinatorial explosion
    const topProviders = providers.docs.slice(0, 15);
    const topGpus = gpus.docs.slice(0, 20);

    for (const provider of topProviders) {
      for (const gpu of topGpus) {
        params.push({
          provider: provider.slug,
          gpu: seoGpuSlug(gpu.slug),
        });
      }
    }

    return params;
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ provider: string; gpu: string }>;
}): Promise<Metadata> {
  const { provider, gpu } = await params;
  const normalizedProvider = normalizeProviderSlug(provider);

  const [providerData, gpuData] = await Promise.all([
    getProvider(normalizedProvider).catch(() => null),
    getGpuModel(gpu).catch(() => null),
  ]);

  if (!providerData || !gpuData) notFound();

  const title = `${gpuData.name} on ${providerData.name} - Pricing (${new Date().getFullYear()})`;
  const description = `Current pricing for ${gpuData.name} GPU on ${providerData.name}. Compare on-demand and spot rates, view price history, and find affiliate links.`;

  return {
    title,
    description,
    alternates: { canonical: `/${normalizedProvider}/${gpu}` },
    openGraph: {
      title,
      description,
      url: `/${normalizedProvider}/${gpu}`,
    },
  };
}

export default async function ProviderGpuPage({
  params,
}: {
  params: Promise<{ provider: string; gpu: string }>;
}) {
  const { provider, gpu } = await params;
  const normalizedProvider = normalizeProviderSlug(provider);

  // Validate params and redirect if needed
  const [providerData, gpuData] = await Promise.all([
    getProvider(normalizedProvider).catch(() => null),
    getGpuModel(gpu).catch(() => null),
  ]);

  if (!providerData) notFound();
  if (!gpuData) notFound();

  const canonicalGpu = seoGpuSlug(gpuData.slug);
  if (provider !== normalizedProvider || gpu !== canonicalGpu) {
    redirect(`/${normalizedProvider}/${canonicalGpu}`);
  }

  // Get pricing for this GPU on this provider
  const compare = await comparePrices(canonicalGpu);
  const providerPrices = compare.prices.filter((p) => p.provider.slug === normalizedProvider);

  // Get price history
  const history = await priceHistory(canonicalGpu, 90, normalizedProvider).catch(() => null);
  const trendValues = history?.points.map((p) => p.min) ?? [];

  // Get provider's other GPUs
  const instances = await apiGet<{
    docs: Array<{
      gpu_slug: string;
      gpu_name: string;
      gpu_short_name: string;
      gpu_vram_gb: number;
      gpu_architecture: string;
      price_per_gpu_hour: string;
      price_per_hour_spot: string | null;
      last_scraped_at: string;
    }>;
  }>(
    `/api/instances?limit=100&depth=1&where[provider_id][equals]=${encodeURIComponent(providerData.id)}&where[is_active][equals]=true&sort=price_per_gpu_hour`,
    { next: { revalidate: 600 } },
  ).catch(() => ({ docs: [] }));

  // Group instances by GPU slug
  const otherGpus = new Map<
    string,
    {
      gpuSlug: string;
      gpuName: string;
      gpuShortName: string;
      gpuVramGb: number;
      minPrice: number;
    }
  >();

  for (const inst of instances.docs) {
    if (inst.gpu_slug === gpuData.slug) continue;
    const price = Number(inst.price_per_gpu_hour);
    if (!Number.isFinite(price)) continue;

    const existing = otherGpus.get(inst.gpu_slug);
    if (!existing || price < existing.minPrice) {
      otherGpus.set(inst.gpu_slug, {
        gpuSlug: inst.gpu_slug,
        gpuName: inst.gpu_name,
        gpuShortName: inst.gpu_short_name,
        gpuVramGb: inst.gpu_vram_gb,
        minPrice: price,
      });
    }
  }

  const sortedOtherGpus = [...otherGpus.values()].sort((a, b) => a.minPrice - b.minPrice);

  // Find cheapest alternative provider for this GPU
  const cheapestProvider = compare.prices.find(
    (p) =>
      p.onDemand !== null &&
      (providerPrices.length === 0 || p.onDemand < (providerPrices[0]?.onDemand ?? Infinity)),
  );

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://cloudgpus.io/" },
      {
        "@type": "ListItem",
        position: 2,
        name: providerData.name,
        item: `https://cloudgpus.io/provider/${normalizedProvider}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: gpuData.name,
        item: `https://cloudgpus.io/${normalizedProvider}/${canonicalGpu}`,
      },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `How much does ${gpuData.name} cost on ${providerData.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text:
            providerPrices.length > 0 && providerPrices[0]?.onDemand
              ? `${gpuData.name} on ${providerData.name} starts at $${providerPrices[0].onDemand.toFixed(2)}/GPU-hour for on-demand instances. Spot pricing may be available at lower rates.`
              : `Pricing for ${gpuData.name} on ${providerData.name} varies. Check the provider's website for current rates.`,
        },
      },
      {
        "@type": "Question",
        name: `Does ${providerData.name} offer spot pricing for ${gpuData.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: providerPrices.some((p) => p.spot !== null)
            ? `Yes, spot pricing is available for ${gpuData.name} on ${providerData.name}.`
            : `Spot availability varies. Check the pricing table for current spot rates.`,
        },
      },
      {
        "@type": "Question",
        name: "How reliable is this provider for GPU workloads?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `${providerData.name} is a ${providerData.provider_type} provider with ${providerData.reliability_tier} reliability tier${providerData.sla_uptime_percent ? ` and ${providerData.sla_uptime_percent}% SLA` : ""}.`,
        },
      },
    ],
  };

  const hasPricing = providerPrices.length > 0;
  const minOnDemand = providerPrices.find((p) => p.onDemand !== null)?.onDemand ?? null;
  const minSpot = providerPrices.find((p) => p.spot !== null)?.spot ?? null;

  return (
    <div className="container">
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />

      <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          Home
        </Link>{" "}
        <span style={{ opacity: 0.5 }}>/</span>{" "}
        <Link href={`/provider/${normalizedProvider}`} style={{ textDecoration: "none" }}>
          {providerData.name}
        </Link>{" "}
        <span style={{ opacity: 0.5 }}>/</span> <span>{gpuData.name}</span>
      </div>

      <div className="card" style={{ padding: 22 }}>
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}
        >
          <div>
            <h1 style={{ marginTop: 0 }}>
              {gpuData.name} on {providerData.name}
            </h1>
            <p className="muted" style={{ maxWidth: 860, lineHeight: 1.7 }}>
              Compare {gpuData.name} pricing on {providerData.name}, including on-demand and spot
              rates. {gpuData.vram_gb}GB {gpuData.memory_type} · {gpuData.architecture}{" "}
              architecture.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link className="btn btnSecondary" href={`/provider/${normalizedProvider}`}>
              All {providerData.name} GPUs
            </Link>
            <Link className="btn btnSecondary" href={`/cloud-gpu/${canonicalGpu}`}>
              All providers
            </Link>
          </div>
        </div>

        {/* Pricing Summary */}
        <div className="grid grid4" style={{ gap: 16, marginTop: 18 }}>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              On-demand from
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>
              {minOnDemand !== null ? `$${minOnDemand.toFixed(2)}` : "—"}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              per GPU-hour
            </div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Spot from
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>
              {minSpot !== null ? `$${minSpot.toFixed(2)}` : "—"}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              per GPU-hour
            </div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              VRAM
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{gpuData.vram_gb} GB</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {gpuData.memory_type}
            </div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Instances
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{providerPrices.length}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              configurations
            </div>
          </div>
        </div>
      </div>

      {/* Price History */}
      {history && history.points.length > 0 ? (
        <div className="card" style={{ marginTop: 18, padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>90-Day Price Trend on {providerData.name}</h2>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            <div style={{ marginTop: 10 }}>
              <Sparkline values={trendValues} width={400} height={60} />
            </div>
            <div style={{ fontSize: 12, marginTop: 8 }}>
              Tracking minimum on-demand price over 90 days. Data is refreshed regularly from
              {providerData.name}.
            </div>
          </div>
        </div>
      ) : null}

      {/* Instance Details */}
      {hasPricing ? (
        <div className="card" style={{ marginTop: 18, padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Instance Pricing</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                    Instance Type
                  </th>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                    On-demand
                  </th>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                    Spot
                  </th>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                    Specs
                  </th>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody>
                {providerPrices.map((price) => {
                  const networkBits: string[] = [];
                  if (price.instance.hasNvlink) networkBits.push("NVLink");
                  if (price.instance.hasInfiniband) {
                    networkBits.push(
                      price.instance.infinibandBandwidthGbps
                        ? `InfiniBand ${price.instance.infinibandBandwidthGbps}Gbps`
                        : "InfiniBand",
                    );
                  }
                  if (price.instance.networkBandwidthGbps != null)
                    networkBits.push(`${price.instance.networkBandwidthGbps}Gbps net`);

                  return (
                    <tr key={price.instance.instanceType}>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                        <div style={{ fontWeight: 700 }}>{price.instance.instanceType}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {price.instance.gpuCount}× {gpuData.short_name}
                        </div>
                      </td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                        {price.onDemand !== null ? `$${price.onDemand.toFixed(2)}/hr` : "—"}
                      </td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                        {price.spot !== null ? `$${price.spot.toFixed(2)}/hr` : "—"}
                      </td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                        <div className="muted" style={{ fontSize: 13 }}>
                          {price.instance.vcpuCount ? `${price.instance.vcpuCount} vCPU` : null}
                          {price.instance.ramGb ? ` · ${price.instance.ramGb}GB RAM` : null}
                        </div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {networkBits.length > 0 ? networkBits.join(" · ") : "Standard networking"}
                        </div>
                      </td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                        <span className="muted" style={{ fontSize: 13 }}>
                          {formatRelativeTime(price.lastUpdated)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 18, padding: 18 }}>
          <p className="muted">
            No current pricing data for {gpuData.name} on {providerData.name}. This GPU may not be
            available from this provider, or pricing data may not have been scraped recently.
          </p>
          <div style={{ marginTop: 12 }}>
            <Link className="btn" href={`/cloud-gpu/${canonicalGpu}`}>
              View all providers for {gpuData.name}
            </Link>
          </div>
        </div>
      )}

      {/* Alternative Providers */}
      {cheapestProvider && cheapestProvider.provider.slug !== normalizedProvider ? (
        <div className="card" style={{ marginTop: 18, padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Alternative Providers</h2>
          <p className="muted" style={{ marginTop: 6, lineHeight: 1.7 }}>
            Other cloud providers offering {gpuData.name}:
          </p>
          <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
            {compare.prices
              .filter((p) => p.provider.slug !== normalizedProvider)
              .slice(0, 6)
              .map((p) => (
                <Link
                  key={p.provider.slug}
                  href={`/${p.provider.slug}/${canonicalGpu}`}
                  className="card"
                  style={{ padding: 12, textDecoration: "none", minWidth: 160 }}
                >
                  <div style={{ fontWeight: 700 }}>{p.provider.name}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    from {p.onDemand !== null ? `$${p.onDemand.toFixed(2)}/hr` : "check pricing"}
                  </div>
                </Link>
              ))}
          </div>
        </div>
      ) : null}

      {/* Other GPUs on this Provider */}
      {sortedOtherGpus.length > 0 ? (
        <div className="card" style={{ marginTop: 18, padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Other GPUs on {providerData.name}</h2>
          <p className="muted" style={{ marginTop: 6, lineHeight: 1.7 }}>
            Explore more GPU options available on {providerData.name}:
          </p>
          <div className="grid grid3" style={{ gap: 12, marginTop: 12 }}>
            {sortedOtherGpus.slice(0, 9).map((g) => (
              <Link
                key={g.gpuSlug}
                href={`/${normalizedProvider}/${seoGpuSlug(g.gpuSlug)}`}
                className="card"
                style={{ padding: 14, textDecoration: "none" }}
              >
                <div style={{ fontWeight: 700 }}>{g.gpuShortName}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {g.gpuVramGb}GB · From ${g.minPrice.toFixed(2)}/hr
                </div>
              </Link>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <Link className="btn btnSecondary" href={`/provider/${normalizedProvider}`}>
              View all {providerData.name} GPUs
            </Link>
          </div>
        </div>
      ) : null}

      {/* About */}
      <div className="grid grid2" style={{ marginTop: 18 }}>
        <section className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>About {providerData.name}</h2>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            <p style={{ marginTop: 0 }}>
              <strong>Type:</strong> {providerData.provider_type}
            </p>
            <p>
              <strong>Reliability Tier:</strong> {providerData.reliability_tier}
            </p>
            <p>
              <strong>SLA:</strong>{" "}
              {providerData.sla_uptime_percent
                ? `${providerData.sla_uptime_percent}% uptime`
                : "Not published"}
            </p>
            <p>
              <strong>Regions:</strong> {providerData.available_regions?.length ?? 0}+ regions
              available
            </p>
            <p style={{ marginBottom: 0 }}>
              <strong>API:</strong>{" "}
              {providerData.has_public_api ? "Public API available" : "Check documentation"}
            </p>
          </div>
        </section>

        <section className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>About {gpuData.name}</h2>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            <p style={{ marginTop: 0 }}>
              <strong>Architecture:</strong> {gpuData.architecture}
            </p>
            <p>
              <strong>VRAM:</strong> {gpuData.vram_gb} GB {gpuData.memory_type}
            </p>
            {gpuData.memory_bandwidth_gbps ? (
              <p>
                <strong>Memory Bandwidth:</strong> {gpuData.memory_bandwidth_gbps} GB/s
              </p>
            ) : null}
            {gpuData.tdp_watts ? (
              <p>
                <strong>TDP:</strong> {gpuData.tdp_watts}W
              </p>
            ) : null}
            {gpuData.generation_year ? (
              <p style={{ marginBottom: 0 }}>
                <strong>Generation:</strong> {gpuData.generation_year}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>FAQ</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {faqSchema.mainEntity.map((item: any, i: number) => (
            <div key={i}>
              <div style={{ fontWeight: 800 }}>{item.name}</div>
              <div className="muted" style={{ marginTop: 4, lineHeight: 1.7 }}>
                {item.acceptedAnswer.text}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
