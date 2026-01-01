import Link from "next/link";
import { listGpuModels } from "@/lib/api";

const POPULAR_GPUS = [
  { slug: "h100-sxm", name: "H100 SXM" },
  { slug: "a100-80gb", name: "A100 80GB" },
  { slug: "rtx-4090", name: "RTX 4090" },
  { slug: "l40s", name: "L40S" },
  { slug: "rtx-5090", name: "RTX 5090" },
];

export default async function NotFound() {
  let gpus: Array<{ slug: string; name: string }> = POPULAR_GPUS;

  try {
    const list = await listGpuModels();
    gpus = list.docs.slice(0, 6).map((g) => ({
      slug: g.slug,
      name: g.short_name || g.name,
    }));
  } catch {
    // Use fallback on error
  }

  return (
    <div className="container">
      <div className="card" style={{ padding: 48, textAlign: "center" }}>
        <h1 style={{ marginTop: 0, fontSize: 48 }}>404</h1>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>Page not found</h2>
        <p
          className="muted"
          style={{ maxWidth: 480, marginLeft: "auto", marginRight: "auto", lineHeight: 1.7 }}
        >
          The page you are looking for does not exist. It may have been moved or deleted.
        </p>

        <div
          style={{
            marginTop: 24,
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link className="btn" href="/">
            Go to homepage
          </Link>
          <Link className="btn btnSecondary" href="/cloud-gpu">
            Browse all GPUs
          </Link>
        </div>

        <div style={{ marginTop: 40 }}>
          <h3 style={{ fontSize: 16, marginTop: 0, marginBottom: 16 }}>Popular GPUs</h3>
          <div className="grid grid3" style={{ gap: 12 }}>
            {gpus.map((gpu) => (
              <Link
                key={gpu.slug}
                href={`/cloud-gpu/${gpu.slug}`}
                className="card"
                style={{ padding: 14, textDecoration: "none" }}
              >
                <div style={{ fontWeight: 700 }}>{gpu.name}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  View pricing
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--color-border)" }}>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            Looking for something specific? Try our{" "}
            <Link href="/compare" style={{ textDecoration: "underline" }}>
              comparison tool
            </Link>
            ,{" "}
            <Link href="/best-gpu-for" style={{ textDecoration: "underline" }}>
              use case guides
            </Link>
            , or{" "}
            <Link href="/calculator" style={{ textDecoration: "underline" }}>
              calculators
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
