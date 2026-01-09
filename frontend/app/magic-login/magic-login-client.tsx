"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { magicLogin, setAuthToken, setCachedUser } from "@/lib/api";

type Status = "idle" | "loading" | "success" | "error";

export default function MagicLoginClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing magic login token.");
      return;
    }

    setStatus("loading");
    magicLogin(token)
      .then((res) => {
        setAuthToken(res.data.accessToken);
        setCachedUser(res.data.user);
        setStatus("success");
        setMessage("Signed in successfully. Redirecting...");
        setTimeout(() => router.push("/account"), 1200);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Magic login failed.");
      });
  }, [router, token]);

  return (
    <div className="container" style={{ padding: "40px 20px", maxWidth: 640 }}>
      <div className="card" style={{ padding: 32, textAlign: "center" }}>
        <h1 style={{ marginBottom: 12 }}>Magic Login</h1>
        {status === "loading" && <p className="muted">Signing you in...</p>}
        {status === "success" && <p style={{ color: "var(--success, #3c3)" }}>{message}</p>}
        {status === "error" && <p style={{ color: "var(--error, #c33)" }}>{message}</p>}
        <div style={{ marginTop: 24 }}>
          <Link href="/account" className="btn">
            Go to account
          </Link>
        </div>
      </div>
    </div>
  );
}
