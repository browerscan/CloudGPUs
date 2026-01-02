"use client";

import { useMemo, useState, useEffect } from "react";
import { affiliateClickUrl } from "@/lib/api";
import { formatRelativeTime, formatUsdPerHour } from "@/lib/format";

function formatIncrement(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

type PriceRow = {
  provider: { slug: string; name: string; reliabilityTier: string; affiliateUrl: string | null };
  instance: {
    instanceType: string;
    gpuCount: number;
    vcpuCount: number | null;
    ramGb: number | null;
    networkBandwidthGbps: number | null;
    hasNvlink: boolean | null;
    hasInfiniband: boolean | null;
    infinibandBandwidthGbps: number | null;
    billingIncrementSeconds: number | null;
    minRentalHours: number | null;
    regions: string[] | null;
  };
  onDemand: number | null;
  spot: number | null;
  availability: string;
  lastUpdated: string;
};

type FilterState = {
  region: string;
  networkType: "all" | "infiniband" | "nvlink";
  billingIncrement: "all" | "per-minute" | "per-hour";
  availability: "all" | "available" | "limited";
  maxPrice: number | "";
  showStale: boolean;
};

const DEFAULT_FILTERS: FilterState = {
  region: "all",
  networkType: "all",
  billingIncrement: "all",
  availability: "all",
  maxPrice: "",
  showStale: false,
};

export function PriceTable({ gpuSlug, rows }: { gpuSlug: string; rows: PriceRow[] }) {
  const [filters, setFilters] = useState<FilterState>(() => {
    if (typeof window === "undefined") return DEFAULT_FILTERS;
    const params = new URLSearchParams(window.location.search);

    // Validate network type
    const networkRaw = params.get("network");
    const validNetworkTypes = ["all", "infiniband", "nvlink"] as const;
    const networkType = validNetworkTypes.includes(networkRaw as (typeof validNetworkTypes)[number])
      ? (networkRaw as FilterState["networkType"])
      : "all";

    // Validate billing increment
    const billingRaw = params.get("billing");
    const validBillingIncrements = ["all", "per-minute", "per-hour"] as const;
    const billingIncrement = validBillingIncrements.includes(
      billingRaw as (typeof validBillingIncrements)[number],
    )
      ? (billingRaw as FilterState["billingIncrement"])
      : "all";

    // Validate availability
    const availabilityRaw = params.get("availability");
    const validAvailability = ["all", "available", "limited"] as const;
    const availability = validAvailability.includes(
      availabilityRaw as (typeof validAvailability)[number],
    )
      ? (availabilityRaw as FilterState["availability"])
      : "all";

    // Validate maxPrice
    const maxPriceParam = params.get("maxPrice");
    const maxPrice: FilterState["maxPrice"] =
      maxPriceParam && !Number.isNaN(Number(maxPriceParam)) && Number(maxPriceParam) >= 0
        ? Number(maxPriceParam)
        : "";

    // Region is freeform text, sanitize by limiting length
    const regionRaw = params.get("region");
    const region = regionRaw && regionRaw.length <= 100 ? regionRaw : "all";

    return {
      region,
      networkType,
      billingIncrement,
      availability,
      maxPrice,
      showStale: params.get("showStale") === "true",
    };
  });

  const allRegions = useMemo(() => {
    const regions = new Set<string>();
    rows.forEach((row) => {
      row.instance.regions?.forEach((r) => regions.add(r));
    });
    return Array.from(regions).sort();
  }, [rows]);

  const quickFilters = [
    { label: "Under $2/hr", key: "under2" as const, maxPrice: 2 },
    { label: "Enterprise tier only", key: "enterprise" as const, tier: "enterprise" },
    { label: "In stock now", key: "available" as const, availability: "available" },
  ];

  const activeQuickFilter = useMemo(() => {
    if (filters.maxPrice === 2) return "under2";
    if (filters.availability === "available") return "available";
    return null;
  }, [filters]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const price = row.spot ?? row.onDemand;
      const updatedAt = new Date(row.lastUpdated).getTime();
      const updatedAgeHours = Number.isFinite(updatedAt)
        ? (Date.now() - updatedAt) / (1000 * 60 * 60)
        : null;
      const isStale = updatedAgeHours != null && updatedAgeHours > 48;

      if (!filters.showStale && isStale) return false;

      if (filters.region !== "all") {
        if (!row.instance.regions?.includes(filters.region)) return false;
      }

      if (filters.networkType === "infiniband" && !row.instance.hasInfiniband) return false;
      if (filters.networkType === "nvlink" && !row.instance.hasNvlink) return false;

      if (filters.billingIncrement === "per-minute") {
        if (!row.instance.billingIncrementSeconds || row.instance.billingIncrementSeconds >= 3600)
          return false;
      }
      if (filters.billingIncrement === "per-hour") {
        if (row.instance.billingIncrementSeconds && row.instance.billingIncrementSeconds < 3600)
          return false;
      }

      if (filters.availability === "available" && row.availability !== "available") return false;
      if (filters.availability === "limited" && row.availability === "available") return false;

      if (filters.maxPrice !== "") {
        const max = Number(filters.maxPrice);
        if (Number.isFinite(max) && price !== null && price > max) return false;
      }

      return true;
    });
  }, [rows, filters]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.region !== "all") params.set("region", filters.region);
    if (filters.networkType !== "all") params.set("network", filters.networkType);
    if (filters.billingIncrement !== "all") params.set("billing", filters.billingIncrement);
    if (filters.availability !== "all") params.set("availability", filters.availability);
    if (filters.maxPrice !== "") params.set("maxPrice", String(filters.maxPrice));
    if (filters.showStale) params.set("showStale", "true");

    const newUrl =
      params.toString() === ""
        ? window.location.pathname
        : `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", newUrl);
  }, [filters]);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applyQuickFilter = (filter: (typeof quickFilters)[number]) => {
    setFilters((prev) => {
      const next: FilterState = { ...prev, maxPrice: "", availability: "all" };
      if (filter.key === "under2") next.maxPrice = filter.maxPrice;
      if (filter.key === "available") next.availability = "available";
      return next;
    });
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const hasActiveFilters =
    filters.region !== "all" ||
    filters.networkType !== "all" ||
    filters.billingIncrement !== "all" ||
    filters.availability !== "all" ||
    filters.maxPrice !== "" ||
    filters.showStale;

  const cheapestPrice = filteredRows.reduce(
    (min, row) => {
      const price = row.spot ?? row.onDemand;
      if (price === null) return min;
      return min === null ? price : Math.min(min, price);
    },
    null as number | null,
  );

  const medianPrice = useMemo((): number | null => {
    const prices = filteredRows
      .map((r) => r.spot ?? r.onDemand)
      .filter((p): p is number => p !== null)
      .sort((a, b) => a - b);
    if (prices.length === 0) return null;
    const mid = Math.floor(prices.length / 2);
    if (prices.length % 2 === 0) {
      const left = prices[mid - 1];
      const right = prices[mid];
      if (left !== undefined && right !== undefined) {
        return (left + right) / 2;
      }
    }
    return prices[mid] ?? null;
  }, [filteredRows]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
          Quick filters:
        </span>
        {quickFilters.map((f) => (
          <button
            key={f.key}
            className={activeQuickFilter === f.key ? "btn" : "btn btnSecondary"}
            onClick={() => applyQuickFilter(f)}
            type="button"
            style={{ fontSize: 13, padding: "6px 12px" }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div
        className="card"
        style={{
          padding: 14,
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        }}
      >
        <label style={{ display: "grid", gap: 4 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            Region
          </span>
          <select
            className="select"
            value={filters.region}
            onChange={(e) => updateFilter("region", e.target.value)}
            style={{ fontSize: 13 }}
          >
            <option value="all">All regions</option>
            {allRegions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            Network Type
          </span>
          <select
            className="select"
            value={filters.networkType}
            onChange={(e) =>
              updateFilter("networkType", e.target.value as FilterState["networkType"])
            }
            style={{ fontSize: 13 }}
          >
            <option value="all">All</option>
            <option value="infiniband">InfiniBand only</option>
            <option value="nvlink">NVLink only</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            Billing Increment
          </span>
          <select
            className="select"
            value={filters.billingIncrement}
            onChange={(e) =>
              updateFilter("billingIncrement", e.target.value as FilterState["billingIncrement"])
            }
            style={{ fontSize: 13 }}
          >
            <option value="all">All</option>
            <option value="per-minute">Per-minute billing</option>
            <option value="per-hour">Per-hour billing</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            Availability
          </span>
          <select
            className="select"
            value={filters.availability}
            onChange={(e) =>
              updateFilter("availability", e.target.value as FilterState["availability"])
            }
            style={{ fontSize: 13 }}
          >
            <option value="all">All</option>
            <option value="available">In stock now</option>
            <option value="limited">Limited/unknown</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            Max Price ($/GPU-hr)
          </span>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            placeholder="No limit"
            value={filters.maxPrice}
            onChange={(e) => {
              const val = e.target.value;
              const num: FilterState["maxPrice"] =
                val === "" ? "" : Number.isNaN(Number(val)) ? "" : Number(val);
              updateFilter("maxPrice", num);
            }}
            style={{ fontSize: 13 }}
          />
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            paddingTop: 18,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={filters.showStale}
            onChange={(e) => updateFilter("showStale", e.target.checked)}
            style={{ margin: 0 }}
          />
          <span className="muted" style={{ fontSize: 13 }}>
            Show stale prices
          </span>
        </label>

        {hasActiveFilters ? (
          <button
            className="btn btnSecondary"
            onClick={clearFilters}
            type="button"
            style={{ fontSize: 13, padding: "10px 12px", justifySelf: "start" }}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div style={{ marginTop: 16 }}>
        {filteredRows.length === 0 ? (
          <div
            className="card"
            style={{ padding: 32, textAlign: "center", background: "rgba(15, 23, 42, 0.03)" }}
          >
            <p className="muted" style={{ margin: 0 }}>
              No results match your filters. Try adjusting your criteria.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <caption>
                GPU pricing comparison for {gpuSlug}. Showing {filteredRows.length} of {rows.length}{" "}
                results. Prices shown per GPU per hour. On-demand prices are fixed; spot prices vary
                by market demand.
              </caption>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th
                    scope="col"
                    style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}
                  >
                    Provider
                  </th>
                  <th
                    scope="col"
                    style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}
                  >
                    On-demand
                  </th>
                  <th
                    scope="col"
                    style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}
                  >
                    Spot
                  </th>
                  <th
                    scope="col"
                    style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}
                  >
                    Details
                  </th>
                  <th
                    scope="col"
                    style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}
                  >
                    Updated
                  </th>
                  <th
                    scope="col"
                    style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}
                  />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const networkBits: string[] = [];
                  if (row.instance.hasNvlink) networkBits.push("NVLink");
                  if (row.instance.hasInfiniband) {
                    networkBits.push(
                      row.instance.infinibandBandwidthGbps
                        ? `InfiniBand ${row.instance.infinibandBandwidthGbps}Gbps`
                        : "InfiniBand",
                    );
                  }
                  if (row.instance.networkBandwidthGbps != null)
                    networkBits.push(`${row.instance.networkBandwidthGbps}Gbps net`);
                  const increment = formatIncrement(row.instance.billingIncrementSeconds);
                  const billingBits: string[] = [];
                  if (row.instance.minRentalHours != null && row.instance.minRentalHours > 1)
                    billingBits.push(`${row.instance.minRentalHours}h min`);
                  if (increment) billingBits.push(`${increment} inc`);

                  const updatedAt = new Date(row.lastUpdated).getTime();
                  const updatedAgeHours = Number.isFinite(updatedAt)
                    ? (Date.now() - updatedAt) / (1000 * 60 * 60)
                    : null;

                  const freshness =
                    updatedAgeHours == null
                      ? null
                      : updatedAgeHours < 6
                        ? { label: "Fresh", color: "rgb(6, 95, 70)" }
                        : updatedAgeHours < 24
                          ? { label: "OK", color: "rgb(120, 113, 108)" }
                          : updatedAgeHours < 48
                            ? { label: "Stale", color: "rgb(180, 83, 9)" }
                            : { label: "Very stale", color: "rgb(185, 28, 28)" };

                  const isCheapest =
                    (row.spot ?? row.onDemand) !== null &&
                    cheapestPrice !== null &&
                    (row.spot ?? row.onDemand) === cheapestPrice;

                  return (
                    <tr
                      key={row.provider.slug}
                      className={`price-row${isCheapest ? " cheapest-row" : ""}`}
                      style={
                        freshness
                          ? {
                              borderLeft: `3px solid ${freshness.color}`,
                            }
                          : undefined
                      }
                    >
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                        <div
                          style={{
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          {row.provider.name}
                          {isCheapest && (
                            <span
                              style={{
                                display: "inline-block",
                                background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                                color: "white",
                                fontSize: 10,
                                fontWeight: 700,
                                padding: "2px 6px",
                                borderRadius: 4,
                                marginLeft: 8,
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                              }}
                            >
                              Best Deal
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, marginTop: 2 }}>
                          {(() => {
                            const tier = row.provider.reliabilityTier.toLowerCase();
                            const tierStyles: Record<
                              string,
                              { bg: string; color: string; border: string }
                            > = {
                              enterprise: {
                                bg: "rgba(59, 130, 246, 0.12)",
                                color: "rgb(37, 99, 235)",
                                border: "rgba(59, 130, 246, 0.35)",
                              },
                              standard: {
                                bg: "rgba(107, 114, 128, 0.12)",
                                color: "rgb(75, 85, 99)",
                                border: "rgba(107, 114, 128, 0.35)",
                              },
                              community: {
                                bg: "rgba(249, 115, 22, 0.12)",
                                color: "rgb(194, 65, 12)",
                                border: "rgba(249, 115, 22, 0.35)",
                              },
                              depin: {
                                bg: "rgba(249, 115, 22, 0.12)",
                                color: "rgb(194, 65, 12)",
                                border: "rgba(249, 115, 22, 0.35)",
                              },
                            };
                            const style = tierStyles[tier] ?? tierStyles.standard;
                            if (!style) return null;
                            return (
                              <span
                                style={{
                                  display: "inline-block",
                                  background: style.bg,
                                  color: style.color,
                                  border: `1px solid ${style.border}`,
                                  fontSize: 10,
                                  fontWeight: 600,
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  textTransform: "capitalize",
                                }}
                              >
                                {row.provider.reliabilityTier}
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                        {formatUsdPerHour(row.onDemand)}
                      </td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            flexWrap: "wrap",
                          }}
                        >
                          {formatUsdPerHour(row.spot)}
                          {(() => {
                            const price = row.spot ?? row.onDemand;
                            if (price === null || medianPrice === null || medianPrice <= 0)
                              return null;
                            const savingsPercent = Math.round(
                              ((medianPrice - price) / medianPrice) * 100,
                            );
                            if (savingsPercent < 15) return null;
                            return (
                              <span
                                style={{
                                  display: "inline-block",
                                  background: "rgba(16, 185, 129, 0.12)",
                                  color: "rgb(6, 95, 70)",
                                  border: "1px solid rgba(16, 185, 129, 0.35)",
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: "2px 5px",
                                  borderRadius: 4,
                                }}
                              >
                                {savingsPercent}% below avg
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                        <div style={{ fontSize: 13 }}>
                          <span style={{ fontWeight: 700 }}>{row.instance.instanceType}</span>{" "}
                          <span className="muted">· {row.instance.gpuCount}×GPU</span>
                        </div>
                        <div
                          className="muted"
                          style={{ fontSize: 12, marginTop: 4, lineHeight: 1.6 }}
                        >
                          <div>Network: {networkBits.length ? networkBits.join(" · ") : "—"}</div>
                          <div>Billing: {billingBits.length ? billingBits.join(" · ") : "—"}</div>
                        </div>
                      </td>
                      <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {freshness ? (
                            <span
                              className="badge"
                              style={{
                                fontSize: 10,
                                padding: "2px 6px",
                                background: `rgba(${
                                  freshness.color === "rgb(6, 95, 70)"
                                    ? "16, 185, 129"
                                    : freshness.color === "rgb(120, 113, 108)"
                                      ? "120, 113, 108"
                                      : freshness.color === "rgb(180, 83, 9)"
                                        ? "251, 146, 60"
                                        : "239, 68, 68"
                                }, 0.15)`,
                                color: freshness.color,
                                borderColor: `rgba(${
                                  freshness.color === "rgb(6, 95, 70)"
                                    ? "16, 185, 129"
                                    : freshness.color === "rgb(120, 113, 108)"
                                      ? "120, 113, 108"
                                      : freshness.color === "rgb(180, 83, 9)"
                                        ? "251, 146, 60"
                                        : "239, 68, 68"
                                }, 0.4)`,
                              }}
                            >
                              {freshness.label}
                            </span>
                          ) : null}
                          <span className="muted" style={{ fontSize: 13 }}>
                            {formatRelativeTime(row.lastUpdated)}
                          </span>
                        </div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {new Date(row.lastUpdated).toLocaleString()}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: 12,
                          borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
                          textAlign: "right",
                        }}
                      >
                        <a
                          className="btn"
                          href={affiliateClickUrl({ providerSlug: row.provider.slug, gpuSlug })}
                          target="_blank"
                          rel="noopener nofollow"
                          style={
                            isCheapest
                              ? {
                                  background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                                  borderColor: "#16a34a",
                                }
                              : undefined
                          }
                        >
                          {isCheapest ? "Get This Deal" : "View offer"}
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            style={{ marginLeft: 4 }}
                          >
                            <path
                              d="M3.5 2.5H9.5V8.5M9.5 2.5L2.5 9.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
