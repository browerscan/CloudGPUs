"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { getCachedUser, setCachedUser, clearAuthToken, type AuthUser } from "../lib/api";
import { LoginButton } from "./AuthModal";

const AuthModal = dynamic(() => import("./AuthModal").then((m) => ({ default: m.AuthModal })), {
  loading: () => null,
  ssr: false,
});

export function Header() {
  const [user, setUser] = useState<AuthUser | null>(getCachedUser());
  const [showAuth, setShowAuth] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleStorageChange = () => {
      setUser(getCachedUser());
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const handleLogout = () => {
    clearAuthToken();
    setCachedUser(null);
    setUser(null);
  };

  return (
    <>
      <header className="card" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0 }}>
        <div className="container" style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link href="/" style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
            CloudGPUs.io
          </Link>
          <button
            className="mobile-menu-toggle"
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span />
            <span />
            <span />
          </button>
          <nav
            aria-label="Main navigation"
            data-expanded={menuOpen}
            className="muted"
            style={{ display: "flex", gap: 12, fontSize: 14 }}
          >
            <Link href="/cloud-gpu">GPUs</Link>
            <Link href="/provider">Providers</Link>
            <Link href="/compare">Compare</Link>
            <Link href="/best-gpu-for">Use cases</Link>
            <Link href="/region">Regions</Link>
            <Link href="/calculator">Calculator</Link>
          </nav>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
            {user ? (
              <>
                <Link href="/account" className="btn btnSecondary" style={{ fontSize: 14 }}>
                  My Account
                </Link>
                <button
                  onClick={handleLogout}
                  className="btnSecondary"
                  style={{
                    background: "none",
                    border: "1px solid var(--border)",
                    padding: "8px 16px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <LoginButton
                  onLoginSuccess={(userData) => {
                    setUser(userData);
                    setShowAuth(false);
                  }}
                />
                <a
                  className="btn btnSecondary"
                  href="https://api.cloudgpus.io/admin"
                  rel="noreferrer"
                  style={{ fontSize: 14 }}
                >
                  Admin
                </a>
              </>
            )}
            <a className="btn" href="/cloud-gpu">
              Compare Prices
            </a>
          </div>
        </div>
      </header>
      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={(userData) => {
          setUser(userData);
          setShowAuth(false);
        }}
      />
    </>
  );
}
