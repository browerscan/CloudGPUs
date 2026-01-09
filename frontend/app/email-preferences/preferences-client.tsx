"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getEmailPreferences, updateEmailPreferences, type EmailPreferences } from "@/lib/api";

type Status = "idle" | "loading" | "ready" | "error";

export default function EmailPreferencesClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? undefined;
  const [status, setStatus] = useState<Status>("idle");
  const [prefs, setPrefs] = useState<EmailPreferences | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setStatus("loading");
    getEmailPreferences(token)
      .then((res) => {
        setPrefs(res.data);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load preferences.");
        setStatus("error");
      });
  }, [token]);

  const handleSave = async () => {
    if (!prefs) return;
    setMessage("");
    setError("");
    try {
      const res = await updateEmailPreferences({
        token,
        marketingOptIn: prefs.marketingOptIn,
        productUpdatesOptIn: prefs.productUpdatesOptIn,
      });
      setPrefs(res.data);
      setMessage(res.message || "Preferences updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update preferences.");
    }
  };

  return (
    <div className="container" style={{ padding: "40px 20px", maxWidth: 640 }}>
      <div className="card" style={{ padding: 32 }}>
        <h1 style={{ marginBottom: 8 }}>Email Preferences</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          Manage the optional product and marketing updates you receive from CloudGPUs.io. We always
          send transactional emails for account security and alerts you request.
        </p>

        {status === "loading" && <p className="muted">Loading preferences...</p>}
        {status === "error" && <p style={{ color: "var(--error, #c33)" }}>{error}</p>}

        {status === "ready" && prefs && (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox"
                checked={prefs.productUpdatesOptIn}
                onChange={(e) =>
                  setPrefs((prev) =>
                    prev ? { ...prev, productUpdatesOptIn: e.target.checked } : prev,
                  )
                }
              />
              <label>Product updates and feature announcements</label>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox"
                checked={prefs.marketingOptIn}
                onChange={(e) =>
                  setPrefs((prev) => (prev ? { ...prev, marketingOptIn: e.target.checked } : prev))
                }
              />
              <label>Occasional marketing and benchmark insights</label>
            </div>
            <button className="btn" onClick={handleSave}>
              Save preferences
            </button>
            {message && <p style={{ color: "var(--success, #3c3)" }}>{message}</p>}
            {error && <p style={{ color: "var(--error, #c33)" }}>{error}</p>}
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <Link href="/help" className="btn btnSecondary">
            Help center
          </Link>
        </div>
      </div>
    </div>
  );
}
