"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { getCachedUser, setCachedUser, clearAuthToken, type AuthUser } from "../lib/api";
import { LoginButton } from "./AuthModal";
import { ThemeToggle } from "./ThemeToggle";

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
      <header className="card rounded-none border-x-0">
        <div className="container flex items-center gap-4">
          <Link href="/" className="font-extrabold tracking-tight text-lg">
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
            className="muted flex gap-3 text-sm"
          >
            <Link href="/cloud-gpu" className="hover:text-[var(--color-foreground)]">
              GPUs
            </Link>
            <Link href="/provider" className="hover:text-[var(--color-foreground)]">
              Providers
            </Link>
            <Link href="/compare" className="hover:text-[var(--color-foreground)]">
              Compare
            </Link>
            <Link href="/best-gpu-for" className="hover:text-[var(--color-foreground)]">
              Use cases
            </Link>
            <Link href="/region" className="hover:text-[var(--color-foreground)]">
              Regions
            </Link>
            <Link href="/calculator" className="hover:text-[var(--color-foreground)]">
              Calculator
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            <ThemeToggle />
            {user ? (
              <>
                <Link href="/account" className="btn btnSecondary text-sm">
                  My Account
                </Link>
                <button
                  onClick={handleLogout}
                  className="btnSecondary rounded-md border border-[var(--color-border-strong)] bg-transparent px-4 py-2 text-sm cursor-pointer hover:bg-[var(--color-surface-elevated)]"
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
                  className="btn btnSecondary text-sm"
                  href="https://api.cloudgpus.io/admin"
                  rel="noreferrer"
                >
                  Admin
                </a>
              </>
            )}
            <Link className="btn" href="/cloud-gpu">
              Compare Prices
            </Link>
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
