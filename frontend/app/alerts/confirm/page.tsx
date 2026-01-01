import type { Metadata } from "next";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { seoGpuSlug } from "@/lib/aliases";

export const metadata: Metadata = {
  title: "Confirm price alert",
  robots: { index: false, follow: false },
};

export default async function ConfirmAlertPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  if (!token) {
    return (
      <div className="container">
        <div className="card" style={{ padding: 22 }}>
          <h1 style={{ marginTop: 0 }}>Missing token</h1>
          <p className="muted">This link is missing a confirmation token.</p>
          <Link className="btn btnSecondary" href="/">
            Home
          </Link>
        </div>
      </div>
    );
  }

  const result = await apiGet<{ ok: boolean; confirmed: boolean; gpuSlug?: string }>(
    `/api/alerts/confirm?token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  ).catch(() => null);

  return (
    <div className="container">
      <div className="card" style={{ padding: 22 }}>
        <h1 style={{ marginTop: 0 }}>Price alert confirmation</h1>
        {result?.ok ? (
          <p className="muted" style={{ lineHeight: 1.7 }}>
            Your alert is confirmed. We’ll email you when the target price is reached.
          </p>
        ) : (
          <p className="muted" style={{ lineHeight: 1.7 }}>
            This confirmation link is invalid or expired.
          </p>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {result?.gpuSlug ? (
            <Link className="btn" href={`/cloud-gpu/${seoGpuSlug(result.gpuSlug)}`}>
              View GPU pricing
            </Link>
          ) : null}
          <Link className="btn btnSecondary" href="/cloud-gpu">
            Browse GPUs
          </Link>
        </div>
      </div>
    </div>
  );
}
