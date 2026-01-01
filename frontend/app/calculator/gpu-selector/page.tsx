import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "GPU selector",
  description:
    "Choose a GPU based on VRAM requirements and budget, then jump to live pricing pages to pick a provider.",
  alternates: { canonical: "/calculator/gpu-selector" },
};

export default function GpuSelectorPage() {
  return (
    <div className="container">
      <div className="card" style={{ padding: 22 }}>
        <h1 style={{ marginTop: 0 }}>GPU selector</h1>
        <p className="muted" style={{ maxWidth: 980, lineHeight: 1.7 }}>
          This page is a lightweight guide-style selector. For a given workload, start by setting a
          VRAM floor (for example: 24GB for many diffusion workflows, 80GB+ for large LLM training).
          Then use pricing pages to compare providers offering that GPU and validate availability in
          your region.
        </p>

        <div className="grid grid3" style={{ marginTop: 14 }}>
          {[
            { label: "16GB+ (budget inference)", href: "/cloud-gpu/t4" },
            { label: "24–32GB (diffusion / fine-tuning)", href: "/cloud-gpu/rtx-5090" },
            { label: "48GB (strong inference)", href: "/cloud-gpu/l40s" },
            { label: "80GB (LLM training)", href: "/cloud-gpu/h100" },
            { label: "141GB (large inference)", href: "/cloud-gpu/h200" },
          ].map((c) => (
            <Link key={c.label} href={c.href} className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 800 }}>{c.label}</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>
                View pricing and providers →
              </div>
            </Link>
          ))}
        </div>

        <section className="card" style={{ marginTop: 18, padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Next steps</h2>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            <div>
              Use case guides: <Link href="/best-gpu-for">best GPU for…</Link>
            </div>
            <div>
              Estimate spend: <Link href="/calculator/cost-estimator">cost estimator</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
