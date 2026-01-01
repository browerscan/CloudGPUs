import type { Metadata } from "next";
import Link from "next/link";
import { listGpuModels } from "@/lib/api";
import { seoGpuSlug } from "@/lib/aliases";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cloud GPU pricing pages",
  description:
    "Browse GPU model pricing pages (H100, H200, B200, RTX 5090, L40S) and compare on-demand and spot rates across providers.",
  alternates: { canonical: "/cloud-gpu" },
};

export default async function CloudGpuIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const res = await listGpuModels().catch(() => null);
  const apiOk = res != null;

  const filtered = (() => {
    const docs = res?.docs ?? [];
    return q
      ? docs.filter((g) => `${g.name} ${g.slug} ${g.short_name}`.toLowerCase().includes(q))
      : docs;
  })();

  return (
    <div className="container">
      <div className="card" style={{ padding: 22 }}>
        <h1 style={{ marginTop: 0 }}>Cloud GPU pricing</h1>
        <p className="muted" style={{ maxWidth: 820, lineHeight: 1.7 }}>
          Use these pages to compare hourly GPU pricing across providers. Each page aggregates the
          latest observed on‑demand and (when available) spot pricing, with affiliate links to help
          you deploy faster.
        </p>

        <form style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search GPUs (e.g., h100, rtx 5090, l40s)"
            style={{
              flex: "1 1 360px",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(15, 23, 42, 0.12)",
            }}
          />
          <button className="btn" type="submit">
            Search
          </button>
          {q ? (
            <Link className="btn btnSecondary" href="/cloud-gpu">
              Clear
            </Link>
          ) : null}
        </form>
      </div>

      <section style={{ marginTop: 18 }}>
        <h2 style={{ margin: "12px 0" }}>GPU model pages</h2>
        <div className="grid grid3">
          {filtered.map((gpu) => (
            <Link
              key={gpu.slug}
              href={`/cloud-gpu/${seoGpuSlug(gpu.slug)}`}
              className="card"
              style={{ padding: 18 }}
            >
              <div style={{ fontWeight: 800 }}>{gpu.name}</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                {gpu.vram_gb}GB · {gpu.architecture} · {gpu.slug}
              </div>
            </Link>
          ))}
          {!filtered.length ? (
            apiOk ? (
              <div className="card muted" style={{ padding: 18, lineHeight: 1.7 }}>
                {q ? (
                  <>
                    No GPUs matched <code>{q}</code>. Try searching by slug (for example:{" "}
                    <code>h100-sxm</code>, <code>rtx-5090</code>).
                  </>
                ) : (
                  <>No GPUs in the catalog yet.</>
                )}
              </div>
            ) : (
              <div className="card muted" style={{ padding: 18, lineHeight: 1.7 }}>
                GPU catalog is unavailable. Configure <code>NEXT_PUBLIC_API_BASE_URL</code> and try
                again.
              </div>
            )
          ) : null}
        </div>
      </section>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Next steps</h2>
        <div className="muted" style={{ lineHeight: 1.8 }}>
          <div>
            New to the ecosystem? Start with{" "}
            <Link href="/best-gpu-for">best GPUs for common workloads</Link>.
          </div>
          <div>
            Comparing providers? Try <Link href="/compare">provider vs provider comparisons</Link>.
          </div>
          <div>
            Estimating spend? Use the{" "}
            <Link href="/calculator/cost-estimator">GPU cloud cost calculator</Link>.
          </div>
        </div>
      </section>
    </div>
  );
}
