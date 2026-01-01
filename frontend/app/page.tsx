import Link from "next/link";
import { getCheapestToday, listGpuModels } from "@/lib/api";
import { seoGpuSlug } from "@/lib/aliases";

export const revalidate = 300;

// Most searched GPUs based on industry trends
const MOST_SEARCHED_GPUS = ["h100-sxm", "a100-80gb", "rtx-4090", "h200-sxm", "l40s", "rtx-5090"];

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

  return (
    <div className="container">
      <div className="grid grid2" style={{ alignItems: "start" }}>
        <section className="card" style={{ padding: 22 }}>
          <h1 style={{ marginTop: 0, fontSize: 34, letterSpacing: "-0.02em" }}>
            Compare GPU cloud pricing, fast.
          </h1>
          <p className="muted" style={{ fontSize: 16, lineHeight: 1.6 }}>
            CloudGPUs.io aggregates pricing across providers so you can find the best on‑demand and
            spot rates for popular GPUs.
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
    </div>
  );
}
