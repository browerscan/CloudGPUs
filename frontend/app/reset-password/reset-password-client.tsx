"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/lib/api";

export default function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("Missing reset token.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword(token, password);
      setMessage(res.message || "Password reset successfully.");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: "40px 20px", maxWidth: 520 }}>
      <div className="card" style={{ padding: 32 }}>
        <h1 style={{ marginBottom: 12 }}>Reset Password</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          Enter a new password for your account.
        </p>

        {error && <div style={{ marginBottom: 16, color: "var(--error, #c33)" }}>{error}</div>}
        {message && (
          <div style={{ marginBottom: 16, color: "var(--success, #3c3)" }}>{message}</div>
        )}
        {error && (
          <div style={{ marginBottom: 16, fontSize: 14 }}>
            <p className="muted" style={{ marginBottom: 8 }}>
              Common fixes:
            </p>
            <ul style={{ paddingLeft: 18, margin: 0, color: "var(--muted, #666)" }}>
              <li>Use the latest password reset link.</li>
              <li>Reset links expire after 1 hour.</li>
              <li>Request a new reset email if needed.</li>
            </ul>
            <div style={{ marginTop: 12 }}>
              <Link href="/help" className="btn btnSecondary">
                Visit help center
              </Link>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <div>
            <label htmlFor="password" style={{ display: "block", marginBottom: 6 }}>
              New password
            </label>
            <input
              id="password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" style={{ display: "block", marginBottom: 6 }}>
              Confirm password
            </label>
            <input
              id="confirmPassword"
              className="input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              required
              minLength={8}
            />
          </div>
          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Resetting..." : "Reset password"}
          </button>
        </form>

        <div style={{ marginTop: 20 }}>
          <Link href="/account" className="btn btnSecondary">
            Back to account
          </Link>
        </div>
      </div>
    </div>
  );
}
