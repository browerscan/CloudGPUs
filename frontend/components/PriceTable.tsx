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
      {/* Quick filters */}
      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <span className="muted text-[13px] font-semibold">Quick filters:</span>
        {quickFilters.map((f) => (
          <button
            key={f.key}
            className={`${activeQuickFilter === f.key ? "btn" : "btn btnSecondary"} text-[13px] py-1.5 px-3`}
            onClick={() => applyQuickFilter(f)}
            type="button"
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Filters card */}
      <div className="card p-3.5 grid gap-3 grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
        <label className="grid gap-1">
          <span className="muted text-xs">Region</span>
          <select
            className="select text-[13px]"
            value={filters.region}
            onChange={(e) => updateFilter("region", e.target.value)}
          >
            <option value="all">All regions</option>
            {allRegions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="muted text-xs">Network Type</span>
          <select
            className="select text-[13px]"
            value={filters.networkType}
            onChange={(e) =>
              updateFilter("networkType", e.target.value as FilterState["networkType"])
            }
          >
            <option value="all">All</option>
            <option value="infiniband">InfiniBand only</option>
            <option value="nvlink">NVLink only</option>
          </select>
        </label>

        <label className="grid gap-1">
          <span className="muted text-xs">Billing Increment</span>
          <select
            className="select text-[13px]"
            value={filters.billingIncrement}
            onChange={(e) =>
              updateFilter("billingIncrement", e.target.value as FilterState["billingIncrement"])
            }
          >
            <option value="all">All</option>
            <option value="per-minute">Per-minute billing</option>
            <option value="per-hour">Per-hour billing</option>
          </select>
        </label>

        <label className="grid gap-1">
          <span className="muted text-xs">Availability</span>
          <select
            className="select text-[13px]"
            value={filters.availability}
            onChange={(e) =>
              updateFilter("availability", e.target.value as FilterState["availability"])
            }
          >
            <option value="all">All</option>
            <option value="available">In stock now</option>
            <option value="limited">Limited/unknown</option>
          </select>
        </label>

        <label className="grid gap-1">
          <span className="muted text-xs">Max Price ($/GPU-hr)</span>
          <input
            className="input text-[13px]"
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
          />
        </label>

        <label className="flex items-center gap-2 pt-[18px] cursor-pointer">
          <input
            type="checkbox"
            checked={filters.showStale}
            onChange={(e) => updateFilter("showStale", e.target.checked)}
            className="m-0"
          />
          <span className="muted text-[13px]">Show stale prices</span>
        </label>

        {hasActiveFilters ? (
          <button
            className="btn btnSecondary text-[13px] py-2.5 px-3 justify-self-start"
            onClick={clearFilters}
            type="button"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {/* Results */}
      <div className="mt-4">
        {filteredRows.length === 0 ? (
          <div className="card p-8 text-center bg-[rgba(15,23,42,0.03)] dark:bg-[rgba(255,255,255,0.03)]">
            <p className="muted m-0">No results match your filters. Try adjusting your criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <caption>
                GPU pricing comparison for {gpuSlug}. Showing {filteredRows.length} of {rows.length}{" "}
                results. Prices shown per GPU per hour. On-demand prices are fixed; spot prices vary
                by market demand.
              </caption>
              <thead>
                <tr className="text-left">
                  <th scope="col" className="p-3 border-b border-[var(--color-border)]">
                    Provider
                  </th>
                  <th scope="col" className="p-3 border-b border-[var(--color-border)]">
                    On-demand
                  </th>
                  <th scope="col" className="p-3 border-b border-[var(--color-border)]">
                    Spot
                  </th>
                  <th scope="col" className="p-3 border-b border-[var(--color-border)]">
                    Details
                  </th>
                  <th scope="col" className="p-3 border-b border-[var(--color-border)]">
                    Updated
                  </th>
                  <th scope="col" className="p-3 border-b border-[var(--color-border)]" />
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
                        ? { label: "Fresh", variant: "success" as const }
                        : updatedAgeHours < 24
                          ? { label: "OK", variant: "neutral" as const }
                          : updatedAgeHours < 48
                            ? { label: "Stale", variant: "warning" as const }
                            : { label: "Very stale", variant: "error" as const };

                  const isCheapest =
                    (row.spot ?? row.onDemand) !== null &&
                    cheapestPrice !== null &&
                    (row.spot ?? row.onDemand) === cheapestPrice;

                  const freshnessStyles = {
                    success: "bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]",
                    neutral: "bg-[rgba(107,114,128,0.12)] text-[rgb(75,85,99)] dark:text-[rgb(156,163,175)] border-[rgba(107,114,128,0.35)]",
                    warning: "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[rgba(251,146,60,0.4)]",
                    error: "bg-[var(--color-error-bg)] text-[var(--color-error)] border-[rgba(239,68,68,0.4)]",
                  };

                  const tierStyles: Record<string, string> = {
                    enterprise: "bg-[rgba(59,130,246,0.12)] text-[rgb(37,99,235)] dark:text-[rgb(96,165,250)] border-[rgba(59,130,246,0.35)]",
                    standard: "bg-[rgba(107,114,128,0.12)] text-[rgb(75,85,99)] dark:text-[rgb(156,163,175)] border-[rgba(107,114,128,0.35)]",
                    community: "bg-[rgba(249,115,22,0.12)] text-[rgb(194,65,12)] dark:text-[rgb(251,146,60)] border-[rgba(249,115,22,0.35)]",
                    depin: "bg-[rgba(249,115,22,0.12)] text-[rgb(194,65,12)] dark:text-[rgb(251,146,60)] border-[rgba(249,115,22,0.35)]",
                  };

                  const tier = row.provider.reliabilityTier.toLowerCase();

                  return (
                    <tr
                      key={row.provider.slug}
                      className={`price-row ${isCheapest ? "cheapest-row" : ""}`}
                    >
                      <td className="p-3 border-b border-[rgba(15,23,42,0.06)] dark:border-[rgba(255,255,255,0.06)]">
                        <div className="font-bold flex items-center flex-wrap">
                          {row.provider.name}
                          {isCheapest && (
                            <span className="inline-block bg-gradient-to-br from-green-500 to-green-600 text-white text-[10px] font-bold py-0.5 px-1.5 rounded ml-2 uppercase tracking-wide">
                              Best Deal
                            </span>
                          )}
                        </div>
                        <div className="text-xs mt-0.5">
                          <span
                            className={`inline-block text-[10px] font-semibold py-0.5 px-1.5 rounded border capitalize ${tierStyles[tier] ?? tierStyles.standard}`}
                          >
                            {row.provider.reliabilityTier}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 border-b border-[rgba(15,23,42,0.06)] dark:border-[rgba(255,255,255,0.06)]">
                        {formatUsdPerHour(row.onDemand)}
                      </td>
                      <td className="p-3 border-b border-[rgba(15,23,42,0.06)] dark:border-[rgba(255,255,255,0.06)]">
                        <div className="flex items-center gap-1.5 flex-wrap">
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
                              <span className="inline-block bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)] text-[10px] font-bold py-0.5 px-[5px] rounded">
                                {savingsPercent}% below avg
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="p-3 border-b border-[rgba(15,23,42,0.06)] dark:border-[rgba(255,255,255,0.06)]">
                        <div className="text-[13px]">
                          <span className="font-bold">{row.instance.instanceType}</span>{" "}
                          <span className="muted">· {row.instance.gpuCount}×GPU</span>
                        </div>
                        <div className="muted text-xs mt-1 leading-relaxed">
                          <div>Network: {networkBits.length ? networkBits.join(" · ") : "—"}</div>
                          <div>Billing: {billingBits.length ? billingBits.join(" · ") : "—"}</div>
                        </div>
                      </td>
                      <td className="p-3 border-b border-[rgba(15,23,42,0.06)] dark:border-[rgba(255,255,255,0.06)]">
                        <div className="flex items-center gap-1.5">
                          {freshness ? (
                            <span
                              className={`badge text-[10px] py-0.5 px-1.5 ${freshnessStyles[freshness.variant]}`}
                            >
                              {freshness.label}
                            </span>
                          ) : null}
                          <span className="muted text-[13px]">
                            {formatRelativeTime(row.lastUpdated)}
                          </span>
                        </div>
                        <div className="muted text-xs mt-1">
                          {new Date(row.lastUpdated).toLocaleString()}
                        </div>
                      </td>
                      <td className="p-3 border-b border-[rgba(15,23,42,0.06)] dark:border-[rgba(255,255,255,0.06)] text-right">
                        <a
                          className={`btn ${isCheapest ? "bg-gradient-to-br from-green-500 to-green-600 border-green-600" : ""}`}
                          href={affiliateClickUrl({ providerSlug: row.provider.slug, gpuSlug })}
                          target="_blank"
                          rel="noopener nofollow"
                        >
                          {isCheapest ? "Get This Deal" : "View offer"}
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            className="ml-1"
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
