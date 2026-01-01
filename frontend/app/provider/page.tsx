import type { Metadata } from "next";
import Link from "next/link";
import { listProviders } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "GPU cloud providers",
  description:
    "Browse GPU cloud providers and compare their pricing, reliability tiers, regions, and API features. Find enterprise, marketplace, and DePIN options.",
  alternates: { canonical: "/provider" },
};

const PROVIDER_TYPES: Array<{ value: string; label: string }> = [
  { value: "specialized_neocloud", label: "Specialized neocloud" },
  { value: "hyperscaler", label: "Hyperscaler" },
  { value: "regional_cloud", label: "Regional cloud" },
  { value: "marketplace", label: "Marketplace" },
  { value: "depin", label: "DePIN" },
  { value: "bare_metal", label: "Bare metal" },
];

const TIERS: Array<{ value: string; label: string }> = [
  { value: "enterprise", label: "Enterprise" },
  { value: "standard", label: "Standard" },
  { value: "community", label: "Community" },
];

export default async function ProviderHubPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const type = typeof params.type === "string" ? params.type.trim() : "";
  const tier = typeof params.tier === "string" ? params.tier.trim() : "";

  const res = await listProviders().catch(() => null);
  const apiOk = res != null;
  const filtered = (res?.docs ?? []).filter((p) => {
    const haystack = `${p.name} ${p.slug} ${p.provider_type} ${p.reliability_tier}`.toLowerCase();
    if (q && !haystack.includes(q)) return false;
    if (type && p.provider_type !== type) return false;
    if (tier && p.reliability_tier !== tier) return false;
    return true;
  });

  return (
    <div className="container">
      <div className="card" style={{ padding: 22 }}>
        <h1 style={{ marginTop: 0 }}>GPU cloud providers</h1>
        <p className="muted" style={{ maxWidth: 900, lineHeight: 1.7 }}>
          CloudGPUs.io tracks pricing across specialized AI clouds, marketplaces, and DePIN
          networks. Use this hub to filter providers by business model and reliability tier, then
          click through to see available GPUs, on‑demand vs spot pricing, API links, and user
          reviews. For budget‑sensitive workloads, marketplaces and DePIN can be attractive — but
          verify interruption risk and stability before running long training jobs.
        </p>

        <form style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search providers (e.g., lambda, runpod, nebius)"
            style={{
              flex: "1 1 320px",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(15, 23, 42, 0.12)",
            }}
          />
          <select
            name="type"
            defaultValue={type}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(15, 23, 42, 0.12)",
            }}
          >
            <option value="">All types</option>
            {PROVIDER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            name="tier"
            defaultValue={tier}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(15, 23, 42, 0.12)",
            }}
          >
            <option value="">All tiers</option>
            {TIERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <button className="btn" type="submit">
            Filter
          </button>
          {q || type || tier ? (
            <Link className="btn btnSecondary" href="/provider">
              Clear
            </Link>
          ) : null}
        </form>
      </div>

      <section style={{ marginTop: 18 }}>
        <h2 style={{ margin: "12px 0" }}>Providers</h2>
        <div className="grid grid3">
          {filtered.map((p) => (
            <Link
              key={p.slug}
              href={`/provider/${p.slug}`}
              className="card"
              style={{ padding: 18 }}
            >
              <div style={{ fontWeight: 800 }}>{p.name}</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>
                {p.provider_type} · {p.reliability_tier}
                {p.last_price_update ? (
                  <div>Updated: {new Date(p.last_price_update).toLocaleDateString()}</div>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
        {!filtered.length ? (
          <div className="card muted" style={{ marginTop: 14, padding: 18, lineHeight: 1.7 }}>
            {apiOk ? (
              <>
                No matching providers. Try clearing filters or searching by slug (for example:{" "}
                <code>lambda-labs</code>, <code>vast-ai</code>).
              </>
            ) : (
              <>
                Provider catalog is unavailable. Configure <code>NEXT_PUBLIC_API_BASE_URL</code> and
                try again.
              </>
            )}
          </div>
        ) : null}
      </section>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Related pages</h2>
        <div className="muted" style={{ lineHeight: 1.8 }}>
          <div>
            Looking for a specific GPU? Browse{" "}
            <Link href="/cloud-gpu">cloud GPU pricing pages</Link>.
          </div>
          <div>
            Want a head‑to‑head verdict? Try <Link href="/compare">provider comparisons</Link>.
          </div>
          <div>
            Planning a workload? Start with{" "}
            <Link href="/best-gpu-for">best GPU for common use cases</Link>.
          </div>
        </div>
      </section>
    </div>
  );
}
