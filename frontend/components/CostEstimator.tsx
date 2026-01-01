"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { env } from "@/lib/env";
import { seoGpuSlug } from "@/lib/aliases";
import { formatUsdPerHour } from "@/lib/format";

type PriceRow = {
  provider: {
    slug: string;
    name: string;
    displayName: string;
    reliabilityTier: string;
    affiliateUrl: string | null;
  };
  onDemand: number | null;
  spot: number | null;
  availability: string;
  lastUpdated: string;
};

type CompareResponse = {
  gpu: {
    slug: string;
    name: string;
    short_name: string;
    vram_gb: number;
    architecture: string;
    memory_type: string;
  };
  prices: PriceRow[];
  stats: { min: number | null; max: number | null; median: number | null; providerCount: number };
  generatedAt: string;
};

export function CostEstimator({
  gpus,
}: {
  gpus: Array<{
    slug: string;
    name: string;
    short_name: string;
    vram_gb: number;
    architecture: string;
  }>;
}) {
  if (gpus.length < 2) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 800 }}>Cost estimator unavailable</div>
        <div className="muted" style={{ marginTop: 8, lineHeight: 1.7 }}>
          We couldn’t load the GPU catalog. Configure <code>NEXT_PUBLIC_API_BASE_URL</code> and
          ensure the API is reachable, then refresh.
        </div>
      </div>
    );
  }

  const [gpuSlug, setGpuSlug] = useState(gpus[0]?.slug ?? "h100");
  const [tier, setTier] = useState<string>("");
  const [useSpot, setUseSpot] = useState(true);
  const [gpuCount, setGpuCount] = useState(1);
  const [hours, setHours] = useState(8);
  const [utilization, setUtilization] = useState(0.7);
  const [providerChoice, setProviderChoice] = useState<string>("cheapest");
  const [data, setData] = useState<CompareResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setStatus("loading");
      try {
        const url = new URL("/api/compare-prices", env.apiBaseUrl);
        url.searchParams.set("gpuSlug", gpuSlug);
        url.searchParams.set("includeSpot", "true");
        if (tier) url.searchParams.set("tier", tier);
        const res = await fetch(url.toString(), { headers: { accept: "application/json" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as CompareResponse;
        if (cancelled) return;
        setData(json);
        setStatus("idle");
      } catch {
        if (cancelled) return;
        setData(null);
        setStatus("error");
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [gpuSlug, tier]);

  const selected = useMemo(() => {
    if (!data) return null;
    const rows = data.prices;
    const priceOf = (r: PriceRow) => {
      const spot = useSpot ? r.spot : null;
      return spot ?? r.onDemand ?? null;
    };

    if (providerChoice === "cheapest") {
      let best: PriceRow | null = null;
      let bestPrice: number | null = null;
      for (const r of rows) {
        const v = priceOf(r);
        if (v == null || !Number.isFinite(v)) continue;
        if (bestPrice == null || v < bestPrice) {
          bestPrice = v;
          best = r;
        }
      }
      return best ? { row: best, price: bestPrice } : null;
    }

    const found = rows.find((r) => r.provider.slug === providerChoice) ?? null;
    return found ? { row: found, price: priceOf(found) } : null;
  }, [data, providerChoice, useSpot]);

  const total = useMemo(() => {
    if (!selected?.price) return null;
    if (!Number.isFinite(hours) || hours <= 0) return null;
    if (!Number.isFinite(gpuCount) || gpuCount <= 0) return null;
    return selected.price * gpuCount * hours;
  }, [selected, gpuCount, hours]);

  const monthly = useMemo(() => {
    if (!selected?.price) return null;
    if (!Number.isFinite(utilization) || utilization < 0 || utilization > 1) return null;
    if (!Number.isFinite(gpuCount) || gpuCount <= 0) return null;
    return selected.price * gpuCount * 24 * 30 * utilization;
  }, [selected, gpuCount, utilization]);

  return (
    <div className="grid grid2" style={{ alignItems: "start" }}>
      <section className="card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 800 }}>Inputs</div>
        <div className="muted" style={{ marginTop: 6, lineHeight: 1.6, fontSize: 13 }}>
          Pick a GPU, optionally filter by provider tier, and choose whether to use spot pricing
          when available.
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              GPU
            </span>
            <select
              value={gpuSlug}
              onChange={(e) => setGpuSlug(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(15, 23, 42, 0.12)",
              }}
            >
              {gpus.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.name} ({g.vram_gb}GB)
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid2" style={{ gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="muted" style={{ fontSize: 13 }}>
                Provider tier
              </span>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(15, 23, 42, 0.12)",
                }}
              >
                <option value="">All tiers</option>
                <option value="enterprise">Enterprise</option>
                <option value="standard">Standard</option>
                <option value="community">Community</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span className="muted" style={{ fontSize: 13 }}>
                Provider
              </span>
              <select
                value={providerChoice}
                onChange={(e) => setProviderChoice(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(15, 23, 42, 0.12)",
                }}
              >
                <option value="cheapest">Cheapest (auto)</option>
                {(data?.prices ?? []).map((r) => (
                  <option key={r.provider.slug} value={r.provider.slug}>
                    {r.provider.name} · {formatUsdPerHour((useSpot ? r.spot : null) ?? r.onDemand)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={useSpot}
              onChange={(e) => setUseSpot(e.target.checked)}
            />
            <span className="muted" style={{ fontSize: 13 }}>
              Use spot/preemptible price when available
            </span>
          </label>

          <div className="grid grid2" style={{ gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="muted" style={{ fontSize: 13 }}>
                GPU count
              </span>
              <input
                value={gpuCount}
                onChange={(e) => setGpuCount(Number(e.target.value))}
                inputMode="numeric"
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(15, 23, 42, 0.12)",
                }}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="muted" style={{ fontSize: 13 }}>
                Runtime (hours)
              </span>
              <input
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                inputMode="decimal"
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(15, 23, 42, 0.12)",
                }}
              />
            </label>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              Monthly utilization (0–1)
            </span>
            <input
              value={utilization}
              onChange={(e) => setUtilization(Number(e.target.value))}
              inputMode="decimal"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(15, 23, 42, 0.12)",
              }}
            />
          </label>
        </div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 800 }}>Estimate</div>
        <div className="muted" style={{ marginTop: 6, lineHeight: 1.6, fontSize: 13 }}>
          This is an estimate based on the selected hourly price. Always verify billing increments,
          minimum rental time, and add‑ons such as storage and egress.
        </div>

        {status === "loading" ? (
          <div className="muted" style={{ marginTop: 12 }}>
            Loading pricing…
          </div>
        ) : status === "error" ? (
          <div className="muted" style={{ marginTop: 12 }}>
            Could not load pricing data. Check `NEXT_PUBLIC_API_BASE_URL` and try again.
          </div>
        ) : null}

        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Selected price
            </div>
            <div style={{ fontWeight: 800, marginTop: 6 }}>
              {formatUsdPerHour(selected?.price ?? null)}
            </div>
            <div className="muted" style={{ marginTop: 8, lineHeight: 1.7, fontSize: 13 }}>
              <div>Provider: {selected?.row.provider.name ?? "—"}</div>
              <div>Availability: {selected?.row.availability ?? "—"}</div>
              <div>
                Updated:{" "}
                {selected?.row.lastUpdated
                  ? new Date(selected.row.lastUpdated).toLocaleString()
                  : "—"}
              </div>
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="btn btnSecondary" href={`/cloud-gpu/${seoGpuSlug(gpuSlug)}`}>
                GPU pricing page
              </Link>
              {selected?.row.provider.slug ? (
                <Link className="btn btnSecondary" href={`/provider/${selected.row.provider.slug}`}>
                  Provider page
                </Link>
              ) : null}
            </div>
          </div>

          <div className="grid grid2">
            <div className="card" style={{ padding: 14 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                Training run (hours)
              </div>
              <div style={{ fontWeight: 800, marginTop: 6 }}>
                {total != null ? `$${total.toFixed(2)}` : "—"}
              </div>
              <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                total = $/GPU‑hr × gpu_count × hours
              </div>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                Monthly (utilization)
              </div>
              <div style={{ fontWeight: 800, marginTop: 6 }}>
                {monthly != null ? `$${monthly.toFixed(2)}` : "—"}
              </div>
              <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                monthly = $/GPU‑hr × gpu_count × 24 × 30 × utilization
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
