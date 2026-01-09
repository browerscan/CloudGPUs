import { ImageResponse } from "next/og";

export const revalidate = 1800;

type ComparePricesResponse = {
  gpu: { slug: string; name: string; short_name: string };
  stats: { min: number | null; providerCount: number };
  generatedAt: string;
};

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let title = `CloudGPUs.io`;
  let headline = `${slug.toUpperCase()} pricing`;
  let subline = "Compare GPU cloud prices across providers.";
  let priceLine = "Live pricing varies by provider.";

  try {
    const apiBaseUrl = "https://api.cloudgpus.io";
    const url = new URL("/api/compare-prices", apiBaseUrl);
    url.searchParams.set("gpuSlug", slug);
    url.searchParams.set("includeSpot", "true");

    const res = await fetch(url.toString(), {
      headers: { accept: "application/json" },
      next: { revalidate: 1800 },
    });
    if (res.ok) {
      const data = (await res.json()) as ComparePricesResponse;
      headline = `${data.gpu.name} pricing`;
      title = `${data.gpu.short_name} pricing · CloudGPUs.io`;
      subline = `Providers tracked: ${data.stats.providerCount} · Updated ${new Date(data.generatedAt).toLocaleString()}`;
      priceLine =
        data.stats.min != null
          ? `From ~$${data.stats.min.toFixed(2)}/GPU‑hr`
          : "Live pricing varies by provider.";
    }
  } catch {
    // Best-effort; return a generic OG image if the API is unavailable.
  }

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 56,
        background: "linear-gradient(135deg, #0b1220 0%, #111827 55%, #0b1220 100%)",
        color: "#fff",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 800, fontSize: 28, letterSpacing: "-0.02em" }}>{title}</div>
        <div style={{ fontSize: 18, opacity: 0.8 }}>cloudgpus.io</div>
      </div>

      <div>
        <div style={{ fontSize: 66, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          {headline}
        </div>
        <div style={{ marginTop: 18, fontSize: 30, opacity: 0.92 }}>{priceLine}</div>
        <div style={{ marginTop: 14, fontSize: 20, opacity: 0.75, maxWidth: 980 }}>{subline}</div>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {[
          { label: "On-demand + spot", tone: "rgba(255,255,255,0.14)" },
          { label: "Reliability tiers", tone: "rgba(16,185,129,0.18)" },
          { label: "CSV export", tone: "rgba(59,130,246,0.18)" },
        ].map((tag) => (
          <div
            key={tag.label}
            style={{
              padding: "10px 14px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.18)",
              background: tag.tone,
              fontSize: 18,
            }}
          >
            {tag.label}
          </div>
        ))}
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
