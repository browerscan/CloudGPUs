"use client";

import { useState, useEffect } from "react";

const CONSENT_KEY = "cloudgpus_cookie_consent";

type ConsentChoice = "all" | "essential" | null;

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [consent, setConsent] = useState<ConsentChoice>(null);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored === "all" || stored === "essential") {
      setConsent(stored);
      setShowBanner(false);
    } else {
      setShowBanner(true);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem(CONSENT_KEY, "all");
    setConsent("all");
    setShowBanner(false);
  };

  const handleRejectNonEssential = () => {
    localStorage.setItem(CONSENT_KEY, "essential");
    setConsent("essential");
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "16px 24px",
        background: "rgba(11, 18, 32, 0.98)",
        borderTop: "1px solid rgba(255, 255, 255, 0.1)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
      }}
    >
      <div style={{ flex: "1 1 400px", color: "rgba(255, 255, 255, 0.85)", fontSize: 14 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>We use cookies</div>
        <div style={{ lineHeight: 1.6, color: "rgba(255, 255, 255, 0.65)" }}>
          We use essential cookies for site functionality and optional analytics cookies to improve
          your experience. You can accept all cookies or reject non-essential ones.
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={handleRejectNonEssential}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "1px solid rgba(255, 255, 255, 0.2)",
            background: "transparent",
            color: "rgba(255, 255, 255, 0.85)",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Reject Non-Essential
        </button>
        <button
          onClick={handleAcceptAll}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: "#2563eb",
            color: "#fff",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Accept All
        </button>
      </div>
    </div>
  );
}
