"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import {
  getCachedUser,
  clearAuthToken,
  setCachedUser,
  getMe,
  getComparisons,
  getAlerts,
  deleteComparison,
  resendVerify,
  getSessions,
  revokeSessionApi,
  revokeAllSessionsApi,
  changePassword,
  type AuthUser,
  type SavedComparison,
  type UserAlert,
  type UserSession,
} from "../../lib/api";
import { AuthModal, LoginButton } from "../../components/AuthModal";

export default function AccountPage() {
  const [user, setUser] = useState<AuthUser | null>(getCachedUser());
  const [comparisons, setComparisons] = useState<SavedComparison[]>([]);
  const [alerts, setAlerts] = useState<UserAlert[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "comparisons" | "alerts" | "security">(
    "overview",
  );
  const [verifyMessage, setVerifyMessage] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState("");
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    Promise.all([getMe(), getComparisons(), getAlerts(), getSessions()])
      .then(([meRes, compRes, alertRes, sessionRes]) => {
        setUser(meRes.data.user);
        setComparisons(compRes.data.comparisons);
        setAlerts(alertRes.data.alerts);
        setSessions(sessionRes.data.sessions);
      })
      .catch(() => {
        // Token might be expired, clear it
        clearAuthToken();
        setCachedUser(null);
        setUser(null);
        setSessions([]);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const handleLogout = () => {
    clearAuthToken();
    setCachedUser(null);
    setUser(null);
    setComparisons([]);
    setAlerts([]);
    setSessions([]);
  };

  const handleDeleteComparison = async (id: string) => {
    try {
      await deleteComparison(id);
      setComparisons((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Failed to delete comparison:", err);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordMessage("");

    if (passwordForm.newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    try {
      const res = await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordMessage(res.message || "Password updated.");
      clearAuthToken();
      setCachedUser(null);
      setUser(null);
      setSessions([]);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to update password.");
    }
  };

  const refreshSessions = async () => {
    setSessionsLoading(true);
    setSessionsError("");
    try {
      const res = await getSessions();
      setSessions(res.data.sessions);
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : "Failed to load sessions.");
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await revokeSessionApi(sessionId);
      await refreshSessions();
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : "Failed to revoke session.");
    }
  };

  const handleRevokeAll = async (exceptCurrent: boolean) => {
    try {
      await revokeAllSessionsApi(exceptCurrent);
      await refreshSessions();
      if (!exceptCurrent) {
        clearAuthToken();
        setCachedUser(null);
        setUser(null);
      }
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : "Failed to revoke sessions.");
    }
  };

  const handleResendVerify = async () => {
    if (!user?.email) return;
    setVerifyError("");
    setVerifyMessage("");
    try {
      const res = await resendVerify(user.email);
      setVerifyMessage(res.message || "Verification email sent.");
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Failed to send verification email.");
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
          {!user.isVerified && (
            <div style={{ marginTop: 8 }}>
              <button onClick={handleResendVerify} className="btn btnSecondary">
                Resend verification email
              </button>
              {verifyMessage && (
                <div style={{ marginTop: 8, color: "var(--success, #3c3)", fontSize: 14 }}>
                  {verifyMessage}
                </div>
              )}
              {verifyError && (
                <div style={{ marginTop: 8, color: "var(--error, #c33)", fontSize: 14 }}>
                  {verifyError}
                </div>
              )}
            </div>
          )}
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
          <button
            onClick={() => setActiveTab("security")}
            style={{
              padding: "16px 24px",
              background: activeTab === "security" ? "var(--bg)" : "transparent",
              border: "none",
              borderBottom: activeTab === "security" ? "2px solid var(--link, #0066cc)" : "none",
              cursor: "pointer",
              fontWeight: activeTab === "security" ? 600 : 400,
            }}
          >
            Security
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

              <div style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: 16, marginBottom: 12 }}>Quick actions</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  <button className="btn btnSecondary" onClick={() => setActiveTab("comparisons")}>
                    View saved comparisons
                  </button>
                  <button className="btn btnSecondary" onClick={() => setActiveTab("alerts")}>
                    Manage price alerts
                  </button>
                  <Link className="btn" href="/alerts">
                    Create a price alert
                  </Link>
                </div>
                <p className="muted" style={{ marginTop: 12 }}>
                  Stay on top of GPU price drops and keep your most useful comparisons handy.
                </p>
              </div>
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

          {activeTab === "security" && (
            <div style={{ display: "grid", gap: 24 }}>
              <div>
                <h2 style={{ fontSize: 18, marginBottom: 12 }}>Change Password</h2>
                {passwordError && (
                  <div style={{ marginBottom: 12, color: "var(--error, #c33)" }}>
                    {passwordError}
                  </div>
                )}
                {passwordMessage && (
                  <div style={{ marginBottom: 12, color: "var(--success, #3c3)" }}>
                    {passwordMessage}
                  </div>
                )}
                <form onSubmit={handleChangePassword} style={{ display: "grid", gap: 12 }}>
                  <input
                    className="input"
                    type="password"
                    placeholder="Current password"
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                    }
                    required
                  />
                  <input
                    className="input"
                    type="password"
                    placeholder="New password"
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                    }
                    required
                  />
                  <input
                    className="input"
                    type="password"
                    placeholder="Confirm new password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                    }
                    required
                  />
                  <button className="btn" type="submit">
                    Update password
                  </button>
                </form>
                <p className="muted" style={{ marginTop: 8 }}>
                  Changing your password signs you out of all devices.
                </p>
              </div>

              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <h2 style={{ fontSize: 18, margin: 0 }}>Recent Sessions</h2>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn btnSecondary" onClick={() => handleRevokeAll(true)}>
                      Sign out other devices
                    </button>
                    <button className="btn" onClick={() => handleRevokeAll(false)}>
                      Sign out everywhere
                    </button>
                  </div>
                </div>
                {sessionsError && (
                  <div style={{ marginBottom: 12, color: "var(--error, #c33)" }}>
                    {sessionsError}
                  </div>
                )}
                {sessionsLoading ? (
                  <p className="muted">Loading sessions...</p>
                ) : sessions.length === 0 ? (
                  <p className="muted">No recent sessions recorded.</p>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          padding: 14,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>
                            {session.userAgent || "Unknown device"}
                          </div>
                          <div className="muted" style={{ fontSize: 13 }}>
                            {session.ip || "Unknown IP"} {" \u00b7 "}
                            Last seen:{" "}
                            {session.lastSeenAt
                              ? new Date(session.lastSeenAt).toLocaleString()
                              : "Unknown"}
                            {" \u00b7 "}
                            First seen: {new Date(session.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {session.revokedAt ? (
                            <span style={{ fontSize: 12, color: "var(--muted, #666)" }}>
                              Revoked
                            </span>
                          ) : session.isCurrent ? (
                            <span style={{ fontSize: 12, color: "var(--success, #3c3)" }}>
                              Current
                            </span>
                          ) : (
                            <button
                              className="btn btnSecondary"
                              style={{ padding: "6px 12px", fontSize: 13 }}
                              onClick={() => handleRevokeSession(session.id)}
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
