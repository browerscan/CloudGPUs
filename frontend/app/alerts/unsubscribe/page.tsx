import type { Metadata } from "next";
import Link from "next/link";
import { apiGet } from "@/lib/api";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
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
          <p className="muted">This link is missing an unsubscribe token.</p>
          <Link className="btn btnSecondary" href="/">
            Home
          </Link>
        </div>
      </div>
    );
  }

  const result = await apiGet<{ ok: boolean; unsubscribed?: boolean }>(
    `/api/alerts/unsubscribe?token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  ).catch(() => null);

  return (
    <div className="container">
      <div className="card" style={{ padding: 22 }}>
        <h1 style={{ marginTop: 0 }}>Unsubscribe</h1>
        {result?.ok ? (
          <p className="muted" style={{ lineHeight: 1.7 }}>
            You’re unsubscribed. You will no longer receive price alert emails.
          </p>
        ) : (
          <p className="muted" style={{ lineHeight: 1.7 }}>
            This unsubscribe link is invalid or already used.
          </p>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn" href="/cloud-gpu">
            Browse GPUs
          </Link>
          <Link className="btn btnSecondary" href="/">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
