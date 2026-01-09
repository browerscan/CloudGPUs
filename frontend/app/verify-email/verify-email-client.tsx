"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { verifyEmail } from "@/lib/api";

type Status = "idle" | "loading" | "success" | "error";

export default function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }

    setStatus("loading");
    verifyEmail(token)
      .then((res) => {
        setStatus("success");
        setMessage(res.message || "Email verified successfully.");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Verification failed.");
      });
  }, [token]);

  return (
    <div className="container" style={{ padding: "40px 20px", maxWidth: 640 }}>
      <div className="card" style={{ padding: 32, textAlign: "center" }}>
        <h1 style={{ marginBottom: 12 }}>Verify Email</h1>
        {status === "loading" && <p className="muted">Verifying your email...</p>}
        {status === "success" && <p style={{ color: "var(--success, #3c3)" }}>{message}</p>}
        {status === "error" && <p style={{ color: "var(--error, #c33)" }}>{message}</p>}
        {status === "error" && (
          <div style={{ marginTop: 16, textAlign: "left" }}>
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>Need help?</h3>
            <ul style={{ paddingLeft: 18, margin: 0, color: "var(--muted, #666)" }}>
              <li>Check that you used the most recent verification email.</li>
              <li>Verification links expire after 24 hours.</li>
              <li>If the link expired, request a new verification email from your account page.</li>
            </ul>
            <div style={{ marginTop: 12 }}>
              <Link href="/help" className="btn btnSecondary">
                Visit help center
              </Link>
            </div>
          </div>
        )}
        <div style={{ marginTop: 24 }}>
          <Link href="/account" className="btn">
            Go to account
          </Link>
        </div>
      </div>
    </div>
  );
}
