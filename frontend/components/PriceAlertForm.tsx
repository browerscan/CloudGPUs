"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { env } from "@/lib/env";
import { formatUsdPerHour } from "@/lib/format";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

type TargetSuggestion = {
  label: string;
  price: number;
  aggressiveness: "realistic" | "moderate" | "aggressive";
};

const AGGRESSIVENESS_COLORS = {
  realistic: {
    bg: "rgba(16, 185, 129, 0.12)",
    color: "rgb(6, 95, 70)",
    border: "rgba(16, 185, 129, 0.35)",
  },
  moderate: {
    bg: "rgba(251, 146, 60, 0.12)",
    color: "rgb(180, 83, 9)",
    border: "rgba(251, 146, 60, 0.35)",
  },
  aggressive: {
    bg: "rgba(239, 68, 68, 0.12)",
    color: "rgb(185, 28, 28)",
    border: "rgba(239, 68, 68, 0.35)",
  },
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PriceAlertForm({
  gpuSlug,
  currentCheapestPrice,
  providerSlug,
}: {
  gpuSlug: string;
  currentCheapestPrice?: number | null;
  providerSlug?: string;
}) {
  const [email, setEmail] = useState("");
  const [target, setTarget] = useState<number>(() =>
    currentCheapestPrice && currentCheapestPrice > 0
      ? Math.round(currentCheapestPrice * 100) / 100
      : 2,
  );
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const disabled = status.kind === "submitting";

  const suggestions = useMemo<TargetSuggestion[]>(() => {
    if (!currentCheapestPrice || currentCheapestPrice <= 0) return [];
    const realistic: TargetSuggestion = {
      label: "Realistic (5% below)",
      price: Math.round(currentCheapestPrice * 0.95 * 100) / 100,
      aggressiveness: "realistic",
    };
    const moderate: TargetSuggestion = {
      label: "Moderate (10% below)",
      price: Math.round(currentCheapestPrice * 0.9 * 100) / 100,
      aggressiveness: "moderate",
    };
    const aggressive: TargetSuggestion = {
      label: "Aggressive (20% below)",
      price: Math.round(currentCheapestPrice * 0.8 * 100) / 100,
      aggressiveness: "aggressive",
    };
    return [realistic, moderate, aggressive].filter(
      (s) => s.price > 0 && s.price < currentCheapestPrice,
    );
  }, [currentCheapestPrice]);

  const canSubmit = useMemo(() => {
    if (!EMAIL_REGEX.test(email.trim())) return false;
    if (!Number.isFinite(target) || target <= 0) return false;
    return true;
  }, [email, target]);

  const emailError = email.trim() && !EMAIL_REGEX.test(email.trim());
  const targetError = Number.isFinite(target) && target <= 0;
  const targetAboveCurrent = currentCheapestPrice && target >= currentCheapestPrice;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus({ kind: "submitting" });

    try {
      const res = await fetch(`${env.apiBaseUrl}/api/alerts/subscribe`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          gpuSlug,
          providerSlug,
          targetPricePerGpuHour: target,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { status: string };
      if (data.status === "already_confirmed") {
        setStatus({
          kind: "success",
          message: "Alert updated. You will get an email when the price hits your target.",
        });
      } else {
        setStatus({
          kind: "success",
          message: "Check your email to confirm your alert (double opt-in).",
        });
      }
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to create alert",
      });
    }
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ padding: 16 }}>
      <div style={{ fontWeight: 800 }}>Price drop alert</div>
      <div className="muted" style={{ marginTop: 6, lineHeight: 1.6, fontSize: 13 }}>
        Get an email when the cheapest observed price for <code>{gpuSlug}</code>
        {providerSlug ? (
          <>
            {" "}
            on <code>{providerSlug}</code>
          </>
        ) : (
          " across providers"
        )}{" "}
        drops below your target.
      </div>

      {currentCheapestPrice != null && currentCheapestPrice > 0 ? (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            background: "rgba(16, 185, 129, 0.1)",
            borderRadius: 8,
            border: "1px solid rgba(16, 185, 129, 0.3)",
          }}
        >
          <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>
            Current cheapest price
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "rgb(6, 95, 70)" }}>
            {formatUsdPerHour(currentCheapestPrice)}
          </div>
        </div>
      ) : null}

      {suggestions.length > 0 ? (
        <div style={{ marginTop: 12 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6, fontWeight: 600 }}>
            Suggested targets
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {suggestions.map((s) => {
              const colors = AGGRESSIVENESS_COLORS[s.aggressiveness];
              const isActive = target === s.price;
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setTarget(s.price)}
                  disabled={disabled}
                  className="btn"
                  style={{
                    fontSize: 13,
                    padding: "6px 12px",
                    background: isActive ? colors.bg : "rgba(15, 23, 42, 0.06)",
                    color: isActive ? colors.color : "inherit",
                    borderColor: isActive ? colors.border : "rgba(15, 23, 42, 0.12)",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.6 : 1,
                  }}
                >
                  {s.label} ({formatUsdPerHour(s.price)})
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 10, marginTop: 12 }} className="grid grid2">
        <label style={{ display: "grid", gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            Email
          </span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={disabled}
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? "email-error" : undefined}
            className="input"
          />
          {emailError ? (
            <span
              id="email-error"
              className="muted"
              style={{ fontSize: 12, color: "rgb(185, 28, 28)" }}
            >
              Please enter a valid email address
            </span>
          ) : null}
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            Target ($/GPU-hr)
          </span>
          <input
            value={Number.isFinite(target) ? target : ""}
            onChange={(e) => setTarget(Number(e.target.value))}
            disabled={disabled}
            inputMode="decimal"
            type="number"
            step="0.01"
            min="0"
            aria-invalid={targetError || targetAboveCurrent ? true : undefined}
            aria-describedby={
              targetError ? "target-error" : targetAboveCurrent ? "target-warning" : undefined
            }
            className="input"
            style={
              targetAboveCurrent
                ? { borderColor: "rgb(251, 146, 60)", background: "rgba(251, 146, 60, 0.08)" }
                : undefined
            }
          />
          {targetError ? (
            <span
              id="target-error"
              className="muted"
              style={{ fontSize: 12, color: "rgb(185, 28, 28)" }}
            >
              Target must be greater than 0
            </span>
          ) : targetAboveCurrent ? (
            <span
              id="target-warning"
              className="muted"
              style={{ fontSize: 12, color: "rgb(180, 83, 9)" }}
            >
              Target is at or above current price. You may never receive an alert.
            </span>
          ) : null}
        </label>
      </div>

      <div
        style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}
      >
        <button className="btn" type="submit" disabled={!canSubmit || disabled}>
          {status.kind === "submitting" ? "Creating alert..." : "Create price alert"}
        </button>
        {status.kind === "success" ? (
          <span role="status" style={{ fontSize: 13, color: "rgb(6, 95, 70)" }}>
            {status.message}
          </span>
        ) : null}
        {status.kind === "error" ? (
          <span role="alert" style={{ fontSize: 13, color: "rgb(185, 28, 28)" }}>
            Error: {status.message}
          </span>
        ) : null}
      </div>

      <div className="muted" style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5 }}>
        You can cancel or update your alerts anytime via the unsubscribe link in emails.
      </div>
    </form>
  );
}
