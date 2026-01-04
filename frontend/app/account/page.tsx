"use client";

import { useState, useEffect } from "react";
import {
  getCachedUser,
  clearAuthToken,
  setCachedUser,
  getMe,
  getComparisons,
  getAlerts,
  deleteComparison,
  type AuthUser,
  type SavedComparison,
  type UserAlert,
} from "../../lib/api";
import { AuthModal, LoginButton } from "../../components/AuthModal";

export default function AccountPage() {
  const [user, setUser] = useState<AuthUser | null>(getCachedUser());
  const [comparisons, setComparisons] = useState<SavedComparison[]>([]);
  const [alerts, setAlerts] = useState<UserAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "comparisons" | "alerts">("overview");
  const [showAuth, setShowAuth] = useState(false);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    Promise.all([getMe(), getComparisons(), getAlerts()])
      .then(([meRes, compRes, alertRes]) => {
        setUser(meRes.data.user);
        setComparisons(compRes.data.comparisons);
        setAlerts(alertRes.data.alerts);
      })
      .catch(() => {
        // Token might be expired, clear it
        clearAuthToken();
        setCachedUser(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const handleLogout = () => {
    clearAuthToken();
    setCachedUser(null);
    setUser(null);
    setComparisons([]);
    setAlerts([]);
  };

  const handleDeleteComparison = async (id: string) => {
    try {
      await deleteComparison(id);
      setComparisons((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Failed to delete comparison:", err);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: "40px 20px", textAlign: "center" }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container" style={{ padding: "40px 20px", maxWidth: 600 }}>
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <h1 style={{ marginBottom: 16 }}>Sign In Required</h1>
          <p className="muted" style={{ marginBottom: 24 }}>
            Please sign in to access your account dashboard.
          </p>
          <LoginButton
            onLoginSuccess={(userData) => {
              setUser(userData);
              setShowAuth(false);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: "40px 20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 32,
        }}
      >
        <div>
          <h1 style={{ margin: 0, marginBottom: 8 }}>My Account</h1>
          <p className="muted" style={{ margin: 0 }}>
            {user.email}
            {!user.isVerified && (
              <span style={{ color: "var(--warning, #c60)", marginLeft: 8 }}>
                (Email not verified)
              </span>
            )}
          </p>
        </div>
        <button onClick={handleLogout} className="btn btnSecondary">
          Sign Out
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border)",
            background: "var(--muted-bg, #f5f5f5)",
          }}
        >
          <button
            onClick={() => setActiveTab("overview")}
            style={{
              padding: "16px 24px",
              background: activeTab === "overview" ? "var(--bg)" : "transparent",
              border: "none",
              borderBottom: activeTab === "overview" ? "2px solid var(--link, #0066cc)" : "none",
              cursor: "pointer",
              fontWeight: activeTab === "overview" ? 600 : 400,
            }}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("comparisons")}
            style={{
              padding: "16px 24px",
              background: activeTab === "comparisons" ? "var(--bg)" : "transparent",
              border: "none",
              borderBottom: activeTab === "comparisons" ? "2px solid var(--link, #0066cc)" : "none",
              cursor: "pointer",
              fontWeight: activeTab === "comparisons" ? 600 : 400,
            }}
          >
            Saved Comparisons ({comparisons.length})
          </button>
          <button
            onClick={() => setActiveTab("alerts")}
            style={{
              padding: "16px 24px",
              background: activeTab === "alerts" ? "var(--bg)" : "transparent",
              border: "none",
              borderBottom: activeTab === "alerts" ? "2px solid var(--link, #0066cc)" : "none",
              cursor: "pointer",
              fontWeight: activeTab === "alerts" ? 600 : 400,
            }}
          >
            Price Alerts ({alerts.length})
          </button>
        </div>

        <div style={{ padding: 24 }}>
          {activeTab === "overview" && (
            <div>
              <h2 style={{ fontSize: 18, marginBottom: 16 }}>Account Overview</h2>
              <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px" }}>
                <dt className="muted">Email:</dt>
                <dd>{user.email}</dd>

                <dt className="muted">Name:</dt>
                <dd>{user.name || "Not set"}</dd>

                <dt className="muted">Status:</dt>
                <dd>{user.isVerified ? "Verified" : "Pending verification"}</dd>

                {user.createdAt && (
                  <>
                    <dt className="muted">Member since:</dt>
                    <dd>{new Date(user.createdAt).toLocaleDateString()}</dd>
                  </>
                )}

                {user.lastLoginAt && (
                  <>
                    <dt className="muted">Last login:</dt>
                    <dd>{new Date(user.lastLoginAt).toLocaleString()}</dd>
                  </>
                )}
              </dl>
            </div>
          )}

          {activeTab === "comparisons" && (
            <div>
              <h2 style={{ fontSize: 18, marginBottom: 16 }}>Saved Comparisons</h2>
              {comparisons.length === 0 ? (
                <p className="muted">
                  No saved comparisons yet. Use the compare page to save comparisons.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {comparisons.map((comparison) => (
                    <div
                      key={comparison.id}
                      style={{
                        padding: 16,
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                          {comparison.name || `${comparison.comparisonType} comparison`}
                        </div>
                        <div className="muted" style={{ fontSize: 14 }}>
                          {comparison.comparisonType === "gpu" ? "GPU" : "Provider"} comparison
                          {" \u00b7 "}
                          {new Date(comparison.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteComparison(comparison.id)}
                        className="btn btnSecondary"
                        style={{ padding: "8px 16px", fontSize: 14 }}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "alerts" && (
            <div>
              <h2 style={{ fontSize: 18, marginBottom: 16 }}>Price Alerts</h2>
              {alerts.length === 0 ? (
                <p className="muted">
                  No price alerts yet. Set up alerts to get notified of price drops.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      style={{
                        padding: 16,
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>
                            {alert.gpu.name}
                            {alert.provider && ` @ ${alert.provider.name}`}
                          </div>
                          <div className="muted" style={{ fontSize: 14 }}>
                            Target: ${alert.targetPricePerGpuHour.toFixed(4)}/GPU-hour
                            {" \u00b7 "}
                            {alert.isActive ? "Active" : "Inactive"}
                            {" \u00b7 "}
                            {new Date(alert.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        {alert.confirmedAt === null && (
                          <span style={{ fontSize: 12, color: "var(--warning, #c60)" }}>
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
