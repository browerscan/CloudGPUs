import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { apiGet } from "@/lib/api";
import { seoGpuSlug } from "@/lib/aliases";
import { formatRelativeTime, formatUsdPerHour } from "@/lib/format";
import { REGION_PAGES } from "@/lib/pseo";

export const revalidate = 3600;

export async function generateStaticParams() {
  return REGION_PAGES.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const region = REGION_PAGES.find((r) => r.slug === slug);
  if (!region) return { title: "Region" };
  return {
    title: `GPU cloud pricing in ${region.name} (${new Date().getFullYear()})`,
    description: `Find GPU cloud providers with capacity in ${region.name}. Browse cheapest offers and jump to provider and GPU pages.`,
    alternates: { canonical: `/region/${region.slug}` },
  };
}

export default async function RegionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const region = REGION_PAGES.find((r) => r.slug === slug);
  if (!region) notFound();

  const instances = await apiGet<{
    docs: Array<{
      id: string;
      price_per_gpu_hour: string;
      price_per_hour_spot: string | null;
      gpu_count: number;
      availability_status: string;
      last_scraped_at: string;
      provider_slug?: string;
      provider_name?: string;
      gpu_slug?: string;
      gpu_name?: string;
      gpu_vram_gb?: number;
    }>;
  }>(
    `/api/instances?limit=80&depth=1&where[is_active][equals]=true&region=${encodeURIComponent(region.slug)}&sort=price_per_gpu_hour`,
    { next: { revalidate: 300 } },
  ).catch(() => ({ docs: [] }));

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://cloudgpus.io/" },
      { "@type": "ListItem", position: 2, name: "Regions", item: "https://cloudgpus.io/region" },
      {
        "@type": "ListItem",
        position: 3,
        name: region.name,
        item: `https://cloudgpus.io/region/${region.slug}`,
      },
    ],
  };

  return (
    <div className="container">
      <JsonLd data={breadcrumbSchema} />

      <div className="card" style={{ padding: 22 }}>
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}
        >
          <div>
            <h1 style={{ marginTop: 0 }}>{region.name} GPU cloud pricing</h1>
            <p className="muted" style={{ maxWidth: 920, lineHeight: 1.7 }}>
              This page highlights the cheapest observed GPU offers that advertise availability in{" "}
              <strong>{region.name}</strong>. For training and production workloads, also validate
              data residency needs, egress pricing, and the reliability tier of each provider.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Link className="btn btnSecondary" href="/region">
              All regions
            </Link>
            <Link className="btn" href="/provider">
              Providers
            </Link>
          </div>
        </div>

        <section style={{ marginTop: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Cheapest offers (sample)</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                    GPU
                  </th>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                    Provider
                  </th>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                    On‑demand
                  </th>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                    Spot
                  </th>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody>
                {instances.docs.map((i) => {
                  const onDemand = Number(i.price_per_gpu_hour);
                  const spot = i.price_per_hour_spot
                    ? Number(i.price_per_hour_spot) / Math.max(1, i.gpu_count)
                    : null;
                  return (
                    <tr key={i.id}>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                        {i.gpu_slug ? (
                          <Link
                            href={`/cloud-gpu/${seoGpuSlug(i.gpu_slug)}`}
                            style={{ fontWeight: 700 }}
                          >
                            {i.gpu_name ?? i.gpu_slug}
                          </Link>
                        ) : (
                          <span style={{ fontWeight: 700 }}>{i.gpu_name ?? "GPU"}</span>
                        )}
                        <div className="muted" style={{ fontSize: 12 }}>
                          {i.gpu_vram_gb ? `${i.gpu_vram_gb}GB` : null}{" "}
                          {i.availability_status ? `· ${i.availability_status}` : null}
                        </div>
                      </td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                        {i.provider_slug ? (
                          <Link
                            href={`/provider/${i.provider_slug}`}
                            style={{ textDecoration: "underline" }}
                          >
                            {i.provider_name ?? i.provider_slug}
                          </Link>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                        {formatUsdPerHour(Number.isFinite(onDemand) ? onDemand : null)}
                      </td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                        {formatUsdPerHour(spot)}
                      </td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                        <span className="muted" style={{ fontSize: 13 }}>
                          {formatRelativeTime(i.last_scraped_at)} ·{" "}
                          {new Date(i.last_scraped_at).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!instances.docs.length ? (
                  <tr>
                    <td colSpan={5} className="muted" style={{ padding: 12 }}>
                      No pricing rows for this region tag yet. If your providers use different
                      region labels (e.g. <code>eu-west</code>), update the provider metadata and
                      scraping normalization.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card" style={{ marginTop: 18, padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Region checklist</h2>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            <div>• Compliance: data residency requirements (EU/EEA, HIPAA, etc.).</div>
            <div>• Latency: inference endpoints close to users reduce tail latency.</div>
            <div>• Egress: large datasets and checkpoints can make egress costs material.</div>
            <div>• Availability: some GPUs are limited to specific regions.</div>
          </div>
        </section>
      </div>
    </div>
  );
}
