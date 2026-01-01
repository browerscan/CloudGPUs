"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

type Option = { slug: string; name: string };

function canonicalCompareSlug(a: string, b: string) {
  const [x, y] = [a, b].sort();
  return `${x}-vs-${y}`;
}

export function CompareBuilder({ providers, gpus }: { providers: Option[]; gpus: Option[] }) {
  const router = useRouter();
  const initialMode: "providers" | "gpus" =
    providers.length >= 2 ? "providers" : gpus.length >= 2 ? "gpus" : "providers";
  const [mode, setMode] = useState<"providers" | "gpus">(initialMode);
  const options = mode === "providers" ? providers : gpus;

  const [a, setA] = useState(options[0]?.slug ?? "");
  const [b, setB] = useState(options[1]?.slug ?? "");

  const valid = useMemo(() => a && b && a !== b, [a, b]);

  function onChangeMode(next: "providers" | "gpus") {
    setMode(next);
    const list = next === "providers" ? providers : gpus;
    if (list.length < 2) return;
    setA(list[0]?.slug ?? "");
    setB(list[1]?.slug ?? "");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    router.push(`/compare/${canonicalCompareSlug(a, b)}`);
  }

  if (providers.length < 2 && gpus.length < 2) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 800 }}>Comparison builder unavailable</div>
        <div className="muted" style={{ marginTop: 8, lineHeight: 1.7 }}>
          We couldn’t load provider/GPU catalogs from the API. Configure{" "}
          <code>NEXT_PUBLIC_API_BASE_URL</code> and refresh.
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ padding: 16 }}>
      <div style={{ fontWeight: 800 }}>Build a comparison</div>
      <div className="muted" style={{ marginTop: 6, lineHeight: 1.6, fontSize: 13 }}>
        Compare providers side‑by‑side (pricing, features, reliability) or compare two GPUs (specs +
        live price ranges).
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <button
          type="button"
          className={`btn ${mode === "providers" ? "" : "btnSecondary"}`}
          onClick={() => onChangeMode("providers")}
          disabled={providers.length < 2}
        >
          Providers
        </button>
        <button
          type="button"
          className={`btn ${mode === "gpus" ? "" : "btnSecondary"}`}
          onClick={() => onChangeMode("gpus")}
          disabled={gpus.length < 2}
        >
          GPUs
        </button>
      </div>

      <div className="grid grid2" style={{ marginTop: 12, alignItems: "end" }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            A
          </span>
          <select
            value={a}
            onChange={(e) => setA(e.target.value)}
            disabled={options.length < 2}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(15, 23, 42, 0.12)",
            }}
          >
            {options.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            B
          </span>
          <select
            value={b}
            onChange={(e) => setB(e.target.value)}
            disabled={options.length < 2}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(15, 23, 42, 0.12)",
            }}
          >
            {options.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}
      >
        <button className="btn" type="submit" disabled={!valid}>
          Compare
        </button>
        {!valid ? (
          <span className="muted" style={{ fontSize: 13 }}>
            Pick two different options.
          </span>
        ) : null}
      </div>
    </form>
  );
}
