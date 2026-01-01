"use client";

import { useEffect, useState } from "react";
import { type ReactElement } from "react";
import { env } from "@/lib/env";

type GpuStats = {
  viewsLast7Days: number;
  mostPopularProvider: string | null;
  clickCountLast7Days: number;
};

export function SocialProof({ gpuSlug, gpuName }: { gpuSlug: string; gpuName: string }) {
  const [stats, setStats] = useState<GpuStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${env.apiBaseUrl}/api/gpu-models/${encodeURIComponent(gpuSlug)}/stats`)
      .then((res) => (res.ok ? (res.json() as Promise<GpuStats>) : null))
      .then((data) => {
        if (data) setStats(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [gpuSlug]);

  if (loading) {
    return (
      <div
        style={{
          padding: "12px 16px",
          background: "rgba(15, 23, 42, 0.03)",
          borderRadius: 10,
          display: "flex",
          gap: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div className="muted" style={{ fontSize: 13 }}>
          Loading stats...
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const badges: ReactElement[] = [];

  if (stats.viewsLast7Days > 10) {
    badges.push(
      <span
        key="views"
        className="badge"
        style={{
          background: "rgba(59, 130, 246, 0.12)",
          color: "rgb(30, 64, 175)",
          borderColor: "rgba(59, 130, 246, 0.3)",
        }}
      >
        {stats.viewsLast7Days.toLocaleString()} users viewed this GPU in the last 7 days
      </span>,
    );
  }

  if (stats.mostPopularProvider) {
    badges.push(
      <span
        key="popular"
        className="badge badgeGreen"
        style={{
          background: "rgba(16, 185, 129, 0.12)",
          color: "rgb(6, 95, 70)",
          borderColor: "rgba(16, 185, 129, 0.35)",
        }}
      >
        Most popular provider: {stats.mostPopularProvider}
      </span>,
    );
  }

  if (badges.length === 0) return null;

  return (
    <div
      style={{
        padding: "12px 16px",
        background: "rgba(15, 23, 42, 0.03)",
        borderRadius: 10,
        display: "flex",
        gap: 12,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
        Trending:
      </span>
      {badges}
    </div>
  );
}
