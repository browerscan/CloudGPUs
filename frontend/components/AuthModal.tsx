"use client";

import { useState, useEffect, FormEvent } from "react";
import {
  login,
  register,
  setAuthToken,
  setCachedUser,
  clearAuthToken,
  getCachedUser,
  type AuthUser,
} from "../lib/api";

type AuthMode = "login" | "register" | "forgot";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: AuthUser) => void;
  defaultMode?: AuthMode;
}

export function AuthModal({ isOpen, onClose, onSuccess, defaultMode = "login" }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (isOpen) {
      setMode(defaultMode);
      setError("");
      setMessage("");
    }
  }, [isOpen, defaultMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (mode === "login") {
        const response = await login(email, password);
        setAuthToken(response.data.accessToken);
        setCachedUser(response.data.user);
        onSuccess?.(response.data.user);
        onClose();
      } else if (mode === "register") {
        if (password.length < 8) {
          setError("Password must be at least 8 characters");
          setLoading(false);
          return;
        }
        const response = await register(email, password, name || undefined);
        setAuthToken(response.data.accessToken);
        setCachedUser(response.data.user);
        setMessage("Account created! Check your email to verify your address.");
        onSuccess?.(response.data.user);
        setTimeout(() => onClose(), 1500);
      } else if (mode === "forgot") {
        // Password reset flow
        setMessage("If an account exists with this email, a password reset link will be sent.");
        setPassword("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="auth-modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="auth-modal card"
        style={{
          background: "var(--bg)",
          padding: 32,
          width: "100%",
          maxWidth: 400,
          borderRadius: 12,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 24 }}>
            {mode === "login"
              ? "Sign In"
              : mode === "register"
                ? "Create Account"
                : "Reset Password"}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 24,
              cursor: "pointer",
              padding: 4,
            }}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: 12,
              background: "var(--error-bg, #fee)",
              color: "var(--error, #c33)",
              borderRadius: 6,
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            style={{
              padding: 12,
              background: "var(--success-bg, #efe)",
              color: "var(--success, #3c3)",
              borderRadius: 6,
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {mode === "register" && (
            <div>
              <label htmlFor="name" style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
                Name (optional)
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                style={{
                  width: "100%",
                  padding: 10,
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              />
            </div>
          )}

          <div>
            <label htmlFor="email" style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              style={{
                width: "100%",
                padding: 10,
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 14,
              }}
            />
          </div>

          {mode !== "forgot" && (
            <div>
              <label htmlFor="password" style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={8}
                style={{
                  width: "100%",
                  padding: 10,
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              />
            </div>
          )}

          {mode === "login" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input type="checkbox" id="remember" style={{ width: 16, height: 16 }} />
              <label htmlFor="remember" style={{ cursor: "pointer" }}>
                Remember me for 30 days
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn"
            style={{
              width: "100%",
              padding: 12,
              fontSize: 16,
              fontWeight: 600,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading
              ? "Loading..."
              : mode === "login"
                ? "Sign In"
                : mode === "register"
                  ? "Create Account"
                  : "Send Reset Link"}
          </button>
        </form>

        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
            fontSize: 14,
          }}
        >
          {mode === "login" ? (
            <>
              <div style={{ marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--link, #0066cc)",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  Don't have an account? Sign up
                </button>
              </div>
              <button
                type="button"
                onClick={() => setMode("forgot")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--muted, #666)",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Forgot password?
              </button>
            </>
          ) : mode === "register" ? (
            <button
              type="button"
              onClick={() => setMode("login")}
              style={{
                background: "none",
                border: "none",
                color: "var(--link, #0066cc)",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Already have an account? Sign in
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMode("login")}
              style={{
                background: "none",
                border: "none",
                color: "var(--link, #0066cc)",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface AuthButtonProps {
  onLoginSuccess?: (user: AuthUser) => void;
  children?: React.ReactNode;
}

export function LoginButton({ onLoginSuccess, children }: AuthButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn btnSecondary"
        style={{ cursor: "pointer" }}
      >
        {children || "Sign In"}
      </button>
      <AuthModal isOpen={isOpen} onClose={() => setIsOpen(false)} onSuccess={onLoginSuccess} />
    </>
  );
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for cached user on mount
    const cached = getCachedUser();
    setUser(cached);
    setLoading(false);
  }, []);

  const login = (userData: AuthUser, token: string) => {
    setAuthToken(token);
    setCachedUser(userData);
    setUser(userData);
  };

  const logout = () => {
    clearAuthToken();
    setCachedUser(null);
    setUser(null);
  };

  return { user, loading, login, logout, isAuthenticated: !!user };
}
