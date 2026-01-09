import type { Metadata } from "next";
import Link from "next/link";
import { USE_CASE_PAGES } from "@/lib/pseo";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Best GPU for common workloads",
  description:
    "Use-case guides that recommend the best GPUs for common AI workloads (LLM training, inference, Stable Diffusion, RAG). Includes live price ranges and provider links.",
  alternates: { canonical: "/best-gpu-for" },
};

export default function UseCaseHubPage() {
  return (
    <div className="container">
      <div className="card" style={{ padding: 22 }}>
        <h1 style={{ marginTop: 0 }}>Best GPU for…</h1>
        <p className="muted" style={{ maxWidth: 900, lineHeight: 1.7 }}>
          These guides combine practical workload requirements (VRAM, architecture, bandwidth) with
          current cloud price ranges. Each page recommends a best overall GPU, a budget option, and
          a best value option, then links you to live pricing so you can pick the best provider.
        </p>
      </div>

      <section style={{ marginTop: 18 }}>
        <h2 style={{ margin: "12px 0" }}>Use cases</h2>
        <div className="grid grid3">
          {USE_CASE_PAGES.map((u) => (
            <Link
              key={u.slug}
              href={`/best-gpu-for/${u.slug}`}
              className="card"
              style={{ padding: 18 }}
            >
              <div style={{ fontWeight: 800 }}>{u.name}</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>
                {u.summary}
                <div>Min VRAM: {u.minVramGb}GB+</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Related tools</h2>
        <div className="muted" style={{ lineHeight: 1.8 }}>
          <div>
            Estimating spend? Use the{" "}
            <Link href="/calculator/cost-estimator">GPU cloud cost estimator</Link>.
          </div>
          <div>
            Want provider choices? Start with <Link href="/provider">provider hub</Link> or{" "}
            <Link href="/compare">compare</Link>.
          </div>
        </div>
      </section>
    </div>
  );
}
